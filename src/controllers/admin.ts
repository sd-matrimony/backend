import type { zContext } from "../types/index.js";

import {
  findUsersSchema, findUserSchema, skipLimitSchema,
  createUsersSchema, userMarriedToSchema, updateUserSchema,
} from "../validations/index.js";

import { hashPassword, getFilterObj } from "../utils/index.js";
import { redisClient } from "../services/connect-redis.js";
import { User } from "../models/index.js";

const userSelect = "_id fullName email contactDetails.mobile profileImg dob gender maritalStatus otherDetails.caste otherDetails.subCaste proffessionalDetails.salary"

function userSelectMap(prefix = "") {
  return userSelect.split(" ").reduce((prev: any, curr) => {
    const target = `$${prefix ? `${prefix}.` : ""}${curr}`

    if (curr.includes(".")) {
      const [key, field] = curr.split(".")

      if (!prev[key]) {
        prev[key] = {}
      }

      prev[key][field] = target

    } else {
      prev[curr] = target
    }

    return prev
  }, {})
}

export async function getUsers(c: zContext<{ query: typeof findUsersSchema }>) {
  const queries = c.req.valid("query") || { limit: 10, skip: 0 }
  const filters = getFilterObj(queries)

  const numLimit = Number(queries?.limit || 10)
  const numSkip = Number(queries?.skip || 0)

  const fullList = await User.find(filters)
    .select(userSelect + " approvalStatus")
    .limit(numLimit)
    .skip(numSkip)
    .sort({ createdAt: -1 })
    .lean()

  return c.json(fullList)
}

export async function getMarriedUsers(c: zContext<{ query: typeof skipLimitSchema }>) {
  const queries = c.req.valid("query") || { limit: 10, skip: 0 }

  const numLimit = Number(queries?.limit || 10)
  const numSkip = Number(queries?.skip || 0)

  const marriedUsers = await User.aggregate([
    {
      $match: {
        isMarried: true,
      },
    },
    {
      $match: {
        $or: [
          { gender: 'Male' },
          { gender: 'Female', marriedTo: { $exists: false } },
        ],
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'marriedTo',
        foreignField: '_id',
        as: 'partner',
      },
    },
    {
      $unwind: {
        path: '$partner',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $sort: { updatedAt: -1, _id: 1 }
    },
    {
      $skip: numSkip,
    },
    {
      $limit: numLimit,
    },
    {
      $project: {
        _id: 0,
        male: {
          $cond: {
            if: { $eq: ['$gender', 'Male'] },
            then: userSelectMap(),
            else: '$$REMOVE'
          }
        },
        female: {
          $cond: {
            if: { $eq: ['$gender', 'Male'] },
            then: {
              $cond: {
                if: { $eq: ['$partner.gender', 'Female'] },
                then: userSelectMap("partner"),
                else: '$$REMOVE'
              }
            },
            else: userSelectMap()
          }
        }
      }
    }
  ])

  return c.json(marriedUsers)
}

export async function findUser(c: zContext<{ query: typeof findUserSchema }>) {
  const queries: Record<string, any> = c.req.valid("query") || {}

  if (Object.keys(queries).length === 0) {
    return c.json({ message: "No query parameters provided" }, 400)
  }

  const filters = Object.keys(queries).reduce((acc: Record<string, any>, key) => {
    if (key === "fullName") {
      acc[key] = { $regex: queries[key], $options: "i" }
    }
    else if (key === "mobile") {
      acc["contactDetails.mobile"] = queries[key]
    }
    else {
      acc[key] = queries[key]
    }
    return acc
  }, { isMarried: false })

  const user = await User.find(filters)
    .select(userSelect)
    .lean()

  return c.json(user)
}

export async function createUsers(c: zContext<{ json: typeof createUsersSchema }>) {
  const { _id } = c.get("user")
  const users = c.req.valid("json")

  // const payload = await Promise.all(users.map(async (user: any) => {
  //   const hashedPass = await hashPassword(user.password)
  //   return {
  //     ...user,
  //     password: hashedPass,
  //     approvalStatus: "approved",
  //   }
  // }))

  // await User.insertMany(payload)

  // return c.json({ message: "Status updated successfully" })

  const results = []

  for (const user of users) {
    try {
      const hashedPass = await hashPassword(user.password)
      const newUser = new User({
        ...user,
        password: hashedPass,
        approvalStatus: "approved",
        email: user.email || undefined,
        contactDetails: {
          ...user?.contactDetails,
          mobile: user?.contactDetails?.mobile || undefined,
        },
        createdBy: _id,
      })

      const savedUser = await newUser.save()

      results.push({
        _id: savedUser._id,
        email: savedUser.email || undefined,
        mobile: savedUser.contactDetails?.mobile || undefined,
        error: null
      })

    } catch (error: any) {
      results.push({
        _id: null,
        email: user.email || undefined,
        mobile: user?.contactDetails?.mobile || undefined,
        error: error.message
      })
    }
  }

  return c.json({ results })
}

export async function userMarriedTo(c: zContext<{ json: typeof userMarriedToSchema }>) {
  const { _id, marriedTo, marriedOn } = c.req.valid("json")

  const payload: any = [{
    updateOne: {
      filter: { _id },
      update: { $set: { isMarried: true } }
    }
  }]

  if (marriedTo) {
    payload[0].updateOne.update.$set.marriedTo = marriedTo

    payload.push({
      updateOne: {
        filter: { _id: marriedTo },
        update: { $set: { marriedTo: _id, isMarried: true } }
      }
    })
  }

  if (marriedOn) {
    payload[0].updateOne.update.$set.marriedOn = marriedOn
    if (marriedTo) {
      payload[1].updateOne.update.$set.marriedOn = marriedOn
    }
  }

  await User.bulkWrite(payload)

  return c.json({ message: "User married to updated successfully" })
}

export async function updateUser(c: zContext<{ json: typeof updateUserSchema }>) {
  const { _id, ...rest } = c.req.valid("json")

  if (Object.keys(rest).length === 0) {
    return c.json({ message: "No parameters to update" }, 400)
  }

  const user = await User.findOneAndUpdate({ _id }, rest, { new: true })
    .select("role")
    .lean()

  if (user) await redisClient.del(`${user.role}:${_id}`)

  return c.json({ message: "User details updated successfully" })
}
