import type { Context } from "hono";

export const locales = ["en", "ta"] as const;
export type Locale = (typeof locales)[number];

export function getLocale(c: Context): Locale {
  const header = c.req.header("x-locale");
  return header === "ta" ? "ta" : "en";
}

const en = {
  tooManyRequests: "Too many requests",
  unauthorized: "Unauthorized",
  invalidToken: "Invalid token",
  userNotFound: "User not found",
  accessDenied: "Access denied",
  tokenExpired: "Token expired",
  fileNotFound: "File not found",
  routeNotFound: "Route not found",
  devOnlyRoute: "This route is only available in development mode",
  migrationDone: "Migration done",

  emailOrMobileExists: "Email or Mobile number already exists",
  userSaved: "User saved successfully",
  cannotFindUser: "Cannot find user in db",
  passwordNotMatched: "Password not matched",
  invalidRefreshToken: "Invalid refresh token or User not found",
  passkeySent: "Passkey sent to email successfully",
  passwordEmpty: "Password shouldn't be empty",
  otpNotMatched: "OTP not matched",
  passwordReset: "Password reseted successfully",
  verificationEmailSent: "Verification email sent successfully",
  accountNotApproved: "Account not approved yet",
  accountRejected: "Account rejected",
  samePassword: "New password should be different from old password",
  passwordUpdated: "Password updated successfully",
  loggedOut: "User logged out successfully",
  emailExists: "Email already exists",
  emailUpdated: "Email updated successfully",
  mobileExists: "Mobile number already exists",
  mobileUpdated: "Mobile number updated successfully",

  noQueryParams: "No query parameters provided",
  marriedToUpdated: "User married to updated successfully",
  noParamsToUpdate: "No parameters to update",
  userDetailsUpdated: "User details updated successfully",

  userImageUploaded: "User image uploaded successfully",
  imageDeleted: "Image deleted successfully",
  alreadyFullAccess: "You have full access to this profile already",
  unlockLimitReached: "You have reached the limit of unlocked profiles",
  profileUnlocked: "Profile unlocked successfully",

  subscriptionRemoved: "Subscription removed successfully",
  userInvited: "User invited successfully",
  adminExists: "Admin already exists",
  adminCreated: "Admin created successfully",
  adminDetailsUpdated: "Admin details updated successfully",
  adminPasswordReset: "Password reset successfully",

  likedAdded: "User added to liked list successfully",
  likedRemoved: "User removed from liked list successfully",
  bulkUsersUpdated: "{count} user(s) updated successfully",
  orderCompleted: "Order with id {orderId} completed successfully",
  internalServerError: "Internal server error",
} as const;

export type MessageKey = keyof typeof en;

const ta: Record<MessageKey, string> = {
  tooManyRequests: "அதிக கோரிக்கைகள். சிறிது நேரம் கழித்து முயற்சிக்கவும்.",
  unauthorized: "அங்கீகாரம் இல்லை",
  invalidToken: "தவறான டோக்கன்",
  userNotFound: "பயனர் கிடைக்கவில்லை",
  accessDenied: "அணுகல் மறுக்கப்பட்டது",
  tokenExpired: "டோக்கன் காலாவதியானது",
  fileNotFound: "கோப்பு கிடைக்கவில்லை",
  routeNotFound: "பாதை கிடைக்கவில்லை",
  devOnlyRoute: "இந்த பாதை டெவலப்மென்ட் பயன்முறையில் மட்டுமே கிடைக்கும்",
  migrationDone: "மைக்ரேஷன் முடிந்தது",

  emailOrMobileExists: "மின்னஞ்சல் அல்லது கைபேசி எண் ஏற்கனவே உள்ளது",
  userSaved: "பயனர் வெற்றிகரமாக சேமிக்கப்பட்டார்",
  cannotFindUser: "பயனர் கிடைக்கவில்லை",
  passwordNotMatched: "கடவுச்சொல் பொருந்தவில்லை",
  invalidRefreshToken: "தவறான ரிஃப்ரெஷ் டோக்கன் அல்லது பயனர் இல்லை",
  passkeySent: "பாஸ்கீ மின்னஞ்சலுக்கு அனுப்பப்பட்டது",
  passwordEmpty: "கடவுச்சொல் காலியாக இருக்கக்கூடாது",
  otpNotMatched: "OTP பொருந்தவில்லை",
  passwordReset: "கடவுச்சொல் மீட்டமைக்கப்பட்டது",
  verificationEmailSent: "சரிபார்ப்பு மின்னஞ்சல் அனுப்பப்பட்டது",
  accountNotApproved: "கணக்கு இன்னும் அங்கீகரிக்கப்படவில்லை",
  accountRejected: "கணக்கு நிராகரிக்கப்பட்டது",
  samePassword: "புதிய கடவுச்சொல் பழையதிலிருந்து வேறுபட்டிருக்க வேண்டும்",
  passwordUpdated: "கடவுச்சொல் புதுப்பிக்கப்பட்டது",
  loggedOut: "வெற்றிகரமாக வெளியேறியது",
  emailExists: "மின்னஞ்சல் ஏற்கனவே உள்ளது",
  emailUpdated: "மின்னஞ்சல் புதுப்பிக்கப்பட்டது",
  mobileExists: "கைபேசி எண் ஏற்கனவே உள்ளது",
  mobileUpdated: "கைபேசி எண் புதுப்பிக்கப்பட்டது",

  noQueryParams: "கோரிக்கை அளவுருக்கள் வழங்கப்படவில்லை",
  marriedToUpdated: "திருமண தகவல் புதுப்பிக்கப்பட்டது",
  noParamsToUpdate: "புதுப்பிக்க அளவுருக்கள் இல்லை",
  userDetailsUpdated: "பயனர் விவரங்கள் புதுப்பிக்கப்பட்டன",

  userImageUploaded: "படம் பதிவேற்றப்பட்டது",
  imageDeleted: "படம் நீக்கப்பட்டது",
  alreadyFullAccess: "இந்த சுயவிவரத்திற்கு ஏற்கனவே முழு அணுகல் உள்ளது",
  unlockLimitReached: "திறக்கப்பட்ட சுயவிவரங்களின் வரம்பை எட்டிவிட்டீர்கள்",
  profileUnlocked: "சுயவிவரம் திறக்கப்பட்டது",

  subscriptionRemoved: "சந்தா நீக்கப்பட்டது",
  userInvited: "பயனர் அழைக்கப்பட்டார்",
  adminExists: "நிர்வாகி ஏற்கனவே உள்ளார்",
  adminCreated: "நிர்வாகி உருவாக்கப்பட்டார்",
  adminDetailsUpdated: "நிர்வாகி விவரங்கள் புதுப்பிக்கப்பட்டன",
  adminPasswordReset: "கடவுச்சொல் மீட்டமைக்கப்பட்டது",

  likedAdded: "பயனர் பிடித்தவை பட்டியலில் சேர்க்கப்பட்டார்",
  likedRemoved: "பயனர் பிடித்தவை பட்டியலிலிருந்து நீக்கப்பட்டார்",
  bulkUsersUpdated: "{count} பயனர்(கள்) புதுப்பிக்கப்பட்டனர்",
  orderCompleted: "ஆர்டர் ஐடி {orderId} வெற்றிகரமாக முடிந்தது",
  internalServerError: "உள் சேவையக பிழை",
};

const messages: Record<Locale, Record<MessageKey, string>> = { en, ta };

export function t(c: Context, key: MessageKey): string {
  return messages[getLocale(c)][key];
}

export function tf(c: Context, key: MessageKey, vars: Record<string, string | number>): string {
  let str: string = messages[getLocale(c)][key]
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(`{${k}}`, String(v))
  }
  return str
}

const staticEn = {
  minMaxAge: "Minimum age must be less than maximum age",
  minMaxAgeEqual: "Minimum age and maximum age should not be equal",
  emailOrMobileRequired: "Either email or mobile is required",
  emailMobileSalaryRequired: "At least one of email, mobile or salary is required",
  invalidImage: "Please upload a valid image",
  unsupportedImageFormat: "Only .jpg, .jpeg, .png, .webp, .avif formats are supported",
  maxFileSize: "Max file size is 5MB",
  createdFromToDate: "Created from date must be before created to date",
  samePasswordValidation: "New password should be different from old password",
  otpDigits: "OTP must be exactly 6 digits",
  invalidApprovalStatus: "Invalid Approval Status",
  invalidMaritalStatus: "Invalid Marital Status",
  invalidEducation: "Invalid Education",
  invalidGender: "Invalid Gender",
  invalidRole: "Invalid Role",
  invalidPlan: "Invalid Plan",
  invalidNakshatra: "Invalid Nakshatra",
  invalidRasi: "Invalid Rasi/Lagna",
  invalidEmailOrMobile: "Please enter valid email or mobile number",
  professionalDetailsRequired: "Professional details are required",
  salaryMustBeZero: "Salary must be 0 when unemployed",
  professionCannotBeUnemployed: "Profession cannot be Unemployed if sector is not Unemployed",
  companyNameRequired: "Company Name is required",
  familyDetailsRequired: "Family details are required",
  invalidReportType: "Type must be either date or caste",
  dateRequired: "Date is required",
  dateFormat: "Date must be in YYYY-MM-DD format",
  minAge: "User must be at least 18 years old",
} as const;

const staticTa: Record<keyof typeof staticEn, string> = {
  minMaxAge: "குறைந்தபட்ச வயது அதிகபட்ச வயதை விட குறைவாக இருக்க வேண்டும்",
  minMaxAgeEqual: "குறைந்தபட்ச வயதும் அதிகபட்ச வயதும் சமமாக இருக்கக்கூடாது",
  emailOrMobileRequired: "மின்னஞ்சல் அல்லது கைபேசி எண் தேவை",
  emailMobileSalaryRequired: "மின்னஞ்சல், கைபேசி எண் அல்லது சம்பளத்தில் ஒன்று தேவை",
  invalidImage: "சரியான படத்தை பதிவேற்றவும்",
  unsupportedImageFormat: ".jpg, .jpeg, .png, .webp, .avif வடிவங்கள் மட்டுமே ஆதரிக்கப்படும்",
  maxFileSize: "அதிகபட்ச கோப்பு அளவு 5MB",
  createdFromToDate: "தொடக்க தேதி முடிவு தேதிக்கு முன் இருக்க வேண்டும்",
  samePasswordValidation: "புதிய கடவுச்சொல் பழையதிலிருந்து வேறுபட்டிருக்க வேண்டும்",
  otpDigits: "OTP சரியாக 6 இலக்கங்களாக இருக்க வேண்டும்",
  invalidApprovalStatus: "தவறான அங்கீகார நிலை",
  invalidMaritalStatus: "தவறான திருமண நிலை",
  invalidEducation: "தவறான கல்வித் தகுதி",
  invalidGender: "தவறான பாலினம்",
  invalidRole: "தவறான பங்கு",
  invalidPlan: "தவறான திட்டம்",
  invalidNakshatra: "தவறான நட்சத்திரம்",
  invalidRasi: "தவறான ராசி/லக்னம்",
  invalidEmailOrMobile: "சரியான மின்னஞ்சல் அல்லது கைபேசி எண்ணை உள்ளிடவும்",
  professionalDetailsRequired: "தொழில்சார் விவரங்கள் தேவை",
  salaryMustBeZero: "வேலையில்லாதவராக இருந்தால் சம்பளம் 0 ஆக இருக்க வேண்டும்",
  professionCannotBeUnemployed: "துறை வேலையில்லாதது என இல்லாதபோது தொழில் வேலையில்லாதது எனக் கூடாது",
  companyNameRequired: "நிறுவனத்தின் பெயர் தேவை",
  familyDetailsRequired: "குடும்ப விவரங்கள் தேவை",
  invalidReportType: "வகை தேதி அல்லது சாதி என இருக்க வேண்டும்",
  dateRequired: "தேதி தேவை",
  dateFormat: "தேதி YYYY-MM-DD வடிவத்தில் இருக்க வேண்டும்",
  minAge: "பயனர் குறைந்தபட்சம் 18 வயது ஆக வேண்டும்",
};

const staticTextToTa: Record<string, string> = Object.fromEntries(
  Object.entries(staticEn).map(([k, enText]) => [enText, staticTa[k as keyof typeof staticEn]])
);

export function translateStatic(c: Context, enText: string): string {
  if (getLocale(c) !== "ta") return enText;
  return staticTextToTa[enText] ?? enText;
}
