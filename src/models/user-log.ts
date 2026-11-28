import { Schema, model } from 'mongoose';

export const userLogActions = ['created', 'updated', 'passwordReset', 'married', 'invited'] as const

const userLogSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  admin: {
    type: Schema.Types.ObjectId,
    ref: 'Admin',
  },

  action: {
    type: String,
    enum: userLogActions,
    required: true,
  },

  changes: [{
    _id: false,
    field: { type: String, required: true },
    from: Schema.Types.Mixed,
    to: Schema.Types.Mixed,
  }],

}, { timestamps: true })

export const UserLog = model('UserLog', userLogSchema)
