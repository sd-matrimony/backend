import { Hono } from "hono";

import {
  imgUpload, getUserDetails, getMatches, getLikesList,
  addLiked, removeLiked, updateProfile, imgDelete,
  getPartnerPreferences, getUnlockedProfiles, unlockProfile,
  getCurrentPlan,
} from "../controllers/user.js";

import {
  _idParamSchema, imgUploadSchema, matchedUsersSchema, skipLimitSchema,
  updateProfileSchema, userIdSchema, zv,
} from "../validations/index.js";

const userRoutes = new Hono()

userRoutes
  .get("/matches", zv("query", matchedUsersSchema), getMatches)
  .get("/current-plan", getCurrentPlan)
  .get("/likes-list", zv("query", skipLimitSchema), getLikesList)
  .get("/profile/:_id", zv("param", _idParamSchema), getUserDetails)
  .get("/partner-preferences", getPartnerPreferences)
  .get("/unlocked", getUnlockedProfiles)
  .post("/addliked", zv("json", userIdSchema), addLiked)
  .post("/removeliked", zv("json", userIdSchema), removeLiked)
  .post("/unlock", zv("json", _idParamSchema), unlockProfile)
  .put("/profile", zv("json", updateProfileSchema), updateProfile)
  .put("/images", zv("form", imgUploadSchema), imgUpload)
  .delete("/image/:_id", zv("param", _idParamSchema), imgDelete)

export default userRoutes
