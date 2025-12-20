import { env, tokenEnums } from "../utils/enums.js";
import { getToken } from "../utils/token.js";

import { templete } from "./template.js";

export async function resendVerifyEmail(_id: string, role: string) {
  const verifyToken = await getToken({ _id, role }, tokenEnums.verifyToken)
  const verificationUrl = `${env.FRONTEND_URL}/auth/verify?token=${verifyToken}`

  return {
    subject: "Verify your email",
    html: templete({
      content: `
      <p>Dear User,</p>
      <p>Thank you for joining SD Matrimony! To ensure the security of your account and start connecting with potential matches, please verify your email address.</p>
      <p>This verification helps us maintain a safe and trusted community for all our members.</p>
      <p style="text-align: center;"><a href="${verificationUrl}" class="cta-button" target="_blank">Verify Email</a></p>
      <p>If you didn't create an account with SD Matrimony, please ignore this email or contact our support team if you have concerns.</p>`
    })
  }
}
