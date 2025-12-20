import type { ValidationTargets } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

function formatErrors(error: z.ZodError) {
  const messages: Record<string, string> = {}
  error.issues.forEach(issue => {
    const key = issue.path[0] as string
    if (messages[key]) {
      messages[key] = messages[key] + `, ${issue.message}`
    }
    else {
      messages[key] = issue.message
    }
  })

  return messages
}

export const zv = <T extends z.ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T
) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const messages = formatErrors(result.error as any)
      const message = Object.entries(messages).map(([key, value]) => `${key}: ${value}`).join("; ")
      // const message = Object.values(messages).join("; ")
      return c.json({ message }, 400)
    }
  })

export function enumQuery<T extends z.ZodType>(values: T) {
  return z.preprocess((val) => {
    if (typeof val === "string") {
      try {
        if (val === "Any") return undefined
        if (val.includes("[")) return JSON.parse(val)
        if (val.includes(",")) return val.split(",")
        return val

      } catch {
        return undefined
      }
    }

    if (Array.isArray(val)) return val
    return val
  },
    z.union([values, z.array(values)]).optional()
  )
}
