import { Schema, model } from 'mongoose';

const adminSchema = new Schema({
  fullName: {
    type: String,
    required: [true, 'Name is required'],
    minlength: [3, 'Name should atleast 3 letter'],
  },

  role: {
    type: String,
    enum: ['admin', 'super-admin'],
    default: 'admin',
  },

  email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    match: [/\S+@\S+\.\S+/, 'Email is not valid'],
  },

  password: {
    type: String,
    required: [true, 'Password is required'],
  },

  refreshTokens: [{ type: String }],

  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },

  isVerified: {
    type: Boolean,
    default: false,
  },

  verifiyOtp: {
    type: Number
  },

  contactDetails: {
    mobile: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    address: String,
  },

  isDeleted: {
    type: Boolean,
    default: false,
  },

}, { timestamps: true })

adminSchema.pre('validate', function (next) {
  if (!this.email && !this.contactDetails?.mobile) {
    this.invalidate('email', 'Either email or mobile number is required');
    this.invalidate('contactDetails.mobile', 'Either email or mobile number is required');
  }
  next()
})

export const Admin = model('Admin', adminSchema)
