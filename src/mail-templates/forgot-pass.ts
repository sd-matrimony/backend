import { templete } from "./template.js";

export function forgotPass(otp: number) {
  return {
    subject: "Reset password otp",
    html: templete({
      content: `
<div>Dear User,</div>
<div>We received a request to reset your password. Please use the following One-Time Password (OTP) to proceed with resetting your password. This code is valid for <strong>10 minutes</strong>.</div>
<div class="features"><h3 style="text-align: center;">${otp}</h3></div>
<div>If you did not request a password reset, please ignore this email or contact our support team immediately at <a href="mailto:admin@sdmatrimony.com" target="_blank">admin@sdmatrimony.com</a>.</div>
      `
    })
  }
}
