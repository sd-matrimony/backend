/**
 * Bulk-update user caste/subCaste from a mapping file.
 * Input: JSON array of { fromCaste?, fromSubCaste?, toCaste?, toSubCaste? }
 *   - At least one of fromCaste/fromSubCaste is required (what to match on).
 *   - At least one of toCaste/toSubCaste is required (what to change).
 *   - fromCaste + fromSubCaste both given -> match users with BOTH.
 *   - fromSubCaste only (fromCaste omitted) -> match by subCaste regardless of caste.
 *   - toCaste omitted   -> otherDetails.caste is left untouched, only subCaste is set.
 *   - toSubCaste omitted -> otherDetails.subCaste is left untouched, only caste is set.
 *
 * Draft by default (read-only: reports match counts + samples, writes nothing).
 * Pass --apply to actually perform the updates.
 *
 * Resumable: each mapping entry is checkpointed to a state file once applied.
 * Re-running with --apply skips entries already completed. Pass --restart to
 * ignore the checkpoint and re-apply everything.
 *
 * Run (defaults read from this folder):
 *   npx tsx src/scripts/caste-corrections/update.ts                                        # draft (dry run)
 *   npx tsx src/scripts/caste-corrections/update.ts --apply                                 # apply
 *   npx tsx src/scripts/caste-corrections/update.ts --apply --restart
 *   npx tsx src/scripts/caste-corrections/update.ts --input=./samples/mapping.json --apply
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { join } from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { connectMongo } from '../../services/connect-mongo.js';
import { User } from '../../models/index.js';
import { parseArgs, readJsonFile, loadState, saveState } from './helper.js';

const DIR = dirname(fileURLToPath(import.meta.url))

type Mapping = {
  fromCaste?: string
  fromSubCaste?: string
  toCaste?: string
  toSubCaste?: string
}

type Args = {
  input: string
  state: string
  apply: boolean
  restart: boolean
}

type EntryResult = {
  key: string
  matched: number
  modified: number
  appliedAt: string
}

type CheckpointState = {
  completed: Record<string, EntryResult>
}

function resolveArgs(): Args {
  const raw = parseArgs()
  const input = raw.get('input') || join(DIR, 'samples', 'mapping.json')
  return {
    input,
    state: raw.get('state') || `${input}.state.json`,
    apply: raw.get('apply') === 'true',
    restart: raw.get('restart') === 'true',
  }
}

function keyFor(m: Mapping): string {
  return `${m.fromCaste ?? ''}/${m.fromSubCaste ?? ''}=>${m.toCaste ?? ''}/${m.toSubCaste ?? ''}`
}

function matchFor(m: Mapping): Record<string, unknown> {
  const match: Record<string, unknown> = {}
  if (m.fromCaste) match['otherDetails.caste'] = m.fromCaste
  if (m.fromSubCaste) match['otherDetails.subCaste'] = m.fromSubCaste
  return match
}

function describeFrom(m: Mapping): string {
  if (m.fromCaste && m.fromSubCaste) return `${m.fromCaste} / ${m.fromSubCaste}`
  if (m.fromCaste) return m.fromCaste
  return `(any caste) / ${m.fromSubCaste}`
}

function describeTo(m: Mapping): string {
  const parts: string[] = []
  parts.push(m.toCaste ? `caste="${m.toCaste}"` : 'caste unchanged')
  parts.push(m.toSubCaste ? `subCaste="${m.toSubCaste}"` : 'subCaste unchanged')
  return parts.join(', ')
}

function validateMappings(mappings: unknown): Mapping[] {
  if (!Array.isArray(mappings) || mappings.length === 0) {
    throw new Error('Input JSON must be a non-empty array of { fromCaste?, fromSubCaste?, toCaste?, toSubCaste? }')
  }

  return mappings.map((m, i) => {
    if (typeof m !== 'object' || m === null) throw new Error(`Entry ${i} is not an object`)
    const { fromCaste, fromSubCaste, toCaste, toSubCaste } = m as Record<string, unknown>

    for (const [key, val] of Object.entries({ fromCaste, fromSubCaste, toCaste, toSubCaste })) {
      if (val !== undefined && (typeof val !== 'string' || !val.trim())) {
        throw new Error(`Entry ${i}: ${key} must be a non-empty string when present`)
      }
    }

    if (!fromCaste && !fromSubCaste) {
      throw new Error(`Entry ${i}: at least one of fromCaste/fromSubCaste is required to know what to match`)
    }
    if (!toCaste && !toSubCaste) {
      throw new Error(`Entry ${i}: at least one of toCaste/toSubCaste is required to know what to change`)
    }

    return {
      fromCaste: fromCaste as string | undefined,
      fromSubCaste: fromSubCaste as string | undefined,
      toCaste: toCaste as string | undefined,
      toSubCaste: toSubCaste as string | undefined,
    }
  })
}

async function run() {
  const { input, state: statePath, apply, restart } = resolveArgs()

  const mappings = validateMappings(readJsonFile<unknown>(input))
  const state = loadState<CheckpointState>(statePath, restart, { completed: {} })

  await connectMongo()
  console.log(`Mode: ${apply ? 'APPLY' : 'DRAFT (dry run, no writes)'}`)
  console.log(`${mappings.length} mapping(s) to process\n`)

  for (const mapping of mappings) {
    const key = keyFor(mapping)
    const { toCaste, toSubCaste } = mapping
    const from = describeFrom(mapping)
    const to = describeTo(mapping)

    if ((mapping.fromCaste ?? '') === (toCaste ?? '') && (mapping.fromSubCaste ?? '') === (toSubCaste ?? '')) {
      console.log(`[skip] "${from}" -> no-op (nothing changes)`)
      continue
    }

    if (apply && !restart && state.completed[key]) {
      const prev = state.completed[key]
      console.log(`[skip] "${from}" -> "${to}" already applied at ${prev.appliedAt} (matched=${prev.matched}, modified=${prev.modified})`)
      continue
    }

    const match = matchFor(mapping)
    const matchCount = await User.countDocuments(match)

    if (!apply) {
      const sample = await User.find(match)
        .limit(3)
        .select('fullName otherDetails.caste otherDetails.subCaste')
        .lean()

      console.log(`[draft] "${from}" -> ${to}`)
      console.log(`        matches: ${matchCount}`)
      if (sample.length) {
        console.log(`        sample: ${sample.map((u: any) => u.fullName).join(', ')}`)
      }
      continue
    }

    if (matchCount === 0) {
      console.log(`[apply] "${from}" -> no matching users, nothing to do`)
      state.completed[key] = { key, matched: 0, modified: 0, appliedAt: new Date().toISOString() }
      saveState(statePath, state)
      continue
    }

    try {
      const setStage: Record<string, unknown> = {}
      if (toCaste) setStage['otherDetails.caste'] = toCaste
      if (toSubCaste) setStage['otherDetails.subCaste'] = toSubCaste

      const result = await User.updateMany(
        match,
        [{ $set: setStage }]
      )

      console.log(`[apply] "${from}" -> ${to} — matched=${result.matchedCount}, modified=${result.modifiedCount}`)

      state.completed[key] = {
        key,
        matched: result.matchedCount,
        modified: result.modifiedCount,
        appliedAt: new Date().toISOString(),
      }
      saveState(statePath, state)
    } catch (err: any) {
      console.error(`[error] "${from}" -> "${to}" failed: ${err?.message}`)
      console.error('Stopping so the failure can be investigated. Re-run with --apply to resume from here.')
      await mongoose.disconnect()
      process.exit(1)
    }
  }

  console.log(apply ? '\nDone.' : '\nDraft complete — re-run with --apply to perform these updates.')
  await mongoose.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
