import axios from 'axios';
import type { Context } from 'hono';

import type { createOrderSchema, testCreateOrderSchema, testVerifySchema, verifyPaymentSchema } from '../validations/payment.js';
import type { zContext } from '../types/index.js';

import { env, phonepayEndpoints, planValidityMonths, type plansT } from '../utils/enums.js';
import { Order, Payment, User, UserAccess, type OrderDoc } from '../models/index.js';
import { addMonths } from '../utils/date.js';
import { getPlanPricing } from '../utils/plan-pricing.js';
import { redisClient } from '../services/connect-redis.js';
import { t, tf } from '../utils/i18n.js';

let cachedToken = ""
let tokenExpiry = Date.now()

async function getToken() {
  const bufferTime = 2 * 60 * 1000 // 2min
  if (cachedToken && Date.now() < tokenExpiry - bufferTime) return cachedToken

  const requestBodyJson: any = {
    client_id: env.PHONE_PAY_CLIENT_ID,
    client_secret: env.PHONE_PAY_SECRET,
    client_version: 1,
    grant_type: "client_credentials"
  }

  const requestBody = new URLSearchParams(requestBodyJson).toString()

  const { data } = await axios.post(phonepayEndpoints.getAccessToke, requestBody, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  })

  cachedToken = data.access_token
  tokenExpiry = data.expires_at * 1000
  return cachedToken
}

type phonepeOrderStatus = {
  state?: "PENDING" | "COMPLETED" | "FAILED"
  amount?: number
  errorContext?: { description?: string }
  message?: string
}

async function getPhonepeOrderStatus(merchantOrderId: string) {
  const authToken = await getToken()
  const { data } = await axios.get<phonepeOrderStatus>(phonepayEndpoints.orderStatus(merchantOrderId), {
    headers: { "Authorization": `O-Bearer ${authToken}` }
  })
  return data
}

type paidPlan = {
  amount: number
  subscribedTo: plansT
  noOfProfilesCanView: number
  isAssisted: boolean
  assistedMonths: number
  orderId: string
}

export async function syncUnlockExpiry(userId: unknown, expiryDate: Date) {
  await UserAccess.updateMany(
    { viewer: userId, expiresAt: { $lt: expiryDate } },
    { expiresAt: expiryDate },
  )
}

async function getPlanStartDate(userId: string) {
  const user = await User.findById(userId)
    .select("currentPlan")
    .populate<{ currentPlan: { expiryDate?: Date } | null }>("currentPlan", "expiryDate")
    .lean()

  const now = new Date()
  const currentExpiry = user?.currentPlan?.expiryDate
  return currentExpiry && currentExpiry > now ? new Date(currentExpiry) : now
}

export async function onPaid({ _id, role }: { _id: string, role: string }, body: paidPlan) {
  const assistedMonths = body.isAssisted ? body.assistedMonths : 0

  const startDate = await getPlanStartDate(_id)
  const expiryDate = addMonths(startDate, planValidityMonths[body.subscribedTo])

  const payment = await Payment.create({
    ...body,
    assistedMonths,
    user: _id,
    expiryDate,
  })

  const updatedUser = await User.findOneAndUpdate({ _id }, { currentPlan: payment._id }, { new: true })
    .select("_id role isBlocked isDeleted currentPlan")
    .populate("currentPlan", "_id subscribedTo expiryDate noOfProfilesCanView")
    .lean()

  await syncUnlockExpiry(_id, expiryDate)

  const redisKey = `${role}:${_id}`
  await redisClient.set(redisKey, JSON.stringify(updatedUser), {
    expiration: {
      type: "EX",
      value: 60 * 60 * 24, // 1 day
    }
  })

  return payment
}

type settleResult =
  | { status: "completed", payment: { subscribedTo: string, expiryDate?: Date | null } }
  | { status: "pending" | "failed" | "mismatch" }

export async function settleOrder(order: OrderDoc): Promise<settleResult> {
  if (order.status === "completed" && order.payment) {
    const payment = await Payment.findById(order.payment).select("subscribedTo expiryDate").lean()
    if (payment) return { status: "completed", payment }
  }

  if (order.status === "failed") return { status: "failed" }

  const data = await getPhonepeOrderStatus(order.merchantOrderId)

  if (data.state === "FAILED") {
    await Order.updateOne({ _id: order._id, status: "pending" }, { status: "failed" })
    return { status: "failed" }
  }

  if (data.state !== "COMPLETED") return { status: "pending" }

  if (data.amount !== order.amount * 100) return { status: "mismatch" }

  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, status: "pending" },
    { status: "completed" },
    { new: true },
  )

  if (!claimed) {
    const latest = await Order.findById(order._id)
    return latest && latest.status === "completed" ? settleOrder(latest) : { status: "pending" }
  }

  try {
    const payment = await onPaid({ _id: String(order.user), role: "user" }, {
      amount: order.amount,
      subscribedTo: order.subscribedTo as plansT,
      noOfProfilesCanView: order.noOfProfilesCanView,
      isAssisted: order.isAssisted ?? false,
      assistedMonths: order.assistedMonths ?? 0,
      orderId: order.phonepeOrderId || order.merchantOrderId,
    })

    await Order.updateOne({ _id: order._id }, { payment: payment._id })
    return { status: "completed", payment }

  } catch (error) {
    await Order.updateOne({ _id: order._id }, { status: "pending" })
    throw error
  }
}

const RECONCILE_MIN_AGE = 2 * 60 * 1000
const RECONCILE_MAX_AGE = 2 * 24 * 60 * 60 * 1000

export async function reconcilePendingOrders() {
  const now = Date.now()
  const orders = await Order.find({
    status: "pending",
    createdAt: { $lte: new Date(now - RECONCILE_MIN_AGE), $gte: new Date(now - RECONCILE_MAX_AGE) },
  })

  for (const order of orders) {
    try {
      await settleOrder(order)
    } catch (error) {
      console.log(`Failed to reconcile order ${order.merchantOrderId}`, error instanceof Error ? error.message : error)
    }
  }
}

export const createOrder = async (c: zContext<{ json: typeof createOrderSchema }>) => {
  const { _id } = c.get("user")
  const { subscribedTo, noOfProfilesCanView, isAssisted, assistedMonths } = c.req.valid("json")

  const pricing = getPlanPricing({ subscribedTo, noOfProfilesCanView, isAssisted, assistedMonths })
  if (!pricing.ok) return c.json({ message: t(c, pricing.error) }, 400)

  const { amount } = pricing

  const merchantOrderId = `Tx-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`
  const orderBody = {
    "merchantOrderId": merchantOrderId,
    "amount": amount * 100,
    "expireAfter": 3600,
    "metaInfo": {
      "udf1": JSON.stringify({ user_id: _id, subscribedTo, noOfProfilesCanView, isAssisted, assistedMonths: pricing.assistedMonths }),
    },
    "paymentFlow": {
      "type": "PG_CHECKOUT",
      "message": "Payment message used for collect requests",
      "merchantUrls": {
        "redirectUrl": `${env.FRONTEND_URL}/user/payment`
      }
    }
  }

  let data: { orderId?: string, redirectUrl?: string, state?: string }
  try {
    const authToken = await getToken()
    const response = await axios.post(phonepayEndpoints.createOrder, orderBody, {
      headers: { "Authorization": `O-Bearer ${authToken}` }
    })
    data = response.data
  } catch (error) {
    if (!axios.isAxiosError(error)) throw error
    console.log("PhonePe create order failed", error.response?.status)
    return c.json({ message: t(c, "paymentServiceBusy") }, 503)
  }

  await Order.create({
    user: _id,
    merchantOrderId,
    phonepeOrderId: data?.orderId,
    amount,
    subscribedTo,
    noOfProfilesCanView,
    isAssisted,
    assistedMonths: pricing.assistedMonths,
  })

  return c.json({ ...data, amount, merchantOrderId })
}

export const verifyPayment = async (c: zContext<{ json: typeof verifyPaymentSchema }>) => {
  const { merchantOrderId } = c.req.valid("json")
  const { _id } = c.get("user")

  const order = await Order.findOne({ merchantOrderId, user: _id })
  if (!order) return c.json({ message: t(c, "orderNotFound") }, 404)

  let result: Awaited<ReturnType<typeof settleOrder>>
  try {
    result = await settleOrder(order)
  } catch (error) {
    if (!axios.isAxiosError(error)) throw error
    console.log("PhonePe status check failed", error.response?.status)
    return c.json({ message: t(c, "paymentCheckFailed") }, 503)
  }

  if (result.status !== "completed") {
    const errorKeys = { pending: "paymentPending", failed: "paymentFailed", mismatch: "paymentAmountMismatch" } as const
    return c.json({ message: t(c, errorKeys[result.status]) }, 400)
  }

  return c.json({
    subscribedTo: result.payment.subscribedTo,
    expiryDate: result.payment.expiryDate,
  })
}

type webhookBody = {
  event?: string
  payload?: { merchantOrderId?: string }
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("")
}

export const phonepeWebhook = async (c: Context) => {
  const { PHONE_PAY_WEBHOOK_USERNAME: username, PHONE_PAY_WEBHOOK_PASSWORD: password } = env
  if (!username || !password) return c.json({ message: t(c, "invalidWebhook") }, 401)

  const expected = await sha256(`${username}:${password}`)
  const received = (c.req.header("Authorization") || "").replace(/^SHA256\s+/i, "").trim().toLowerCase()
  if (received !== expected) return c.json({ message: t(c, "invalidWebhook") }, 401)

  const body = await c.req.json<webhookBody>().catch(() => null)
  const merchantOrderId = body?.payload?.merchantOrderId
  if (!merchantOrderId) return c.json({ message: t(c, "invalidWebhook") }, 400)

  const order = await Order.findOne({ merchantOrderId })
  if (!order) return c.json({ message: t(c, "orderNotFound") }, 404)

  const result = await settleOrder(order)
  return c.json({ status: result.status })
}

export const testCreateOrder = async (c: zContext<{ json: typeof testCreateOrderSchema }>) => {
  const { _id } = c.get("user")
  const { amount } = c.req.valid("json")

  const notes: any = {
    user_id: _id,
    amount,
  }

  const authToken = await getToken()

  const merchantOrderId = `Tx-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`
  const orderBody = {
    "merchantOrderId": merchantOrderId,
    "amount": amount * 100,
    "expireAfter": 3600,
    "metaInfo": {
      "udf1": JSON.stringify(notes),
    },
    "paymentFlow": {
      "type": "PG_CHECKOUT",
      "message": "Payment message used for collect requests",
      "merchantUrls": {
        "redirectUrl": `${env.FRONTEND_URL}/super-admin/test-payment`
      }
    }
  }

  const { data } = await axios.post(phonepayEndpoints.createOrder, orderBody, {
    headers: { "Authorization": `O-Bearer ${authToken}` }
  })

  return c.json({ ...data, amount, merchantOrderId })
}

export const testVerifyPayment = async (c: zContext<{ json: typeof testVerifySchema }>) => {
  const { merchantOrderId, orderId } = c.req.valid("json")

  const data = await getPhonepeOrderStatus(merchantOrderId)

  if (data.state !== "COMPLETED") {
    return c.json({ message: data?.errorContext?.description || data?.message }, 400)
  }

  return c.json({ message: tf(c, "orderCompleted", { orderId }) })
}
