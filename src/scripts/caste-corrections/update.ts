/**
 * Bulk-update user caste/subCaste from a mapping file.
 * Input: JSON array of { fromCaste, toCaste, toSubCaste? }
 *   - toSubCaste present  -> otherDetails.caste AND otherDetails.subCaste are updated
 *   - toSubCaste absent   -> only otherDetails.caste is updated, subCaste is left untouched
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
  fromCaste: string
  toCaste: string
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
  return `${m.fromCaste}=>${m.toCaste}=>${m.toSubCaste ?? ''}`
}

function validateMappings(mappings: unknown): Mapping[] {
  if (!Array.isArray(mappings) || mappings.length === 0) {
    throw new Error('Input JSON must be a non-empty array of { fromCaste, toCaste, toSubCaste? }')
  }

  return mappings.map((m, i) => {
    if (typeof m !== 'object' || m === null) throw new Error(`Entry ${i} is not an object`)
    const { fromCaste, toCaste, toSubCaste } = m as Record<string, unknown>
    if (typeof fromCaste !== 'string' || !fromCaste.trim()) throw new Error(`Entry ${i}: fromCaste is required`)
    if (typeof toCaste !== 'string' || !toCaste.trim()) throw new Error(`Entry ${i}: toCaste is required`)
    if (toSubCaste !== undefined && typeof toSubCaste !== 'string') throw new Error(`Entry ${i}: toSubCaste must be a string`)
    return { fromCaste, toCaste, toSubCaste: toSubCaste || undefined }
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
    const { fromCaste, toCaste, toSubCaste } = mapping

    if (fromCaste === toCaste && !toSubCaste) {
      console.log(`[skip] "${fromCaste}" -> no-op (same caste, no subCaste change)`)
      continue
    }

    if (apply && !restart && state.completed[key]) {
      const prev = state.completed[key]
      console.log(`[skip] "${fromCaste}" -> "${toCaste}"${toSubCaste ? ` / "${toSubCaste}"` : ''} already applied at ${prev.appliedAt} (matched=${prev.matched}, modified=${prev.modified})`)
      continue
    }

    const matchCount = await User.countDocuments({ 'otherDetails.caste': fromCaste })

    if (!apply) {
      const sample = await User.find({ 'otherDetails.caste': fromCaste })
        .limit(3)
        .select('fullName otherDetails.caste otherDetails.subCaste')
        .lean()

      console.log(`[draft] "${fromCaste}" -> caste="${toCaste}"${toSubCaste ? `, subCaste="${toSubCaste}"` : ' (subCaste unchanged)'}`)
      console.log(`        matches: ${matchCount}`)
      if (sample.length) {
        console.log(`        sample: ${sample.map((u: any) => u.fullName).join(', ')}`)
      }
      continue
    }

    if (matchCount === 0) {
      console.log(`[apply] "${fromCaste}" -> no matching users, nothing to do`)
      state.completed[key] = { key, matched: 0, modified: 0, appliedAt: new Date().toISOString() }
      saveState(statePath, state)
      continue
    }

    try {
      const setStage: Record<string, unknown> = { 'otherDetails.caste': toCaste }
      if (toSubCaste) setStage['otherDetails.subCaste'] = toSubCaste

      const result = await User.updateMany(
        { 'otherDetails.caste': fromCaste },
        [{ $set: setStage }]
      )

      console.log(`[apply] "${fromCaste}" -> caste="${toCaste}"${toSubCaste ? `, subCaste="${toSubCaste}"` : ' (subCaste unchanged)'} — matched=${result.matchedCount}, modified=${result.modifiedCount}`)

      state.completed[key] = {
        key,
        matched: result.matchedCount,
        modified: result.modifiedCount,
        appliedAt: new Date().toISOString(),
      }
      saveState(statePath, state)
    } catch (err: any) {
      console.error(`[error] "${fromCaste}" -> "${toCaste}" failed: ${err?.message}`)
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
