import type { Context } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';

import { env, tokenEnums, tokenValidity } from './enums.js';

export function setRefreshTokenCookie(c: Context, refresh_token: string) {
  const host = c.req.header("host") || ""
  const baseDomain = host.split('.').slice(-2).join('.')

  const isProduction = env.NODE_ENV === 'production'

  setCookie(c, tokenEnums.refreshToken, refresh_token, {
    httpOnly: true,
    sameSite: isProduction ? "None" : "Lax",
    domain: isProduction ? baseDomain : undefined,
    secure: isProduction,
    maxAge: tokenValidity.refreshToken,
  })
}

export function deleteRefreshTokenCookie(c: Context) {
  const host = c.req.header("host") || ""
  const baseDomain = host.split('.').slice(-2).join('.')

  const isProduction = env.NODE_ENV === 'production'

  deleteCookie(c, tokenEnums.refreshToken, {
    domain: isProduction ? baseDomain : undefined,
  })
}