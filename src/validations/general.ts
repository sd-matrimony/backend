import { z } from 'zod';

import educationLevels from "../assets/v1/education-levels.json" with { type: "json" };
import nakshatra from "../assets/v1/nakshatra.json" with { type: "json" };
import raasi from "../assets/v1/raasi.json" with { type: "json" };

import { approvalStatuses, genders, maritalStatuses, plans, roles } from '../utils/enums.js';
import { MIN_AGE, isValidDob } from '../utils/index.js';

export const approvalStatusEnum = z.enum(approvalStatuses, { error: "Invalid Approval Status" })
export const maritalStatusEnum = z.enum(maritalStatuses, { error: "Invalid Marital Status" })
export const educationEnum = z.enum(["Any", ...educationLevels], { error: "Invalid Education" })
export const genderEnum = z.enum(genders, { error: "Invalid Gender" })
export const roleEnum = z.enum(roles, { error: "Invalid Role" })
export const planEnum = z.enum(plans, { error: "Invalid Plan" })

export const nakshatraEnum = z.enum(["Don't wish to specify", ...nakshatra.map(e => e.split(" (")[0])], { error: "Invalid Nakshatra" })
export const rasiEnum = z.enum(["Don't wish to specify", ...raasi.map(e => e.split(" (")[0])], { error: "Invalid Rasi/Lagna" })

export const emailSchema = z.email("Invalid email address")
export const mobileSchema = z.string().regex(/^\d{10}$/, "Must be a valid 10-digit number")
export const emailOrMobileSchema = z.union([emailSchema, mobileSchema], { error: "Please enter valid email or mobile number" })

export const ageRangeEnum = z.enum(["below_25", "25_30", "30_40", "above_40"], "Invalid Age Range")
export const salaryRangeEnum = z.enum(["below_20000", "20000_30000", "30000_40000", "40000_50000", "above_50000"], "Invalid Salary Range")

export const passwordSchema = z.string("Password is required")
  .min(6, "Password must be at least 6 characters")
  .max(18, "Password must be at most 18 characters")

export const professionalDetailsSchema = z.object({
  highestQualification: educationEnum,
  qualifications: z.string("Qualifications is required"),
  companyName: z.string().optional(),
  profession: z.string("Profession is required"),
  sector: z.string("Sector is required"),
  salary: z.number("Salary is required").min(0, "Salary must be at least 0"),
}, { error: "Professional details are required" })
  .refine(
    (data) =>
      !(data.profession === "Unemployed" && data.sector === "Unemployed") ||
      data.salary === 0,
    {
      path: ["salary"],
      error: "Salary must be 0 when unemployed",
    }
  )
  .refine(
    (data) =>
      data.sector === "Unemployed" || data.profession !== "Unemployed",
    {
      path: ["profession"],
      error: "Profession cannot be Unemployed if sector is not Unemployed",
    }
  )
  .refine(
    (data) =>
      data.profession === "Unemployed" && data.sector === "Unemployed"
        ? true :
        !!data.companyName?.trim(),
    {
      path: ["companyName"],
      error: "Company Name is required"
    }
  )

export const familyDetailsSchema = z.object({
  fatherName: z.string("Father's name is required").min(2, "Father's name must be at least 2 characters"),
  motherName: z.string("Mother's name is required").min(2, "Mother's name must be at least 2 characters"),
  noOfBrothers: z.number("Number of brothers is required").min(0, "Cannot be negative").default(0),
  noOfSisters: z.number("Number of sisters is required").min(0, "Cannot be negative").default(0),
  birthOrder: z.number("Birth order is required").min(1, "Birth order must be at least 1").default(1),
  isFatherAlive: z.boolean("Father's status is required").default(true),
  isMotherAlive: z.boolean("Mother's status is required").default(true),
}, { error: "Family details are required" })

export const vedicHoroscopeSchema = z.object({
  rasi: rasiEnum.optional(),
  lagna: rasiEnum.optional(),
  nakshatra: nakshatraEnum.optional(),
  dashaPeriod: z.string().optional(),
  placeOfBirth: z.string().optional(),
  timeOfBirth: z.string().optional(),
  vedicHoroscopePic: z.union([z.url(), z.literal("")]).optional(),
  dosham: z.string().optional(),
}).optional()

export const otherDetailsSchema = z.object({
  motherTongue: z.string().optional(),
  houseType: z.string().optional(),
  religion: z.string().optional(),
  height: z.preprocess(val => !val ? undefined : val, z.coerce.number().optional()).optional(),
  color: z.string().optional(),
  caste: z.string().optional(),
  subCaste: z.string().optional(),
}).optional()

export const partnerPreferencesSchema = z.object({
  minAge: z.preprocess(val => !val ? undefined : val, z.coerce.number().min(18, "Minimum age must be at least 18").optional()).optional(),
  maxAge: z.preprocess(val => !val ? undefined : val, z.coerce.number().min(18, "Maximum age must be at least 18").optional()).optional(),
  minQualification: educationEnum.optional(),
  sector: z.string().optional(),
  profession: z.string().optional(),
  minSalary: z.preprocess(val => !val ? undefined : val, z.coerce.number().optional()).optional(),
  religion: z.string().optional(),
  caste: z.string().optional(),
  subCaste: z.string().optional(),
  motherTongue: z.string().optional(),
  location: z.string().optional(),
  expectation: z.string().optional(),
  maritalStatus: maritalStatusEnum.optional(),
})
  .refine(
    (data) =>
      (typeof data.minAge === "number" && typeof data.maxAge === "number")
        ? data.minAge < data.maxAge
        : true,
    {
      error: "Minimum age must be less than maximum age",
      path: ["minAge"],
    }
  ).refine(
    (data) =>
      (typeof data.minAge === "number" && typeof data.maxAge === "number")
        ? data.minAge !== data.maxAge
        : true,
    {
      error: "Minimum age and maximum age should not be equal",
      path: ["minAge"],
    }
  )
  .optional()

export const userSchema = z.object({
  dob: z.iso.datetime(),
  gender: genderEnum,
  role: z.literal("user"),
  email: emailSchema.optional(),
  images: z.array(z.url()).optional(),
  password: passwordSchema,
  fullName: z.string("Name is required").min(3, "Name must be at least 3 characters"),
  profileImg: z.union([z.url(), z.literal("")]).optional(),
  otherDetails: otherDetailsSchema,
  maritalStatus: maritalStatusEnum,
  familyDetails: familyDetailsSchema,
  vedicHoroscope: vedicHoroscopeSchema,
  partnerPreferences: partnerPreferencesSchema,
  proffessionalDetails: professionalDetailsSchema,
  contactDetails: z.object({
    mobile: mobileSchema.optional(),
    address: z.string().optional(),
  }).optional(),
})
  .refine(
    (data) => !!data.email || !!data.contactDetails?.mobile,
    {
      message: "Either email or mobile is required",
      path: ["email"],
    }
  )
  .refine(
    (data) => isValidDob(data.dob),
    {
      message: `User must be at least ${MIN_AGE} years old`,
      path: ["dob"],
    }
  )

export const adminSchema = z.object({
  role: z.literal("admin"),
  email: emailSchema.optional(),
  password: passwordSchema,
  fullName: z.string("Name is required").min(3, "Name must be at least 3 characters"),
  contactDetails: z.object({
    mobile: mobileSchema.optional(),
    address: z.string().optional(),
  }).optional(),
})
  .refine(
    (data) => !!data.email || !!data.contactDetails?.mobile,
    {
      message: "Either email or mobile is required",
      path: ["email"],
    }
  )

export const skipLimitSchema = z.object({
  skip: z.coerce.number().optional().default(0),
  limit: z.coerce.number().optional().default(10),
}).optional()

export const _idParamSchema = z.object({
  _id: z.string("ID is required"),
})

const acceptedImages = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/avif"]
const maxSize = 5 * 1024 * 1024

export const imgFileSchema = z.instanceof(File, { message: "Please upload a valid image" })
  .refine(file => acceptedImages.includes(file.type), {
    message: "Only .jpg, .jpeg, .png, .webp, .avif formats are supported"
  })
  .refine(file => file.size <= maxSize, {
    message: "Max file size is 5MB"
  })
