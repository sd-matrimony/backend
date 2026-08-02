/**
 * Revert users' caste/subCaste back to the values captured in an update.ts
 * undo log (see update.ts's "Undo:" doc comment for where that file comes from).
 *
 * Input: NDJSON file, one { id, caste, subCaste } per line — the values a
 * user's otherDetails.caste/subCaste had right before an update.ts --apply run.
 *
 * Note: this restores to "right before that run", not to "right now". If
 * something else wrote to the same user's caste/subCaste between the bad run
 * and this revert, that intervening write is overwritten too.
 *
 * Draft by default (read-only: reports how many users would be restored).
 * Pass --apply to actually perform the writes.
 *
 * Resumable: each user _id is checkpointed to a state file once reverted.
 * Re-running with --apply skips users already reverted. Pass --restart to
 * ignore the checkpoint and redo everything.
 *
 * Run:
 *   npx tsx src/scripts/caste-corrections/revert.ts --undo=<path>            # draft
 *   npx tsx src/scripts/caste-corrections/revert.ts --undo=<path> --apply
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import { connectMongo } from '../../services/connect-mongo.js';
import { User } from '../../models/index.js';
import { parseArgs, requireArg, loadState, saveState } from './helper.js';

type UndoRow = {
  id: string
  caste: string | null
  subCaste: string | null
}

type Args = {
  undo: string
  state: string
  apply: boolean
  restart: boolean
}

type CheckpointState = {
  completed: Record<string, true>
}

function resolveArgs(): Args {
  const raw = parseArgs()
  const undo = requireArg(raw, 'undo', '<path to update.ts undo .ndjson file>')
  return {
    undo,
    state: raw.get('state') || `${undo}.revert-state.json`,
    apply: raw.get('apply') === 'true',
    restart: raw.get('restart') === 'true',
  }
}

function readUndoRows(path: string): UndoRow[] {
  return readFileSync(path, 'utf-8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as UndoRow)
}

async function run() {
  const { undo, state: statePath, apply, restart } = resolveArgs()

  const rows = readUndoRows(undo)
  if (rows.length === 0) throw new Error(`Undo file is empty: ${undo}`)

  const state = loadState<CheckpointState>(statePath, restart, { completed: {} })

  await connectMongo()
  console.log(`Mode: ${apply ? 'APPLY' : 'DRAFT (dry run, no writes)'}`)
  console.log(`${rows.length} user(s) in undo log\n`)

  let restored = 0
  let skipped = 0

  for (const row of rows) {
    if (apply && !restart && state.completed[row.id]) {
      skipped++
      continue
    }

    if (!apply) {
      restored++
      continue
    }

    await User.updateOne(
      { _id: new mongoose.Types.ObjectId(row.id) },
      [{ $set: { 'otherDetails.caste': row.caste, 'otherDetails.subCaste': row.subCaste } }]
    )

    state.completed[row.id] = true
    saveState(statePath, state)
    restored++
  }

  if (!apply) {
    console.log(`Would restore ${restored} user(s) to their pre-update caste/subCaste.`)
    console.log('Re-run with --apply to perform the revert.')
  } else {
    console.log(`Restored ${restored} user(s)${skipped ? `, skipped ${skipped} already-reverted` : ''}.`)
  }

  await mongoose.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
