import { sign, verify } from "hono/jwt";

import { env, tokenEnums, tokenValidity, type token_types } from "./enums.js";

export async function getToken(data: Record<string, string | number | boolean>, type: token_types) {
  const secret = type === tokenEnums.accessToken ? env.ACCESS_TOKEN_SECRET : env.REFRESH_TOKEN_SECRET

  const payload = {
    type,
    exp: Math.floor(Date.now() / 1000) + tokenValidity[type],
    ...data,
  }

  return await sign(payload, secret)
}

export async function verifyToken(token: string, type: token_types) {
  const secret = type === tokenEnums.accessToken ? env.ACCESS_TOKEN_SECRET : env.REFRESH_TOKEN_SECRET

  return verify(token, secret)
}
