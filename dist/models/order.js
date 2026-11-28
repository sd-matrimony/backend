import { Schema, model } from 'mongoose';
import { plans } from '../utils/enums.js';
export const orderStatuses = ['pending', 'completed', 'failed'];
const orderSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    merchantOrderId: {
        type: String,
        required: true,
        unique: true,
    },
    phonepeOrderId: {
        type: String,
    },
    amount: {
        type: Number,
        required: true,
    },
    subscribedTo: {
        type: String,
        enum: plans,
        required: true,
    },
    noOfProfilesCanView: {
        type: Number,
        required: true,
    },
    isAssisted: {
        type: Boolean,
        default: false,
    },
    assistedMonths: {
        type: Number,
        default: 0,
    },
    status: {
        type: String,
        enum: orderStatuses,
        default: 'pending',
        index: true,
    },
    payment: {
        type: Schema.Types.ObjectId,
        ref: 'Payment',
    },
}, { timestamps: true });
export const Order = model('Order', orderSchema);
