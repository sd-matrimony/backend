import { z } from "zod";

import { adminSchema, approvalStatusEnum, passwordSchema, planEnum } from "./general.js";

export const usersGroupedByAdminCountSchema = z.object({
  type: z.enum(["date", "caste"], { error: "Type must be either date or caste" }).default("date").optional(),
})

export const usersGroupedCountSchema = z.object({
  date: z.string({ error: "Date is required" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  caste: z.string().optional(),
})

export const usersGroupedListSchema = usersGroupedCountSchema.safeExtend({
  skip: z.coerce.number().optional().default(0),
  limit: z.coerce.number().optional().default(50),
  createdBy: z.string().optional(),
})

export const usersCreatedBySchema = z.object({
  skip: z.coerce.number().optional().default(0),
  limit: z.coerce.number().optional().default(50),
  createdAtToday: z.coerce.boolean().optional(),
  createdBy: z.string().optional(),
}).optional()

export const adminCreateSchema = adminSchema
  .omit({ role: true })
  .safeExtend({
    role: z.literal("admin").optional(),
  })
  .refine(
    (data) => !!data.email || !!data.contactDetails?.mobile,
    {
      message: "Either email or mobile is required",
      path: ["email"],
    }
  )

export const adminUpdateSchema = adminSchema
  .omit({ role: true, password: true })
  .safeExtend({
    role: z.literal("admin").optional(),
    password: passwordSchema.optional(),
    approvalStatus: approvalStatusEnum.optional(),
    isDeleted: z.boolean().optional(),
  })

export const resetPassByAdminSchema = z.object({
  password: passwordSchema,
})

export const mkePaymentSchema = z.object({
  _id: z.string("ID is required"),
  amount: z.number("Amount is required"),
  subscribedTo: planEnum,
  noOfProfilesCanView: z.number("Number of profiles is required"),
  isAssisted: z.boolean("Is assisted is required"),
  assistedMonths: z.number("Assisted months is required"),
})
