import { z } from "zod";

import {
  approvalStatusEnum, educationEnum, emailSchema, genderEnum,
  maritalStatusEnum, mobileSchema, nakshatraEnum, rasiEnum,
  userSchema, ageRangeEnum, salaryRangeEnum,
} from "./general.js";
import { enumQuery } from "./custom-validate.js";

export const findUsersSchema = z.object({
  skip: z.coerce.number().optional().default(0),
  limit: z.coerce.number().optional().default(10),
  fullName: z.string().optional(),
  minAge: z.coerce.number().optional(),
  maxAge: z.coerce.number().optional(),
  sector: z.string().optional(),
  createdBy: z.string().optional(),
  isBlocked: z.coerce.boolean().optional(),
  isDeleted: z.coerce.boolean().optional(),
  isMarried: z.coerce.boolean().optional(),
  profession: z.string().optional(),
  minSalary: z.coerce.number().optional(),
  ageRange: ageRangeEnum.optional(),
  salaryRange: salaryRangeEnum.optional(),
  rasi: enumQuery(rasiEnum).optional(),
  lagna: enumQuery(nakshatraEnum).optional(),
  caste: enumQuery(z.string()).optional(),
  subCaste: enumQuery(z.string()).optional(),
  gender: enumQuery(genderEnum).optional(),
  religion: enumQuery(z.string()).optional(),
  motherTongue: enumQuery(z.string()).optional(),
  maritalStatus: enumQuery(maritalStatusEnum).optional(),
  approvalStatus: enumQuery(approvalStatusEnum).optional(),
  minQualification: educationEnum.optional(),
})
  .refine((data) => {
    if (data.minAge && data.maxAge && data.minAge > data.maxAge) {
      return false
    }
    return true
  }, {
    message: "Minimum age must be less than maximum age",
    path: ["minAge"],
  })
  .optional()

export const findUserSchema = z.object({
  _id: z.string().optional(),
  email: emailSchema.optional(),
  gender: genderEnum.optional(),
  fullName: z.string().optional(),
  mobile: mobileSchema.optional(),
}).optional()

export const createUsersSchema = z.array(userSchema).min(1, "At least one user is required")

export const userMarriedToSchema = z.object({
  _id: z.string("User ID is required"),
  marriedTo: z.string().optional(),
  marriedOn: z.iso.datetime("Invalid Date").optional(),
})

export const updateUserSchema = userSchema
  .omit({
    email: true,
    password: true,
    role: true,
  })
  .partial()
  .safeExtend({
    _id: z.string("User ID is required"),
    approvalStatus: approvalStatusEnum.optional(),
    isBlocked: z.coerce.boolean().optional(),
    isDeleted: z.coerce.boolean().optional(),
    isMarried: z.coerce.boolean().optional(),
  })
