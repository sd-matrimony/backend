/**
 * List every distinct (caste, subCaste) combination currently in use across
 * users, with counts. Use this to spot misconfigured/duplicate caste entries
 * before writing a mapping.json for update.ts.
 *
 * Filters: pass --caste and/or --subCaste (comma-separated) to restrict to
 * matching users. Omit both to list every combination.
 *
 * Output: JSON array [{ caste, subCaste, count }], sorted by caste then count desc.
 *
 * Run (defaults write to ./samples/list.json):
 *   npx tsx src/scripts/caste-corrections/list.ts
 *   npx tsx src/scripts/caste-corrections/list.ts --output=./castes-list.json
 *   npx tsx src/scripts/caste-corrections/list.ts --caste=Nadar,Vanniyar
 *   npx tsx src/scripts/caste-corrections/list.ts --subCaste=Sozhia,Gramani
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync } from 'fs';
import mongoose from 'mongoose';
import 'dotenv/config';

import { connectMongo } from '../../services/connect-mongo.js';
import { parseArgs } from './helper.js';
import { User } from '../../models/index.js';

const DIR = dirname(fileURLToPath(import.meta.url))

type Row = {
  caste: string | null
  subCaste: string | null
  count: number
}

function listArg(args: Map<string, string>, key: string): string[] | undefined {
  const raw = args.get(key)
  if (!raw) return undefined
  const values = raw.split(',').map((v) => v.trim()).filter(Boolean)
  return values.length ? values : undefined
}

async function run() {
  const args = parseArgs()
  const output = args.get('output') || join(DIR, 'samples', 'list.json')
  const castes = listArg(args, 'caste')
  const subCastes = listArg(args, 'subCaste')

  await connectMongo()

  const match: Record<string, unknown> = {}
  if (castes) match['otherDetails.caste'] = { $in: castes }
  if (subCastes) match['otherDetails.subCaste'] = { $in: subCastes }

  const rows: Row[] = await User.aggregate([
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    {
      $group: {
        _id: { caste: '$otherDetails.caste', subCaste: '$otherDetails.subCaste' },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        caste: '$_id.caste',
        subCaste: '$_id.subCaste',
        count: 1,
      },
    },
    { $sort: { caste: 1, count: -1 } },
  ])

  writeFileSync(output, JSON.stringify(rows, null, 2))

  console.log(`${rows.length} distinct caste/subCaste combination(s) found.`)
  console.log(`Output: ${output}`)
  await mongoose.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
