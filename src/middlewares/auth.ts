import { JwtTokenExpired } from 'hono/utils/jwt/types';
import { createMiddleware } from 'hono/factory';

import { tokenEnums, verifyToken, t } from '../utils/index.js';
import { redisClient } from '../services/index.js';
import { Admin, User } from '../models/index.js';

async function getUser(_id: string, role: string): Promise<userVarT | adminVarT | null> {
  const redisKey = `${role}:${_id}`

  let user: any = await redisClient.get(redisKey)
  if (user) return JSON.parse(user)

  if (role === "user") {
    user = await User.findById(_id)
      .select("_id role isBlocked isDeleted currentPlan")
      .populate("currentPlan", "_id subscribedTo expiryDate noOfProfilesCanView")
      .lean()

  } else {
    user = await Admin.findById(_id)
      .select("_id role isDeleted")
      .lean()
  }

  if (user) {
    await redisClient.set(redisKey, JSON.stringify(user), {
      expiration: {
        type: "EX",
        value: 60 * 60 * 24, // 1 day
      }
    })

    return user
  }

  return null
}

const authMiddleware = createMiddleware<any>(async (c, next) => {
  try {
    const token = c.req.header("Authorization")?.replace('Bearer ', '')
    if (!token) return c.json({ message: t(c, 'unauthorized') }, 401)

    const { _id, role, type } = await verifyToken(token, tokenEnums.accessToken)

    if (type !== tokenEnums.accessToken) return c.json({ message: t(c, 'invalidToken') }, 400)

    let user = await getUser(_id as string, role as string)
    if (!user) return c.json({ message: t(c, 'userNotFound') }, 400)

    if (user.isDeleted || (user.role === "user" && user.isBlocked)) return c.json({ message: t(c, 'accessDenied') }, 400)

    c.set("user", user)

    await next()

  } catch (error) {
    if (error instanceof JwtTokenExpired) {
      return c.json({ message: t(c, 'tokenExpired') }, 401)
    }
    return c.json({ message: t(c, 'invalidToken') }, 400)
  }
})

export default authMiddleware
