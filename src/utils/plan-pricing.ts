import { assistedPrices, extraProfiles, planPrices, planValidityMonths, profilesCount, type plansT } from './enums.js';
import type { MessageKey } from './i18n.js';

export const UNLIMITED_PROFILES = 999

type planOptions = {
  subscribedTo: plansT
  noOfProfilesCanView: number
  isAssisted: boolean
  assistedMonths: number
}

type pricingResult =
  | { ok: true, amount: number, assistedMonths: number }
  | { ok: false, error: MessageKey }

export function getPlanPricing({ subscribedTo, noOfProfilesCanView, isAssisted, assistedMonths }: planOptions): pricingResult {
  let amount = planPrices[subscribedTo]
  const baseProfiles = profilesCount[subscribedTo]

  if (noOfProfilesCanView === UNLIMITED_PROFILES) {
    amount += extraProfiles[UNLIMITED_PROFILES]
  } else if (noOfProfilesCanView !== baseProfiles) {
    const added = noOfProfilesCanView - baseProfiles
    const price = added > 0 && added !== UNLIMITED_PROFILES ? extraProfiles[added] : undefined
    if (typeof price !== "number") return { ok: false, error: "invalidProfileOption" }
    amount += price
  }

  if (!isAssisted) return { ok: true, amount, assistedMonths: 0 }

  const price = assistedPrices[assistedMonths]
  const isValidMonths = Number.isInteger(assistedMonths) && assistedMonths >= 1 && assistedMonths <= planValidityMonths[subscribedTo]
  if (!isValidMonths || typeof price !== "number") return { ok: false, error: "invalidAssistedMonths" }

  return { ok: true, amount: amount + price, assistedMonths }
}
