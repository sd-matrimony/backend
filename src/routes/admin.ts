import { Hono } from "hono";

import {
  createUsers, getUsers, getMarriedUsers,
  updateUser, userMarriedTo, findUser,
} from "../controllers/admin.js";

import {
  findUsersSchema, findUserSchema, skipLimitSchema,
  createUsersSchema, userMarriedToSchema, updateUserSchema,
  zv,
} from "../validations/index.js";

import roleCheck from "../middlewares/role-check.js";

const adminRoutes = new Hono()

adminRoutes.use(roleCheck(["admin", "super-admin"]))

adminRoutes
  .get("/users", zv("query", findUsersSchema), getUsers)
  .get("/users/married", zv("query", skipLimitSchema), getMarriedUsers)
  .get("/user/find", zv("query", findUserSchema), findUser)
  .post("/users", zv("json", createUsersSchema), createUsers)
  .post("/user/married-to", zv("json", userMarriedToSchema), userMarriedTo)
  .put("/user", zv("json", updateUserSchema), updateUser)

export default adminRoutes
