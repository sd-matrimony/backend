import axios from 'axios';
import { z } from "zod";

import type { createOrderSchema, testCreateOrderSchema, testVerifySchema, verifyPaymentSchema } from '../validations/payment.js';
import type { zContext } from '../types/index.js';

import { assistedPrices, env, extraProfiles, phonepayEndpoints, planPrices, planValidityMonths, profilesCount, type plansT } from '../utils/enums.js';
import { Payment, User } from '../models/index.js';
import { redisClient } from '../services/connect-redis.js';

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

export const createOrder = async (c: zContext<{ json: typeof createOrderSchema }>) => {
  const { _id } = c.get("user")
  const {
    subscribedTo = "basic",
    noOfProfilesCanView = 30,
    isAssisted = false,
    assistedMonths = 0
  } = c.req.valid("json")

  let amount = planPrices[subscribedTo]

  const notes: any = {
    user_id: _id,
    subscribedTo,
    noOfProfilesCanView,
    isAssisted,
    assistedMonths,
  }

  if (noOfProfilesCanView === 999) {
    // Unlimited
    amount += extraProfiles[999]
  } else {
    const added = noOfProfilesCanView - profilesCount[subscribedTo]
    if (added > 0) {
      amount += extraProfiles[added]
    }
  }

  if (isAssisted) {
    amount += assistedPrices[assistedMonths]
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
        "redirectUrl": `${env.FRONTEND_URL}/user/payment`
      }
    }
  }

  const { data } = await axios.post(phonepayEndpoints.createOrder, orderBody, {
    headers: { "Authorization": `O-Bearer ${authToken}` }
  })

  return c.json({ ...data, amount, merchantOrderId })
}

export async function onPaid({ _id, role }: { _id: string, role: string }, body: Omit<z.infer<typeof verifyPaymentSchema>, "merchantOrderId">) {
  if (!body.isAssisted) {
    body.assistedMonths = 0
  }

  const expiryDate = new Date(new Date().setMonth(new Date().getMonth() + planValidityMonths[body.subscribedTo as plansT]))

  const payment = await Payment.create({
    ...body,
    user: _id,
    expiryDate,
  })

  const updatedUser = await User.findOneAndUpdate({ _id }, { currentPlan: payment._id }, { new: true })
    .select("_id role isBlocked isDeleted currentPlan")
    .populate("currentPlan", "_id subscribedTo expiryDate noOfProfilesCanView")
    .lean()

  const redisKey = `${role}:${_id}`
  await redisClient.set(redisKey, JSON.stringify(updatedUser), {
    expiration: {
      type: "EX",
      value: 60 * 60 * 24, // 1 day
    }
  })

  return {
    subscribedTo: payment.subscribedTo,
    expiryDate: payment.expiryDate
  }
}

export const verifyPayment = async (c: zContext<{ json: typeof verifyPaymentSchema }>) => {
  const { merchantOrderId, ...body } = c.req.valid("json")
  const { _id, role } = c.get("user")

  const authToken = await getToken()

  const url = phonepayEndpoints.orderStatus(merchantOrderId)
  const { data } = await axios.get(url, {
    headers: { "Authorization": `O-Bearer ${authToken}` }
  })

  if (data.state !== "COMPLETED") {
    return c.json({ message: data?.errorContext?.description || data?.message }, 400)
  }

  const res = await onPaid({ _id, role }, body)
  return c.json(res)
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

  const authToken = await getToken()

  const url = phonepayEndpoints.orderStatus(merchantOrderId)
  const { data } = await axios.get(url, {
    headers: { "Authorization": `O-Bearer ${authToken}` }
  })

  if (data.state !== "COMPLETED") {
    return c.json({ message: data?.errorContext?.description || data?.message }, 400)
  }

  return c.json({ message: `Order with id ${orderId} completed successfully` })
}
