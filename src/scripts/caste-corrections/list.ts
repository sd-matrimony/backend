/**
 * List every distinct (caste, subCaste) combination currently in use across
 * users, with counts. Use this to spot misconfigured/duplicate caste entries
 * before writing a mapping.json for update.ts.
 *
 * Output: JSON array [{ caste, subCaste, count }], sorted by caste then count desc.
 *
 * Run (defaults write inside this folder):
 *   npx tsx src/scripts/caste-corrections/list.ts
 *   npx tsx src/scripts/caste-corrections/list.ts --output=./castes-list.json
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

async function run() {
  const args = parseArgs()
  const output = args.get('output') || join(DIR, 'castes-list.json')

  await connectMongo()

  const rows: Row[] = await User.aggregate([
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
