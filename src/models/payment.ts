import { Schema, model } from 'mongoose';
import { plans } from '../utils/enums.js';

const paymentSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },

  amount: {
    type: Number,
    required: true,
  },

  subscribedTo: {
    type: String,
    enum: plans,
    default: 'basic',
  },

  noOfProfilesCanView: {
    type: Number,
    default: 30,
  },

  isAssisted: {
    type: Boolean,
    default: false,
  },

  assistedMonths: {
    type: Number,
    default: 0,
  },

  orderId: {
    type: String,
    required: true,
  },

  expiryDate: {
    type: Date,
  },

}, { timestamps: true })

export const Payment = model('Payment', paymentSchema)
