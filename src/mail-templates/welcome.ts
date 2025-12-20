import { env, tokenEnums } from "../utils/enums.js";
import { getToken } from "../utils/token.js";

import { templete } from "./template.js";

export async function welcome(_id: string, role: string) {
  const verifyToken = await getToken({ _id, role }, tokenEnums.verifyToken)
  const verificationUrl = `${env.FRONTEND_URL}/auth/verify?token=${verifyToken}`

  return {
    subject: "Welcome to SD Matrimony",
    html: templete({
      headStyle: `
.welcome-message {
  margin-bottom: 30px;
}
.welcome-message h2 {
  color: #1f2937;
  font-size: 24px;
  margin-bottom: 16px;
  font-weight: 600;
}
.welcome-message p {
  color: #6b7280;
  font-size: 16px;
  margin-bottom: 16px;
}`,
      content: `
<div class="welcome-message">
  <h2>Welcome to Our Family! 🎉</h2>
  <p>Dear Valued Member,</p>
  <p>We're absolutely delighted to welcome you to SD Matrimony! Thank you for choosing us as your trusted partner
    in finding your perfect life companion.</p>
  <p>Your journey to discover meaningful connections and lasting relationships starts now, and we're here to
    support you every step of the way.</p>
</div>

<div class="features">
  <h3>What You Can Expect:</h3>
  <ul>
    <li>Personalized profile matching based on your preferences</li>
    <li>Secure and private communication platform</li>
    <li>Regular profile suggestions tailored just for you</li>
    <li>Advanced search filters to find your ideal match</li>
    <li>Verified profiles for your safety and peace of mind</li>
  </ul>
</div>

<div style="color: #6b7280; margin-bottom: 20px;">
  Our experienced team is committed to helping you find someone special who shares your values, interests, and
  life goals. We believe that every person deserves to find their perfect match, and we're honored to be part of
  your story.
</div>

<div style="text-align: center;">
  <a href="${verificationUrl}" class="cta-button" target="_blank">Verify Email</a>
</div>

<div style="color: #6b7280; font-size: 14px; margin-top: 20px;">
  <strong>Next Steps:</strong> Please complete your profile to start receiving compatible matches. The more
  detailed your profile, the better we can help you find your ideal partner.
</div>`
    })
  }
}
