import type { Context, Next } from "hono";

type rolesT = "user" | "admin" | "super-admin"
export function roleCheck(roles: rolesT[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user')

    if (!roles.includes(user.role)) {
      return c.json({ error: "Access denied" }, 403)
    }

    await next()
  }
}

export default roleCheck
