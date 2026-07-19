import { Hono } from "hono";

import {
  getPaidUsers, getAssistedSubscribedUsers, getUsersAllPayments,
  getUsersByCreatedBy, getUsersGroupedByAdminCount, getUsersGroupedList,
  getUsersGroupedCount, getAdmins, createAdmin,
  updateAdmin, getUsersInvitations, updateInvited, resetPass,
  makePaymentForUser, bulkUpdateUsers, getUserCurrentPlan, removeUserPlan,
  updateUserCritical,
} from "../controllers/super-admin.js";

import {
  skipLimitSchema, adminCreateSchema, adminUpdateSchema, usersCreatedBySchema,
  _idParamSchema, zv, usersGroupedCountSchema, usersGroupedByAdminCountSchema,
  usersGroupedListSchema, findUsersSchema, resetPassByAdminSchema,
  mkePaymentSchema, bulkUpdateUsersSchema, updateUserCriticalSchema,
} from "../validations/index.js";

import roleCheck from "../middlewares/role-check.js";

const superAdminRoutes = new Hono()

superAdminRoutes.use(roleCheck(["super-admin"]))

superAdminRoutes
  .get("/users/paid", zv("query", skipLimitSchema), getPaidUsers)
  .get("/users/assisted-subscribed", zv("query", skipLimitSchema), getAssistedSubscribedUsers)
  .get("/users/all-payments", zv("query", skipLimitSchema), getUsersAllPayments)
  .get("/users/created-by", zv("query", usersCreatedBySchema), getUsersByCreatedBy)
  .get("/users/grouped-by-admin/count", zv("query", usersGroupedByAdminCountSchema), getUsersGroupedByAdminCount)
  .get("/users/grouped/count", zv("query", usersGroupedCountSchema), getUsersGroupedCount)
  .get("/users/grouped/list", zv("query", usersGroupedListSchema), getUsersGroupedList)
  .get("/users/invitations", zv("query", findUsersSchema), getUsersInvitations)
  .get("/user/:_id/plan", zv("param", _idParamSchema), getUserCurrentPlan)
  .delete("/user/:_id/plan", zv("param", _idParamSchema), removeUserPlan)
  .get("/admins", getAdmins)
  .post("/admin", zv("json", adminCreateSchema), createAdmin)
  .post("/user/payment", zv("json", mkePaymentSchema), makePaymentForUser)
  .put("/admin/:_id", zv("param", _idParamSchema), zv("json", adminUpdateSchema), updateAdmin)
  .put("/user/password/:_id", zv("param", _idParamSchema), zv("json", resetPassByAdminSchema), resetPass)
  .put("/user/invite/:_id", zv("param", _idParamSchema), updateInvited)
  .put("/user/critical/:_id", zv("param", _idParamSchema), zv("json", updateUserCriticalSchema), updateUserCritical)
  .put("/users/bulk", zv("json", bulkUpdateUsersSchema), bulkUpdateUsers)

export default superAdminRoutes
