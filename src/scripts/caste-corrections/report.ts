/**
 * Fetch users matching a given list of castes.
 * Input:  JSON file containing an array of caste names, e.g. ["Mudaliyar", "Naidu"]
 * Output: NDJSON file with one { id, name, caste, subCaste } record per line.
 *
 * Resumable: progress is checkpointed (last processed _id) to a state file.
 * Re-running the same command continues from where it left off instead of
 * re-scanning the whole collection. Pass --restart to ignore the checkpoint
 * and start over.
 *
 * Run (defaults read/write inside this folder):
 *   npx tsx src/scripts/caste-corrections/report.ts
 *   npx tsx src/scripts/caste-corrections/report.ts --input=./samples/castes.json --output=./report.ndjson
 *   npx tsx src/scripts/caste-corrections/report.ts --restart
 */

import { existsSync, appendFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import 'dotenv/config';

import { parseArgs, readJsonFile, loadState, saveState } from './helper.js';
import { connectMongo } from '../../services/connect-mongo.js';
import { User } from '../../models/index.js';

const DIR = dirname(fileURLToPath(import.meta.url))
const BATCH_SIZE = 500

type Args = {
  input: string
  output: string
  state: string
  restart: boolean
}

type CheckpointState = {
  inputHash: string
  lastId: string | null
  processed: number
  matched: number
  done: boolean
}

function resolveArgs(): Args {
  const raw = parseArgs()
  const output = raw.get('output') || join(DIR, 'report.ndjson')
  return {
    input: raw.get('input') || join(DIR, 'samples', 'castes.json'),
    output,
    state: raw.get('state') || `${output}.state.json`,
    restart: raw.get('restart') === 'true',
  }
}

function hashList(list: string[]): string {
  return `${list.length}:${list.slice().sort().join('|')}`
}

async function run() {
  const { input, output, state: statePath, restart } = resolveArgs()

  const castes = readJsonFile<string[]>(input)
  if (!Array.isArray(castes) || castes.length === 0) {
    throw new Error('Input JSON must be a non-empty array of caste names')
  }

  const inputHash = hashList(castes)
  let state = loadState<CheckpointState>(statePath, restart, {
    inputHash, lastId: null, processed: 0, matched: 0, done: false,
  })

  if (state.inputHash !== inputHash) {
    console.warn('Input caste list changed since last run — starting fresh.')
    state = { inputHash, lastId: null, processed: 0, matched: 0, done: false }
  }

  if (state.done) {
    console.log(`Already completed. matched=${state.matched}, processed=${state.processed}`)
    console.log(`Output: ${output}`)
    return
  }

  if (restart || !existsSync(output)) {
    writeFileSync(output, '')
    state.lastId = null
    state.processed = 0
    state.matched = 0
  }

  await connectMongo()

  console.log(`Searching ${castes.length} caste(s)${state.lastId ? ` — resuming after _id=${state.lastId}` : ''}`)

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query: Record<string, unknown> = { 'otherDetails.caste': { $in: castes } }
    if (state.lastId) query._id = { $gt: new mongoose.Types.ObjectId(state.lastId) }

    const batch = await User.find(query)
      .sort({ _id: 1 })
      .limit(BATCH_SIZE)
      .select('fullName otherDetails.caste otherDetails.subCaste')
      .lean()

    if (batch.length === 0) break

    const lines = batch.map((u: any) => JSON.stringify({
      id: u._id.toString(),
      name: u.fullName,
      caste: u.otherDetails?.caste ?? null,
      subCaste: u.otherDetails?.subCaste ?? null,
    })).join('\n') + '\n'

    appendFileSync(output, lines)

    state.matched += batch.length
    state.processed += batch.length
    state.lastId = batch[batch.length - 1]._id.toString()
    saveState(statePath, state)

    console.log(`  matched so far: ${state.matched} (checkpoint _id=${state.lastId})`)

    if (batch.length < BATCH_SIZE) break
  }

  state.done = true
  saveState(statePath, state)

  console.log(`\nDone — matched ${state.matched} user(s).`)
  console.log(`Output: ${output}`)
  await mongoose.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
