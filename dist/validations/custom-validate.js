import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
function formatErrors(error) {
    const messages = {};
    error.issues.forEach(issue => {
        const key = issue.path[0];
        if (messages[key]) {
            messages[key] = messages[key] + `, ${issue.message}`;
        }
        else {
            messages[key] = issue.message;
        }
    });
    return messages;
}
export const zv = (target, schema) => zValidator(target, schema, (result, c) => {
    if (!result.success) {
        const messages = formatErrors(result.error);
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
