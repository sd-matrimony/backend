import { Schema, model } from 'mongoose';
import { approvalStatuses, genders, maritalStatuses } from '../utils/enums.js';
import { MIN_AGE, isValidDob } from '../utils/index.js';

const userSchema = new Schema({
  fullName: {
    type: String,
    required: [true, 'Name is required'],
    minlength: [3, 'Name should atleast 3 letter'],
  },

  role: {
    type: String,
    enum: ['user'],
    default: 'user',
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

  images: [{ type: String }],

  profileImg: String,

  maritalStatus: {
    type: String,
    enum: maritalStatuses,
    required: true
  },

  isMarried: { // true if user alliance is fixed
    type: Boolean,
    default: false,
  },

  marriedTo: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },

  marriedOn: {
    type: Date,
  },

  gender: {
    type: String,
    enum: genders,
    required: true,
  },

  dob: {
    type: Date,
    required: true,
    validate: {
      validator: isValidDob,
      message: `User must be at least ${MIN_AGE} years old`,
    },
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

  proffessionalDetails: {
    highestQualification: String,
    qualifications: String,
    companyName: String,
    profession: String,
    sector: String,
    salary: Number,
  },

  familyDetails: {
    fatherName: String,
    motherName: String,
    noOfBrothers: Number,
    noOfSisters: Number,
    birthOrder: Number,
    isFatherAlive: {
      type: Boolean,
      default: true,
    },
    isMotherAlive: {
      type: Boolean,
      default: true,
    },
  },

  approvalStatus: {
    type: String,
    enum: approvalStatuses,
    default: 'approved',
  },

  verifiyOtp: Number,

  vedicHoroscope: {
    nakshatra: String,
    rasi: String,
    lagna: String,
    dashaPeriod: String,
    placeOfBirth: String,
    timeOfBirth: String,
    vedicHoroscopePic: String,
    dosham: String,
  },

  partnerPreferences: {
    minAge: Number,
    maxAge: Number,
    religion: String,
    caste: String,
    subCaste: String,
    minSalary: Number,
    minQualification: String,
    sector: String,
    profession: String,
    motherTongue: String,
    location: String,
    expectation: String,
    maritalStatus: {
      type: String,
      enum: maritalStatuses,
    },
  },

  otherDetails: {
    motherTongue: String,
    houseType: String,
    religion: String,
    height: Number,
    color: String,
    caste: String,
    subCaste: String,
  },

  isDeleted: {
    type: Boolean,
    default: false,
  },

  isBlocked: {
    type: Boolean,
    default: false,
  },

  isVerified: {
    type: Boolean,
    default: false,
  },

  liked: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],

  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'Admin',
  },

  currentPlan: {
    type: Schema.Types.ObjectId,
    ref: 'Payment'
  },

  invited: {
    type: Boolean,
    default: false,
  }

}, { timestamps: true })

userSchema.pre('validate', function (next) {
  if (!this.email && !this.contactDetails?.mobile) {
    this.invalidate('email', 'Either email or mobile number is required');
    this.invalidate('contactDetails.mobile', 'Either email or mobile number is required');
  }
  next()
})

export const User = model('User', userSchema)
