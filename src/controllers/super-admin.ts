import type { Context } from "hono";
import { Types, isValidObjectId } from "mongoose";

import type {
  skipLimitSchema, adminCreateSchema, adminUpdateSchema, usersCreatedBySchema, _idParamSchema,
  usersGroupedCountSchema, usersGroupedByAdminCountSchema, usersGroupedListSchema, findUsersSchema,
  resetPassByAdminSchema, mkePaymentSchema, extendPlanSchema, bulkUpdateUsersSchema, updateUserCriticalSchema,
  activeUsersSchema, paidUsersSchema, dashboardStatsSchema,
  paymentUsersSchema, unlockedProfilesQuerySchema, addProfilesSchema, reasonQuerySchema,
} from "../validations/index.js";
import type { zContext } from "../types/index.js";

import { redisClient } from "../services/connect-redis.js";

import { Payment, User, Admin, UserAccess, PaymentLog, UserLog } from "../models/index.js";
import { getFilterObj } from "../utils/user-filter-obj.js";
import { hashPassword } from "../utils/password.js";
import { t, tf } from "../utils/i18n.js";
import { onPaid, syncUnlockExpiry } from "./payment.js";
import { addMonths } from "../utils/date.js";
import { getPlanPricing, UNLIMITED_PROFILES } from "../utils/plan-pricing.js";
import { getFieldChanges, logUserChanges } from "../utils/user-changes.js";

const planSelectFields = "_id amount subscribedTo expiryDate noOfProfilesCanView isAssisted assistedMonths createdAt"
const userSelectFields = "_id fullName email profileImg dob contactDetails.mobile otherDetails.caste otherDetails.subCaste proffessionalDetails.salary"

export async function getUsersCount(c: zContext<{ query: typeof findUsersSchema }>) {
  const queries = c.req.valid("query") || { limit: 10, skip: 0 }
  const filters = getFilterObj(queries)

  const count = await User.countDocuments(filters)

  return c.json({ count })
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

export async function getDashboardStats(c: zContext<{ query: typeof dashboardStatsSchema }>) {
  const { month } = c.req.valid("query") || {}

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const [year, mon] = month ? month.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1]
  const startOfMonth = new Date(year, mon - 1, 1)
  const endOfMonth = new Date(year, mon, 1)
  const inMonth = { $and: [{ $gte: ["$createdAt", startOfMonth] }, { $lt: ["$createdAt", endOfMonth] }] }

  const notDeleted = { isDeleted: { $ne: true } }

  const [revenue, totalUsers, activeToday, active7d, active30d, paidUserIds, activePlanUsers] = await Promise.all([
    Payment.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
          count: { $sum: 1 },
          online: {
            $sum: { $cond: [{ $regexMatch: { input: "$orderId", regex: /^by-admin-/ } }, 0, "$amount"] }
          },
          byAdmin: {
            $sum: { $cond: [{ $regexMatch: { input: "$orderId", regex: /^by-admin-/ } }, "$amount", 0] }
          },
          month: {
            $sum: { $cond: [inMonth, "$amount", 0] }
          },
          monthCount: {
            $sum: { $cond: [inMonth, 1, 0] }
          },
          today: {
            $sum: { $cond: [{ $gte: ["$createdAt", startOfToday] }, "$amount", 0] }
          },
        }
      }
    ]),
    User.countDocuments({ isDeleted: { $ne: true } }),
    User.countDocuments({ lastActiveAt: { $gte: daysAgo(1) } }),
    User.countDocuments({ lastActiveAt: { $gte: daysAgo(7) } }),
    User.countDocuments({ lastActiveAt: { $gte: daysAgo(30) } }),
    Payment.distinct("user"),
    User.aggregate<{ count: number }>([
      { $match: { ...notDeleted, currentPlan: { $ne: null } } },
      { $lookup: { from: "payments", localField: "currentPlan", foreignField: "_id", as: "plan", pipeline: [{ $project: { expiryDate: 1 } }] } },
      { $match: { "plan.expiryDate": { $gt: now } } },
      { $count: "count" },
    ]),
  ])

  const everPaid = await User.countDocuments({ ...notDeleted, _id: { $in: paidUserIds } })
  const activePlans = activePlanUsers[0]?.count ?? 0

  const { total = 0, count = 0, online = 0, byAdmin = 0, month: monthTotal = 0, monthCount = 0, today = 0 } = revenue[0] || {}

  return c.json({
    revenue: { total, count, online, byAdmin, month: monthTotal, monthCount, today },
    users: { total: totalUsers, activeToday, active7d, active30d },
    plans: {
      active: activePlans,
      expired: Math.max(everPaid - activePlans, 0),
      unpaid: Math.max(totalUsers - everPaid, 0),
    },
  })
}

export async function getActiveUsers(c: zContext<{ query: typeof activeUsersSchema }>) {
  const { skip, limit, days } = c.req.valid("query")

  const users = await User.find({ lastActiveAt: { $gte: daysAgo(days) } })
    .select(`${userSelectFields} lastActiveAt lastLoginAt`)
    .sort({ lastActiveAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .lean()

  return c.json(users)
}

export async function getPaidUsers(c: zContext<{ query: typeof paidUsersSchema }>) {
  const { limit, skip, month, plan } = c.req.valid("query") || { limit: 10, skip: 0 }

  const numLimit = Number(limit || 10)
  const numSkip = Number(skip || 0)

  const filter: Record<string, unknown> = {}
  if (month) {
    const [year, mon] = month.split("-").map(Number)
    filter.createdAt = { $gte: new Date(year, mon - 1, 1), $lt: new Date(year, mon, 1) }
  }
  if (plan) filter.subscribedTo = plan

  const users = await Payment.find(filter)
    .select(planSelectFields)
    .populate("user", userSelectFields)
    .limit(numLimit)
    .skip(numSkip)
    .sort({ createdAt: -1, _id: -1 })
    .lean()

  const final = users.map(user => ({
    ...user,
    assistedExpire: new Date(new Date(user.createdAt).setMonth(user.createdAt.getMonth() + user.assistedMonths)).toISOString()
  }))

  return c.json(final)
}

export async function getAssistedSubscribedUsers(c: zContext<{ query: typeof skipLimitSchema }>) {
  const { limit, skip } = c.req.valid("query") || { limit: 10, skip: 0 }

  const numLimit = Number(limit || 10)
  const numSkip = Number(skip || 0)

  const users = await Payment.find({
    expiryDate: { $gte: new Date() },
    isAssisted: true,
  })
    .select(planSelectFields)
    .populate("user", userSelectFields)
    .limit(numLimit)
    .skip(numSkip)
    .sort({ createdAt: -1, _id: -1 })
    .lean()

  const final = users.map(({ createdAt, ...user }) => ({
    ...user,
    assistedExpire: new Date(new Date(createdAt).setMonth(createdAt.getMonth() + user.assistedMonths)).toISOString()
  }))

  return c.json(final)
}

export async function getUsersAllPayments(c: zContext<{ query: typeof skipLimitSchema }>) {
  const { limit, skip } = c.req.valid("query") || { limit: 10, skip: 0 }

  const numLimit = Number(limit || 10)
  const numSkip = Number(skip || 0)

  const paidUsers = await Payment.aggregate([
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user',
      },
    },
    {
      $unwind: '$user',
    },
    {
      $match: {
        'user.currentPlan': { $ne: null },
      },
    },
    {
      $group: {
        _id: '$user._id',
        user: {
          $first: {
            _id: '$user._id',
            dob: '$user.dob',
            email: '$user.email',
            gender: '$user.gender',
            fullName: '$user.fullName',
            profileImg: '$user.profileImg',
            currentPlan: '$user.currentPlan',
            maritalStatus: '$user.maritalStatus',
          },
        },
        payments: {
          $push: {
            _id: '$_id',
            amount: '$amount',
            expiryDate: '$expiryDate',
            isAssisted: '$isAssisted',
            subscribedTo: '$subscribedTo',
            assistedMonths: '$assistedMonths',
          },
        },
      },
    },
    { $skip: numSkip },
    { $limit: numLimit },
    { $sort: { createdAt: -1 } },
  ])

  return c.json(paidUsers)
}

export async function getUsersByCreatedBy(c: zContext<{ query: typeof usersCreatedBySchema }>) {
  const { limit, skip, createdAtToday, createdBy } = c.req.valid("query") || { limit: 10, skip: 0 }
  const { _id } = c.get("user")

  const numLimit = Number(limit || 10)
  const numSkip = Number(skip || 0)

  const payload: any = {
    createdBy: createdBy || _id
  }

  if (createdAtToday) {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)

    payload.createdAt = {
      $gte: startOfToday,
      $lte: endOfToday,
    }
  }

  const users = await User.find(payload)
    .select(userSelectFields)
    .limit(numLimit)
    .skip(numSkip)
    .sort({ createdAt: -1, _id: -1 })
    .lean()

  return c.json(users)
}

export async function getUsersGroupedByAdminCount(c: zContext<{ query: typeof usersGroupedByAdminCountSchema }>) {
  const { type, includeByAdmin, gender } = c.req.valid("query")

  const groupKey =
    type === "date"
      ? { $dateToString: { format: "%d-%m-%Y", date: "$createdAt" } }
      : "$otherDetails.caste"

  const matchStage = {
    ...(gender ? { gender } : {}),
  }

  if (includeByAdmin) {
    const result = await User.aggregate([
      ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
      {
        $group: {
          _id: {
            createdBy: { $ifNull: ["$createdBy", null] },
            key: {
              $ifNull: [groupKey, "Unknown"],
            },
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.createdBy",
          counts: {
            $push: {
              k: "$_id.key",
              v: "$count",
            },
          },
        },
      },
      {
        $lookup: {
          from: "admins",
          localField: "_id",
          foreignField: "_id",
          as: "adminDetails",
        },
      },
      {
        $unwind: {
          path: "$adminDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          fullName: "$adminDetails.fullName",
          email: "$adminDetails.email",
          data: {
            $arrayToObject: {
              $filter: {
                input: "$counts",
                as: "item",
                cond: {
                  $and: [
                    { $ne: ["$$item.k", null] },
                    { $ne: ["$$item.k", undefined] },
                  ],
                },
              },
            },
          },
        },
      },
    ])
    return c.json(result)
  }

  const result = await User.aggregate([
    ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
    {
      $group: {
        _id: { $ifNull: [groupKey, "Unknown"] },
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: null,
        counts: { $push: { k: "$_id", v: "$count" } },
      },
    },
    {
      $project: {
        _id: 1,
        data: { $arrayToObject: "$counts" },
      },
    },
  ])

  return c.json(result)
}

export async function getUsersGroupedCount(c: zContext<{ query: typeof usersGroupedCountSchema }>) {
  const { date, caste } = c.req.valid("query")

  const match = {
    ...(date && {
      createdAt: {
        $gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
        $lt: new Date(new Date(date).setHours(23, 59, 59, 999)),
      },
    }),
    ...(caste && {
      "otherDetails.caste": caste,
    }),
  }

  const result = await User.aggregate([
    {
      $match: match,
    },
    {
      $group: {
        _id: {
          createdBy: "$createdBy",
        },
        users: {
          $push: {
            _id: '$_id',
            fullName: '$fullName',
            profileImg: '$profileImg',
            maritalStatus: '$maritalStatus',
            isDeleted: '$isDeleted',
            isBlocked: '$isBlocked',
          },
        },
        count: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: "admins",
        localField: "_id.createdBy",
        foreignField: "_id",
        as: "adminDetails"
      }
    },
    {
      $unwind: {
        path: "$adminDetails",
        preserveNullAndEmptyArrays: true,
      }
    },
    {
      $project: {
        _id: "$_id.createdBy",
        fullName: "$adminDetails.fullName",
        email: "$adminDetails.email",
        created: "$count",
      }
    }
  ])

  return c.json(result)
}

export async function getUsersGroupedList(c: zContext<{ query: typeof usersGroupedListSchema }>) {
  const { date, caste, limit, skip, createdBy } = c.req.valid("query")

  const match = {
    ...(date && {
      createdAt: {
        $gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
        $lt: new Date(new Date(date).setHours(23, 59, 59, 999)),
      },
    }),
    ...(caste && {
      "otherDetails.caste": caste,
    }),
    createdBy: createdBy || null,
  }

  const numLimit = Number(limit || 50)
  const numSkip = Number(skip || 0)

  const result = await User.find(match)
    .select("fullName profileImg maritalStatus isDeleted isBlocked")
    .limit(numLimit)
    .skip(numSkip)
    .lean()

  return c.json(result)
}

export async function getAdmins(c: Context<Env>) {
  const admins = await Admin.find()
    .select("_id fullName email isDeleted contactDetails")
    .lean()

  return c.json(admins)
}

export async function getUsersInvitations(c: zContext<{ query: typeof findUsersSchema }>) {
  const { limit, skip, ...filters } = c.req.valid("query") || { limit: 50, skip: 0 }

  const numLimit = Number(limit || 50)
  const numSkip = Number(skip || 0)

  const payload: Record<string, any> = !!filters ? getFilterObj(filters as any) : {
    $and: [
      { $or: [{ email: { $exists: false } }, { email: null }] },
      { $or: [{ invited: { $exists: false } }, { invited: false }] }
    ],
  }

  const users = await User.find(payload)
    .select("_id fullName email profileImg contactDetails.mobile dob otherDetails.caste currentPlan")
    .populate("currentPlan", "subscribedTo expiryDate")
    .limit(numLimit)
    .skip(numSkip)
    .sort({ createdAt: -1, _id: -1 })
    .lean()

  return c.json(users)
}

export async function removeUserPlan(c: zContext<{ param: typeof _idParamSchema, query: typeof reasonQuerySchema }>) {
  const { _id } = c.req.valid("param")
  const { reason } = c.req.valid("query") || {}
  const admin = c.get("user")

  const user = await User.findById(_id).select("currentPlan").lean()
  if (!user) return c.json({ message: t(c, "userNotFound") }, 404)

  await User.updateOne({ _id }, { $unset: { currentPlan: 1 } })
  await redisClient.del(`user:${_id}`)

  if (user.currentPlan) {
    const payment = await Payment.findById(user.currentPlan).select("subscribedTo amount expiryDate").lean()
    await PaymentLog.create({
      user: _id,
      payment: user.currentPlan,
      admin: admin._id,
      action: "cancelled",
      details: { subscribedTo: payment?.subscribedTo, amount: payment?.amount, previousExpiry: payment?.expiryDate },
      reason,
    })
  }

  return c.json({ message: t(c, "subscriptionRemoved") })
}

type extendInput = { days?: number, months?: number, reason?: string }

async function extendPayment(paymentId: unknown, adminId: unknown, { days, months, reason }: extendInput) {
  const payment = await Payment.findById(paymentId).select("user expiryDate")
  if (!payment?.user) return null

  const now = new Date()
  const previousExpiry = payment.expiryDate
  const base = previousExpiry && previousExpiry > now ? previousExpiry : now
  payment.expiryDate = months
    ? addMonths(base, months)
    : new Date(base.getTime() + (days ?? 0) * 24 * 60 * 60 * 1000)
  await payment.save()

  const user = await User.findById(payment.user)
    .select("currentPlan")
    .populate<{ currentPlan: { _id: unknown, expiryDate?: Date } | null }>("currentPlan", "expiryDate")
    .lean()

  const current = user?.currentPlan
  const isCurrent = String(current?._id) === String(payment._id)
  const hasOtherActivePlan = !isCurrent && !!current?.expiryDate && current.expiryDate > now

  if (!isCurrent && !hasOtherActivePlan) {
    await User.updateOne({ _id: payment.user }, { currentPlan: payment._id })
  }
  if (!hasOtherActivePlan) await syncUnlockExpiry(payment.user, payment.expiryDate)

  await redisClient.del(`user:${payment.user}`)

  await PaymentLog.create({
    user: payment.user,
    payment: payment._id,
    admin: adminId,
    action: "extended",
    details: { days, months, previousExpiry, newExpiry: payment.expiryDate },
    reason,
  })

  return payment
}

export async function extendUserPlan(c: zContext<{ param: typeof _idParamSchema, json: typeof extendPlanSchema }>) {
  const { _id } = c.req.valid("param")

  const user = await User.findById(_id).select("currentPlan").lean()
  if (!user) return c.json({ message: t(c, "userNotFound") }, 404)
  if (!user.currentPlan) return c.json({ message: t(c, "noActivePlan") }, 400)

  const payment = await extendPayment(user.currentPlan, c.get("user")._id, c.req.valid("json"))
  if (!payment) return c.json({ message: t(c, "noActivePlan") }, 400)

  return c.json({ expiryDate: payment.expiryDate })
}

export async function extendPaymentById(c: zContext<{ param: typeof _idParamSchema, json: typeof extendPlanSchema }>) {
  const { _id } = c.req.valid("param")
  if (!isValidObjectId(_id)) return c.json({ message: t(c, "paymentNotFound") }, 404)

  const payment = await extendPayment(_id, c.get("user")._id, c.req.valid("json"))
  if (!payment) return c.json({ message: t(c, "paymentNotFound") }, 404)

  return c.json({ expiryDate: payment.expiryDate })
}

export async function addUserProfiles(c: zContext<{ param: typeof _idParamSchema, json: typeof addProfilesSchema }>) {
  const { _id } = c.req.valid("param")
  const { count, reason } = c.req.valid("json")
  const admin = c.get("user")

  const user = await User.findById(_id).select("currentPlan").lean()
  if (!user) return c.json({ message: t(c, "userNotFound") }, 404)
  if (!user.currentPlan) return c.json({ message: t(c, "noActivePlan") }, 400)

  const payment = await Payment.findById(user.currentPlan).select("noOfProfilesCanView")
  if (!payment) return c.json({ message: t(c, "noActivePlan") }, 400)

  const previousProfiles = payment.noOfProfilesCanView ?? 0
  if (previousProfiles >= UNLIMITED_PROFILES) return c.json({ message: t(c, "alreadyUnlimited") }, 400)

  payment.noOfProfilesCanView = Math.min(previousProfiles + count, UNLIMITED_PROFILES)
  await payment.save()
  await redisClient.del(`user:${_id}`)

  await PaymentLog.create({
    user: _id,
    payment: payment._id,
    admin: admin._id,
    action: "profilesAdded",
    details: { profiles: count, previousProfiles, newProfiles: payment.noOfProfilesCanView },
    reason,
  })

  return c.json({ noOfProfilesCanView: payment.noOfProfilesCanView })
}

export async function getUserHistory(c: zContext<{ param: typeof _idParamSchema }>) {
  const { _id } = c.req.valid("param")
  if (!isValidObjectId(_id)) return c.json([])

  const [logs, user] = await Promise.all([
    UserLog.find({ user: _id })
      .populate("admin", "fullName")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean(),
    User.findById(_id).select("createdAt createdBy").populate("createdBy", "fullName").lean(),
  ])

  const hasCreatedLog = logs.some(log => log.action === "created")
  if (!user || hasCreatedLog) return c.json(logs)

  return c.json([...logs, {
    _id: `created-${_id}`,
    action: "created",
    admin: user.createdBy ?? null,
    changes: [],
    createdAt: user.createdAt,
  }])
}

export async function getUserPaymentLogs(c: zContext<{ param: typeof _idParamSchema }>) {
  const { _id } = c.req.valid("param")
  if (!isValidObjectId(_id)) return c.json([])

  const [logs, payments] = await Promise.all([
    PaymentLog.find({ user: _id })
      .populate("admin", "fullName")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    Payment.find({ user: _id })
      .select("_id amount subscribedTo expiryDate noOfProfilesCanView orderId createdAt")
      .lean(),
  ])

  const loggedPayments = new Set(logs.filter(log => log.action === "created").map(log => String(log.payment)))

  const paymentEntries = payments
    .filter(payment => !loggedPayments.has(String(payment._id)))
    .map(payment => ({
      _id: `payment-${payment._id}`,
      payment: payment._id,
      action: payment.orderId?.startsWith("by-admin") ? "created" : "purchased",
      admin: null,
      createdAt: payment.createdAt,
      details: {
        subscribedTo: payment.subscribedTo,
        amount: payment.amount,
        newExpiry: payment.expiryDate,
        newProfiles: payment.noOfProfilesCanView,
      },
    }))

  const activity = [...logs, ...paymentEntries]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return c.json(activity)
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export async function getPaymentUsers(c: zContext<{ query: typeof paymentUsersSchema }>) {
  const { skip, limit, search, status } = c.req.valid("query")
  const now = new Date()

  const match: Record<string, unknown> = {}
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i")
    match.$or = [
      { "user.fullName": regex },
      { "user.email": regex },
      { "user.contactDetails.mobile": regex },
    ]
  }
  if (status === "active") match["currentPlan.expiryDate"] = { $gt: now }
  if (status === "expired") match.$nor = [{ "currentPlan.expiryDate": { $gt: now } }]

  const users = await Payment.aggregate([
    {
      $group: {
        _id: "$user",
        paymentsCount: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
        lastPaidAt: { $max: "$createdAt" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
        pipeline: [{ $project: { fullName: 1, email: 1, profileImg: 1, "contactDetails.mobile": 1, currentPlan: 1 } }],
      },
    },
    { $unwind: "$user" },
    {
      $lookup: {
        from: "payments",
        localField: "user.currentPlan",
        foreignField: "_id",
        as: "currentPlan",
        pipeline: [{ $project: { subscribedTo: 1, expiryDate: 1, noOfProfilesCanView: 1 } }],
      },
    },
    { $unwind: { path: "$currentPlan", preserveNullAndEmptyArrays: true } },
    { $match: match },
    { $sort: { lastPaidAt: -1, _id: -1 } },
    { $skip: skip },
    { $limit: limit },
    { $project: { "user.currentPlan": 0 } },
  ])

  return c.json(users)
}

export async function getUserPayments(c: zContext<{ param: typeof _idParamSchema }>) {
  const { _id } = c.req.valid("param")
  if (!isValidObjectId(_id)) return c.json({ message: t(c, "userNotFound") }, 404)

  const user = await User.findById(_id)
    .select("_id fullName email profileImg contactDetails.mobile currentPlan")
    .lean()
  if (!user) return c.json({ message: t(c, "userNotFound") }, 404)

  const [payments, unlockCounts] = await Promise.all([
    Payment.find({ user: _id })
      .select(`${planSelectFields} orderId`)
      .sort({ createdAt: -1, _id: -1 })
      .lean(),
    UserAccess.aggregate<{ _id: Types.ObjectId, count: number }>([
      { $match: { viewer: new Types.ObjectId(_id) } },
      { $group: { _id: "$payment", count: { $sum: 1 } } },
    ]),
  ])

  const countByPayment = new Map(unlockCounts.map(item => [String(item._id), item.count]))
  const currentPlanId = user.currentPlan ? String(user.currentPlan) : null

  return c.json({
    user,
    payments: payments.map(payment => ({
      ...payment,
      isCurrent: String(payment._id) === currentPlanId,
      unlockedCount: countByPayment.get(String(payment._id)) ?? 0,
    })),
  })
}

export async function deleteUserPayment(c: zContext<{ param: typeof _idParamSchema, query: typeof reasonQuerySchema }>) {
  const { _id } = c.req.valid("param")
  const { reason } = c.req.valid("query") || {}
  const admin = c.get("user")
  if (!isValidObjectId(_id)) return c.json({ message: t(c, "paymentNotFound") }, 404)

  const payment = await Payment.findById(_id).select("_id user subscribedTo amount expiryDate").lean()
  if (!payment) return c.json({ message: t(c, "paymentNotFound") }, 404)

  await Promise.all([
    UserAccess.deleteMany({ payment: _id }),
    Payment.deleteOne({ _id }),
  ])

  const user = await User.findById(payment.user).select("currentPlan").lean()
  if (user && String(user.currentPlan) === String(_id)) {
    const fallback = await Payment.findOne({ user: payment.user, expiryDate: { $gt: new Date() } })
      .select("_id")
      .sort({ expiryDate: -1 })
      .lean()

    await User.updateOne(
      { _id: payment.user },
      fallback ? { $set: { currentPlan: fallback._id } } : { $unset: { currentPlan: 1 } },
    )
  }

  if (payment.user) {
    await redisClient.del(`user:${payment.user}`)
    await PaymentLog.create({
      user: payment.user,
      payment: payment._id,
      admin: admin._id,
      action: "deleted",
      details: { subscribedTo: payment.subscribedTo, amount: payment.amount, previousExpiry: payment.expiryDate },
      reason,
    })
  }

  return c.json({ message: t(c, "paymentDeleted") })
}

export async function updateInvited(c: zContext<{ param: typeof _idParamSchema }>) {
  const { _id } = c.req.valid("param")

  const result = await User.updateOne({ _id }, { invited: true })
  if (result.matchedCount) await logUserChanges([{ user: _id, admin: c.get("user")._id, action: "invited" }])

  return c.json({ message: t(c, "userInvited") })
}

export async function createAdmin(c: zContext<{ json: typeof adminCreateSchema }>) {
  const { email, password, ...rest } = c.req.valid("json")

  const findBy: Record<string, any> = {}
  if (email && rest?.contactDetails?.mobile) {
    findBy.$or = [{ email }, { "contactDetails.mobile": rest.contactDetails.mobile }]
  }
  else if (email) {
    findBy.email = email
  }
  else {
    findBy["contactDetails.mobile"] = rest?.contactDetails?.mobile
  }

  const adminExist = await Admin.findOne(findBy)
    .select("_id")
    .lean()

  if (adminExist) return c.json({ message: t(c, "adminExists") }, 400)

  const hashedPass = await hashPassword(password)

  const admin = new Admin({
    ...rest,
    email: email || undefined,
    password: hashedPass,
    approvalStatus: "approved",
    isVerified: true,
    contactDetails: {
      ...rest?.contactDetails,
      mobile: rest?.contactDetails?.mobile || undefined,
    },
  })

  await admin.save()

  return c.json({ message: t(c, "adminCreated") })
}

export async function updateAdmin(c: zContext<{ json: typeof adminUpdateSchema, param: typeof _idParamSchema }>) {
  const { _id } = c.req.valid("param")
  const rest = c.req.valid("json")

  if (rest.password) {
    rest.password = await hashPassword(rest.password)
  }

  await Admin.updateOne({ _id }, rest)

  return c.json({ message: t(c, "adminDetailsUpdated") })
}

export async function resetPass(c: zContext<{ param: typeof _idParamSchema, json: typeof resetPassByAdminSchema }>) {
  const { password } = c.req.valid("json")
  const { _id } = c.req.valid("param")

  const hashedPass = await hashPassword(password)
  const result = await User.updateOne({ _id }, { password: hashedPass })
  if (result.matchedCount) await logUserChanges([{ user: _id, admin: c.get("user")._id, action: "passwordReset" }])

  return c.json({ message: t(c, "adminPasswordReset") })
}

export async function getUserCurrentPlan(c: zContext<{ param: typeof _idParamSchema }>) {
  const { _id } = c.req.valid("param")

  const user = await User.findById(_id)
    .select("currentPlan")
    .populate("currentPlan", "subscribedTo expiryDate")
    .lean()
  if (!user) return c.json({ message: t(c, "userNotFound") }, 404)

  return c.json((user as any).currentPlan ?? null)
}

export async function getUserUnlockedProfiles(c: zContext<{ param: typeof _idParamSchema, query: typeof unlockedProfilesQuerySchema }>) {
  const { _id } = c.req.valid("param")
  const { payment } = c.req.valid("query") || {}

  const user = await User.findById(_id)
    .select("currentPlan")
    .populate("currentPlan", "_id subscribedTo expiryDate noOfProfilesCanView")
    .lean()
  if (!user) return c.json({ message: t(c, "userNotFound") }, 404)

  if (payment === "all") {
    const list = await UserAccess.find({ viewer: _id })
      .select("viewed payment createdAt")
      .populate("viewed", userSelectFields)
      .sort({ createdAt: -1 })
      .lean()

    const profiles = list
      .filter(item => item.viewed)
      .map(item => ({ ...(item.viewed as object), unlockedAt: item.createdAt, payment: item.payment }))

    return c.json({ plan: null, used: list.length, profiles })
  }

  let plan = (user as any).currentPlan
  if (payment) {
    if (!isValidObjectId(payment)) return c.json({ message: t(c, "paymentNotFound") }, 404)
    plan = await Payment.findOne({ _id: payment, user: _id })
      .select("_id subscribedTo expiryDate noOfProfilesCanView")
      .lean()
    if (!plan) return c.json({ message: t(c, "paymentNotFound") }, 404)
  }
  if (!plan) return c.json({ plan: null, used: 0, profiles: [] })

  const list = await UserAccess.find({ viewer: _id, payment: plan._id })
    .select("viewed createdAt")
    .populate("viewed", userSelectFields)
    .sort({ createdAt: -1 })
    .lean()

  const profiles = list
    .filter(item => item.viewed)
    .map(item => ({ ...(item.viewed as object), unlockedAt: item.createdAt }))

  return c.json({ plan, used: list.length, profiles })
}

export async function makePaymentForUser(c: zContext<{ json: typeof mkePaymentSchema }>) {
  const { _id, ...body } = c.req.valid("json")

  const pricing = getPlanPricing(body)
  if (!pricing.ok) return c.json({ message: t(c, pricing.error) }, 400)

  const payment = await onPaid({ _id, role: "user" }, { ...body, assistedMonths: pricing.assistedMonths, orderId: `by-admin-${Date.now()}` })

  await PaymentLog.create({
    user: _id,
    payment: payment._id,
    admin: c.get("user")._id,
    action: "created",
    details: { subscribedTo: payment.subscribedTo, amount: payment.amount, newExpiry: payment.expiryDate, newProfiles: payment.noOfProfilesCanView },
  })

  return c.json({ subscribedTo: payment.subscribedTo, expiryDate: payment.expiryDate })
}

function flattenForSet(obj: any, prefix = ""): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value !== null && value !== undefined && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      Object.assign(result, flattenForSet(value, fullKey))
    } else if (value !== undefined) {
      result[fullKey] = value
    }
  }
  return result
}

export async function updateUserCritical(c: zContext<{ param: typeof _idParamSchema, json: typeof updateUserCriticalSchema }>) {
  const { _id } = c.req.valid("param")
  const { email, mobile, salary } = c.req.valid("json")

  const user = await User.findById(_id).select("_id email contactDetails.mobile proffessionalDetails.salary").lean()
  if (!user) return c.json({ message: t(c, "userNotFound") }, 404)

  const update: Record<string, any> = {}
  if (email !== undefined) update.email = email
  if (mobile !== undefined) update["contactDetails.mobile"] = mobile
  if (salary !== undefined) update["proffessionalDetails.salary"] = salary

  await User.updateOne({ _id }, { $set: update })
  await logUserChanges([{ user: _id, admin: c.get("user")._id, action: "updated", changes: getFieldChanges(user, update) }])

  return c.json({ message: t(c, "userDetailsUpdated") })
}

export async function bulkUpdateUsers(c: zContext<{ json: typeof bulkUpdateUsersSchema }>) {
  const updates = c.req.valid("json")

  const bulkOps = updates.map(({ _id, ...rest }) => ({
    updateOne: {
      filter: { _id },
      update: { $set: flattenForSet(rest) },
    }
  })) as any[]

  const before = await User.find({ _id: { $in: updates.map(update => update._id) } }).select("-password -refreshTokens").lean()

  await User.bulkWrite(bulkOps)

  const admin = c.get("user")
  await logUserChanges(updates.map(({ _id, ...rest }) => ({
    user: _id,
    admin: admin._id,
    action: "updated" as const,
    changes: getFieldChanges(before.find(doc => String(doc._id) === String(_id)), rest),
  })))

  return c.json({ message: tf(c, "bulkUsersUpdated", { count: updates.length }) })
}
