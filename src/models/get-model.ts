import { Model } from 'mongoose';

import { Admin } from './admin.js';
import { User } from './user.js';

type commonFields = {
  fullName: string
  role: string
  email: string
  password: string
  approvalStatus: string
  isVerified: boolean
  verifiyOtp: number | undefined
  refreshTokens: string[]
  contactDetails: {
    mobile: string
  }
}

export function getModel(role: string): Model<commonFields> {
  return role === "user" ? User as any : Admin as any
}
