import { Hono } from "hono";
import { imgUpload, getUserDetails, getMatches, getLikesList, addLiked, removeLiked, updateProfile, imgDelete, getPartnerPreferences, getUnlockedProfiles, unlockProfile, getCurrentPlan, getHiddenList, hideProfile, unhideProfile, getMyPayments, } from "../controllers/user.js";
import { _idParamSchema, imgUploadSchema, matchedUsersSchema, skipLimitSchema, updateProfileSchema, userIdSchema, hideProfileSchema, imgDeleteSchema, zv, } from "../validations/index.js";
const userRoutes = new Hono();
userRoutes
    .get("/matches", zv("query", matchedUsersSchema), getMatches)
    .get("/current-plan", getCurrentPlan)
    .get("/payments", getMyPayments)
    .get("/likes-list", zv("query", skipLimitSchema), getLikesList)
    .get("/profile/:_id", zv("param", _idParamSchema), getUserDetails)
    .get("/partner-preferences", getPartnerPreferences)
    .get("/unlocked", getUnlockedProfiles)
    .get("/hidden-list", zv("query", skipLimitSchema), getHiddenList)
    .post("/addliked", zv("json", userIdSchema), addLiked)
    .post("/removeliked", zv("json", userIdSchema), removeLiked)
    .post("/hide", zv("json", hideProfileSchema), hideProfile)
    .post("/unhide", zv("json", hideProfileSchema), unhideProfile)
    .post("/unlock", zv("json", _idParamSchema), unlockProfile)
    .put("/profile", zv("json", updateProfileSchema), updateProfile)
    .put("/images", zv("form", imgUploadSchema), imgUpload)
    .delete("/image", zv("json", imgDeleteSchema), imgDelete);
export default userRoutes;
