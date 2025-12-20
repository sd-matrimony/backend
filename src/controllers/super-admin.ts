import type { Context } from "hono";

import type {
  skipLimitSchema, adminCreateSchema, adminUpdateSchema, usersCreatedBySchema, _idParamSchema,
  usersGroupedCountSchema, usersGroupedByAdminCountSchema, usersGroupedListSchema, findUsersSchema,
  resetPassByAdminSchema, mkePaymentSchema,
} from "../validations/index.js";
import type { zContext } from "../types/index.js";

import { Payment, User, Admin } from "../models/index.js";
import { getFilterObj } from "../utils/user-filter-obj.js";
import { hashPassword } from "../utils/password.js";
import { onPaid } from "./payment.js";

const planSelectFields = "_id amount subscribedTo expiryDate noOfProfilesCanView isAssisted assistedMonths createdAt"
const userSelectFields = "_id fullName email profileImg dob otherDetails.caste otherDetails.subCaste proffessionalDetails.salary"

export async function getPaidUsers(c: zContext<{ query: typeof skipLimitSchema }>) {
  const { limit, skip } = c.req.valid("query") || { limit: 10, skip: 0 }

  const numLimit = Number(limit || 10)
  const numSkip = Number(skip || 0)

  const users = await Payment.find({ expiryDate: { $gte: new Date() } })
    .select(planSelectFields)
    .populate("user", userSelectFields)
    .limit(numLimit)
    .skip(numSkip)
    .sort({ createdAt: -1 })
    .lean()

  const final = users.map(({ createdAt, ...user }) => ({
    ...user,
    assistedExpire: new Date(new Date(createdAt).setMonth(createdAt.getMonth() + user.assistedMonths)).toISOString()
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
    .sort({ createdAt: -1 })
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
    .sort({ createdAt: -1 })
    .lean()

  return c.json(users)
}

export async function getUsersGroupedByAdminCount(c: zContext<{ query: typeof usersGroupedByAdminCountSchema }>) {
  const { type } = c.req.valid("query")

  const groupKey =
    type === "date"
      ? { $dateToString: { format: "%d-%m-%Y", date: "$createdAt" } }
      : "$otherDetails.caste"

  const result = await User.aggregate([
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

export async function getNotInvitedUsers(c: zContext<{ query: typeof findUsersSchema }>) {
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
    .select("_id fullName email profileImg contactDetails.mobile dob otherDetails.caste")
    .limit(numLimit)
    .skip(numSkip)
    .sort({ createdAt: -1 })
    .lean()

  return c.json(users)
}

export async function updateInvited(c: zContext<{ param: typeof _idParamSchema }>) {
  const { _id } = c.req.valid("param")

  await User.updateOne({ _id }, { invited: true })

  return c.json({ message: "User invited successfully" })
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

  if (adminExist) return c.json({ message: "Admin already exists" }, 400)

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

  return c.json({ message: "Admin created successfully" })
}

export async function updateAdmin(c: zContext<{ json: typeof adminUpdateSchema, param: typeof _idParamSchema }>) {
  const { _id } = c.req.valid("param")
  const rest = c.req.valid("json")

  if (rest.password) {
    rest.password = await hashPassword(rest.password)
  }

  await Admin.updateOne({ _id }, rest)

  return c.json({ message: "Admin details updated successfully" })
}

export async function resetPass(c: zContext<{ param: typeof _idParamSchema, json: typeof resetPassByAdminSchema }>) {
  const { password } = c.req.valid("json")
  const { _id } = c.req.valid("param")

  const hashedPass = await hashPassword(password)
  await User.updateOne({ _id }, { password: hashedPass })

  return c.json({ message: "Password reset successfully" })
}

export async function makePaymentForUser(c: zContext<{ json: typeof mkePaymentSchema }>) {
  const { _id, ...body } = c.req.valid("json")

  const res = await onPaid({ _id, role: "user" }, { ...body, orderId: `by-admin-${Date.now()}` })
  return c.json(res)
}
