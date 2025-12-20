import { z } from 'zod';

import {
  adminSchema, emailOrMobileSchema, imgFileSchema,
  passwordSchema, roleEnum, userSchema,
  emailSchema, mobileSchema,
} from './general.js';
import { tokenEnums } from '../utils/enums.js';

export const loginSchema = z.object({
  email: emailOrMobileSchema,
  password: passwordSchema,
  role: roleEnum.optional(),
})

export const registerSchema = z.discriminatedUnion("role", [
  userSchema,
  adminSchema
])

export const refreshTokenSchema = z.object({
  [tokenEnums.refreshToken]: z.string("Refresh token is required"),
})

export const forgotPassSchema = z.object({
  email: emailOrMobileSchema,
  role: roleEnum.optional(),
})

export const resetPassSchema = z.object({
  email: emailOrMobileSchema,
  password: passwordSchema,
  otp: z.number("OTP is required")
    .refine((val) => val.toString().length === 6, {
      error: "OTP must be exactly 6 digits",
    }),
  role: roleEnum.optional(),
})

export const registerImageSchema = z.object({
  image: imgFileSchema,
})

export const verifyAccountSchema = z.object({
  token: z.string("Token is required"),
})

export const updatePasswordSchema = z.object({
  oldPassword: passwordSchema,
  newPassword: passwordSchema,
}).refine(
  (data) => data.oldPassword !== data.newPassword,
  {
    message: "New password should be different from old password",
    path: ["newPassword"],
  }
)

export const resendVerifyEmailSchema = z.object({
  email: emailOrMobileSchema,
})

export const emailSchemaObj = z.object({
  email: emailSchema
})

export const mobileSchemaObj = z.object({
  mobile: mobileSchema
})
