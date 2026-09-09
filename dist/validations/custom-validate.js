import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { translateStatic } from "../utils/i18n.js";
function formatErrors(error, c) {
    const messages = {};
    error.issues.forEach(issue => {
        const key = issue.path[0];
        const message = translateStatic(c, issue.message);
        if (messages[key]) {
            messages[key] = messages[key] + `, ${message}`;
        }
        else {
            messages[key] = message;
        }
    });
    return messages;
}
export const zv = (target, schema) => zValidator(target, schema, (result, c) => {
    if (!result.success) {
        const messages = formatErrors(result.error, c);
        const message = Object.entries(messages).map(([key, value]) => `${key}: ${value}`).join("; ");
        // const message = Object.values(messages).join("; ")
        return c.json({ message }, 400);
    }
});
export function enumQuery(values) {
    return z.preprocess((val) => {
        if (typeof val === "string") {
            try {
                if (val === "Any")
                    return undefined;
                if (val.includes("["))
                    return JSON.parse(val);
                if (val.includes(","))
                    return val.split(",");
                return val;
            }
            catch {
                return undefined;
            }
        }
        if (Array.isArray(val))
            return val;
        return val;
    }, z.union([values, z.array(values)]).optional());
}
