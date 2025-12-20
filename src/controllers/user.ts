import type { Context } from 'hono';

import type { _idParamSchema, imgUploadSchema, matchedUsersSchema, skipLimitSchema, updateProfileSchema, userIdSchema } from '../validations/index.js';
import type { zContext } from '../types/index.js';

import { getImgUrl, deleteImg } from '../services/index.js';
import { UserAccess, User } from '../models/index.js';

import { getFilterObj } from '../utils/index.js';

const userSelectFields = "_id fullName profileImg maritalStatus gender dob proffessionalDetails.highestQualification proffessionalDetails.profession otherDetails.caste otherDetails.subCaste currentPlan isVerified"
const currentPlanSelectFields = "-_id subscribedTo expiryDate"

async function checkUserAccess(user: any, _id: string) {
  const isOwner = user._id.toString() === _id
  if (isOwner || user.role.includes("admin")) return true

  const hasAccess = user.role === "user" && user.currentPlan &&
    new Date(user.currentPlan.expiryDate).getTime() > new Date().getTime()
  if (!hasAccess) return false

  const hasUnlockedAccess = await UserAccess.findOne({
    viewer: user._id,
    viewed: _id,
    payment: user.currentPlan._id,
  }).select("_id").lean()

  return !!hasUnlockedAccess
}

export const getUserDetails = async (c: zContext<{ param: typeof _idParamSchema }>) => {
  const { _id } = c.req.valid("param")
  const user = c.get("user")

  const hasFullAccess = await checkUserAccess(user, _id)

  let select = "-refreshTokens -password -liked -verifiyOtp -role -brokerAppointed -approvalStatus -email"

  if (!hasFullAccess) {
    select += " -contactDetails -vedicHoroscope.vedicHoroscopePic -vedicHoroscope.nakshatra -vedicHoroscope.rasi -vedicHoroscope.lagna"
  }

  const userDetails = await User.findOne({ _id })
    .select(select)
    .populate("currentPlan", currentPlanSelectFields)
    .lean()

  if (user.role === "user" && user._id !== _id && userDetails?.otherDetails?.caste === "14 oor kaikolar mudaliyar") {
    userDetails.contactDetails = {
      ...userDetails?.contactDetails,
      mobile: "restricted",
    }
  }

  return c.json({ ...userDetails, hasFullAccess })
}

export const getCurrentPlan = async (c: Context<Env>) => {
  const { _id } = c.get("user")

  const user = await User.findById(_id)
    .select("email currentPlan")
    .populate("currentPlan", "amount subscribedTo expiryDate noOfProfilesCanView isAssisted assistedMonths createdAt")
    .lean()

  const unlockedCount = await UserAccess.countDocuments({
    viewer: user?._id,
    payment: user?.currentPlan?._id
  })

  const payload = {
    ...(user?.currentPlan || {}),
    unlockedCount,
  }

  return c.json(payload)
}

export const getPartnerPreferences = async (c: Context<Env>) => {
  const { _id } = c.get("user")

  const user = await User.findById(_id)
    .select("partnerPreferences otherDetails.caste dob")
    .lean()

  const payload = {
    ...user?.partnerPreferences,
    caste: user?.partnerPreferences?.caste || (user?.otherDetails?.caste === "Don't wish to specify" ? "Any" : user?.otherDetails?.caste),
    dob: user?.dob,
  }

  return c.json(payload)
}

export const getMatches = async (c: zContext<{ query: typeof matchedUsersSchema }>) => {
  const { limit, skip, ...rest } = c.req.valid("query") || { limit: 10, skip: 0 }
  const { _id } = c.get("user")

  const numLimit = Number(limit || 10)
  const numSkip = Number(skip || 0)

  const user = await User.findById(_id)
    .select("-refreshTokens -images -verifiyOtp -role -brokerAppointed")
    .lean()
  const payload: any = {}

  if (user?.gender === "Male") {
    payload.gender = "Female" // ["Female", "Other"]
  }
  else if (user?.gender === "Female") {
    payload.gender = "Male" // ["Female", "Other"]
  }

  const filters = getFilterObj({ ...rest, ...payload, })

  const liked = user?.liked || []

  const baseFilters = { ...filters, _id: { $ne: _id } }
  const select = userSelectFields.split(" ").reduce((acc, field) => ({ ...acc, [field]: 1 }), {})
  const final = await User.aggregate([
    { $match: baseFilters },
    { $skip: numSkip },
    { $limit: numLimit },
    { $project: select },
    {
      $lookup: {
        from: "payments",
        localField: "currentPlan",
        foreignField: "_id",
        as: "currentPlan",
        pipeline: [{
          $project: {
            _id: 0,
            subscribedTo: 1,
            expiryDate: 1,
          }
        }],
      }
    },
    {
      $unwind: {
        path: "$currentPlan",
        preserveNullAndEmptyArrays: true,
      }
    },
    {
      $addFields: {
        isLiked: {
          $in: ["$_id", liked]
        },
      }
    }
  ])

  return c.json(final)
}

export const getLikesList = async (c: zContext<{ query: typeof skipLimitSchema }>) => {
  const { limit, skip } = c.req.valid("query") || { limit: 10, skip: 0 }
  const { _id } = c.get("user")

  const numLimit = Number(limit || 10)
  const numSkip = Number(skip || 0)

  const type = 'liked'
  const list = await User.findOne({ _id })
    .select(type)
    .populate({
      path: type,
      select: userSelectFields,
      options: {
        limit: numLimit,
        skip: numSkip,
      },
      populate: {
        path: "currentPlan",
        select: currentPlanSelectFields,
      },
    })
    .lean()

  // @ts-ignore
  return c.json(list?.[type] || [])
}

export const getUnlockedProfiles = async (c: Context<Env>) => {
  const { _id, currentPlan } = c.get("user") as userVarT

  if (!currentPlan) return c.json([])

  const list = await UserAccess.find({ viewer: _id, payment: currentPlan._id })
    .select("viewed")
    .populate({
      path: "viewed",
      select: userSelectFields,
      populate: {
        path: "currentPlan",
        select: currentPlanSelectFields,
      },
    })
    .lean()

  const payload = list.map((item) => item.viewed)

  return c.json(payload)
}

export const addLiked = async (c: zContext<{ json: typeof userIdSchema }>) => {
  const { userId } = c.req.valid("json")
  const { _id } = c.get("user")

  const type = "liked"
  const updateObj: any = { $push: { [type]: userId } }
  // const otherType = type === "liked" ? "disliked" : "liked"
  // updateObj.$pull = { [otherType]: userId }
  await User.updateOne({ _id }, updateObj)
  return c.json({ message: `User added to ${type} list successfully` })
}

export const removeLiked = async (c: zContext<{ json: typeof userIdSchema }>) => {
  const { userId } = c.req.valid("json")
  const { _id } = c.get("user")

  const type = "liked"
  await User.updateOne({ _id }, { $pull: { [type]: userId } })
  return c.json({ message: `User removed from ${type} list successfully` })
}

export const updateProfile = async (c: zContext<{ json: typeof updateProfileSchema }>) => {
  const payload = c.req.valid("json")
  const user = c.get("user")

  const _id = user.role === "user" ? user._id : payload._id
  await User.updateOne({ _id }, payload)

  return c.json({ message: "User details updated successfully" })
}

export const imgUpload = async (c: zContext<{ form: typeof imgUploadSchema }>) => {
  const formData = c.req.valid("form")
  const user = c.get('user')

  const isProfilePic = formData.isProfilePic
  const images = formData.images

  const uploadedImages = await Promise.all(images.map(async (image) => await getImgUrl(image)))

  const updateQuery: any = {
    $push: {
      images: { $each: uploadedImages }
    }
  }

  if (isProfilePic) {
    updateQuery.profileImg = uploadedImages[0]
  }

  const _id = user.role === "user" ? user._id : formData._id
  await User.updateOne({ _id }, updateQuery)

  return c.json({ message: 'User image uploaded successfully' })
}

export const imgDelete = async (c: zContext<{ param: typeof _idParamSchema }>) => {
  const { _id } = c.req.valid("param")
  await deleteImg(_id)
  return c.json({ message: 'Image deleted successfully' })
}

export const unlockProfile = async (c: zContext<{ json: typeof _idParamSchema }>) => {
  const { _id } = c.req.valid("json")
  const user = c.get("user") as userVarT

  const hasFullAccess = await checkUserAccess(user, _id)
  if (hasFullAccess) return c.json({ message: "You have full access to this profile already" })

  if (user.currentPlan.noOfProfilesCanView !== 999) {
    const unlockedCount = await UserAccess.countDocuments({
      viewer: user._id,
      payment: user.currentPlan._id
    })

    if (unlockedCount >= user.currentPlan.noOfProfilesCanView) return c.json({ message: "You have reached the limit of unlocked profiles" }, 400)
  }

  await UserAccess.create({
    viewer: user._id,
    viewed: _id,
    payment: user.currentPlan._id,
    expiresAt: new Date(user.currentPlan.expiryDate),
  })

  return c.json({ message: "Profile unlocked successfully" })
}
