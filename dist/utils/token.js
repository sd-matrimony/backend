import { sign, verify } from "hono/jwt";
import { env, tokenEnums, tokenValidity } from "./enums.js";
export async function getToken(data, type) {
    const secret = type === tokenEnums.accessToken ? env.ACCESS_TOKEN_SECRET : env.REFRESH_TOKEN_SECRET;
    const payload = {
        type,
        exp: Math.floor(Date.now() / 1000) + tokenValidity[type],
        ...data,
    };
    return await sign(payload, secret);
}
export async function verifyToken(token, type) {
    const secret = type === tokenEnums.accessToken ? env.ACCESS_TOKEN_SECRET : env.REFRESH_TOKEN_SECRET;
    return verify(token, secret);
}
