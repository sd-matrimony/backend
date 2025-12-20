import { z } from "zod";
import { planEnum } from "./general.js";

export const createOrderSchema = z.object({
  subscribedTo: planEnum,
  noOfProfilesCanView: z.number("Number of profiles is required"),
  isAssisted: z.boolean("Is assisted is required"),
  assistedMonths: z.number("Assisted months is required"),
})

export const verifyPaymentSchema = z.object({
  amount: z.number("Amount is required"),
  subscribedTo: planEnum,
  noOfProfilesCanView: z.number("Number of profiles is required"),
  isAssisted: z.boolean("Is assisted is required"),
  assistedMonths: z.number("Assisted months is required"),
  merchantOrderId: z.string("Merchant Order ID is required"),
  orderId: z.string("Order ID is required"),
})

export const testCreateOrderSchema = z.object({
  amount: z.number("Amount is required"),
})

export const testVerifySchema = z.object({
  merchantOrderId: z.string("Merchant Order ID is required"),
  orderId: z.string("Order ID is required"),
})
