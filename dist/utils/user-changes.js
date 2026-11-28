import { UserLog, userLogActions } from '../models/user-log.js';
const VALUE_FIELDS = new Set([
    "fullName",
    "email",
    "gender",
    "dob",
    "maritalStatus",
    "contactDetails.mobile",
    "proffessionalDetails.salary",
    "otherDetails.caste",
    "otherDetails.subCaste",
    "approvalStatus",
    "isBlocked",
    "isDeleted",
    "isMarried",
    "marriedOn",
    "marriedTo",
    "invited",
]);
const IGNORED_FIELDS = new Set(["_id", "updatedAt", "createdAt", "__v"]);
function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date)
        && Object.getPrototypeOf(value) === Object.prototype;
}
export function flattenFields(value, prefix = "") {
    if (!isPlainObject(value))
        return prefix ? { [prefix]: value } : {};
    const result = {};
    for (const [key, child] of Object.entries(value)) {
        if (child === undefined)
            continue;
        const path = prefix ? `${prefix}.${key}` : key;
        if (isPlainObject(child) && Object.keys(child).length)
            Object.assign(result, flattenFields(child, path));
        else
            result[path] = child;
    }
    return result;
}
function normalize(value) {
    if (value === undefined || value === null || value === "")
        return "";
    if (value instanceof Date)
        return value.toISOString();
    if (typeof value === "object" && "toHexString" in value)
        return String(value);
    return JSON.stringify(value);
}
function readPath(source, path) {
    return path.split(".").reduce((current, key) => (current && typeof current === "object" ? current[key] : undefined), source);
}
export function getFieldChanges(before, update) {
    const changes = [];
    for (const [field, next] of Object.entries(flattenFields(update))) {
        if (IGNORED_FIELDS.has(field.split(".").pop() || field))
            continue;
        const previous = readPath(before, field);
        if (normalize(previous) === normalize(next))
            continue;
        changes.push(VALUE_FIELDS.has(field) ? { field, from: previous ?? null, to: next ?? null } : { field });
    }
    return changes;
}
export async function logUserChanges(entries) {
    const toSave = entries.filter(entry => entry.action !== "updated" || entry.changes?.length);
    if (!toSave.length)
        return;
    try {
        await UserLog.insertMany(toSave);
    }
    catch (error) {
        console.log("Failed to save user change log", error instanceof Error ? error.message : error);
    }
}
