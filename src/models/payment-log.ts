import { Schema, model } from 'mongoose';

export const paymentLogActions = ['created', 'extended', 'profilesAdded', 'cancelled', 'deleted'] as const

const paymentLogSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  payment: {
    type: Schema.Types.ObjectId,
    ref: 'Payment',
  },

  admin: {
    type: Schema.Types.ObjectId,
    ref: 'Admin',
  },

  action: {
    type: String,
    enum: paymentLogActions,
    required: true,
  },

  details: {
    subscribedTo: String,
    amount: Number,
    days: Number,
    profiles: Number,
    previousExpiry: Date,
    newExpiry: Date,
    previousProfiles: Number,
    newProfiles: Number,
  },

  reason: {
    type: String,
    trim: true,
  },

}, { timestamps: true })

export const PaymentLog = model('PaymentLog', paymentLogSchema)
