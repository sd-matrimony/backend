import { Hono } from 'hono';

import { zv, createOrderSchema, verifyPaymentSchema, testCreateOrderSchema, testVerifySchema } from '../validations/index.js';
import { createOrder, testCreateOrder, testVerifyPayment, verifyPayment } from '../controllers/payment.js';

const paymentRoutes = new Hono()

paymentRoutes
  .post('/create-order', zv("json", createOrderSchema), createOrder)
  .post('/verify', zv("json", verifyPaymentSchema), verifyPayment)
  .post('/test-create-order', zv("json", testCreateOrderSchema), testCreateOrder)
  .post('/test-verify', zv("json", testVerifySchema), testVerifyPayment)

export default paymentRoutes
