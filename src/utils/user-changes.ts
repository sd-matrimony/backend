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
])

const IGNORED_FIELDS = new Set(["_id", "updatedAt", "createdAt", "__v"])

export type fieldChange = { field: string, from?: unknown, to?: unknown }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date)
    && Object.getPrototypeOf(value) === Object.prototype
}

export function flattenFields(value: unknown, prefix = ""): Record<string, unknown> {
  if (!isPlainObject(value)) return prefix ? { [prefix]: value } : {}

  const result: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (child === undefined) continue
    const path = prefix ? `${prefix}.${key}` : key
    if (isPlainObject(child) && Object.keys(child).length) Object.assign(result, flattenFields(child, path))
    else result[path] = child
  }
  return result
}

function normalize(value: unknown): string {
  if (value === undefined || value === null || value === "") return ""
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "object" && "toHexString" in (value as object)) return String(value)
  return JSON.stringify(value)
}

function readPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => (
    current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined
  ), source)
}

export function getFieldChanges(before: unknown, update: Record<string, unknown>): fieldChange[] {
  const changes: fieldChange[] = []

  for (const [field, next] of Object.entries(flattenFields(update))) {
    if (IGNORED_FIELDS.has(field.split(".").pop() || field)) continue

    const previous = readPath(before, field)
    if (normalize(previous) === normalize(next)) continue

    changes.push(VALUE_FIELDS.has(field) ? { field, from: previous ?? null, to: next ?? null } : { field })
  }

  return changes
}

type logInput = {
  user: unknown
  admin?: unknown
  action: typeof userLogActions[number]
  changes?: fieldChange[]
}

export async function logUserChanges(entries: logInput[]) {
  const toSave = entries.filter(entry => entry.action !== "updated" || entry.changes?.length)
  if (!toSave.length) return

  try {
    await UserLog.insertMany(toSave)
  } catch (error) {
    console.log("Failed to save user change log", error instanceof Error ? error.message : error)
  }
}
