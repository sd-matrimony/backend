export * from "./enums.js";
export * from "./password.js";
export * from "./token.js";
export * from "./user-filter-obj.js";
export * from "./image-extractor.js";
export * from "./cookie.js";

export function generateOtp() {
  const otp = Math.floor(100000 + Math.random() * 900000)
  console.log(otp)
  return otp
}

export function isEmail(email: string) {
  const emailRegex = /^\S+@\S+\.\S+$/
  return emailRegex.test(email)
}

export const MIN_AGE = 18

export function isValidDob(val: string | Date) {
  const dob = new Date(val)
  const now = new Date()
  const ageDiff = now.getFullYear() - dob.getFullYear()
  const monthDiff = now.getMonth() - dob.getMonth()
  const dayDiff = now.getDate() - dob.getDate()

  const isValid = ageDiff > MIN_AGE ||
    (ageDiff === MIN_AGE && (monthDiff > 0 || (monthDiff === 0 && dayDiff >= 0)))

  return isValid
}