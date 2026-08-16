/**
 * Loop through every user and normalize otherDetails.caste/subCaste:
 *   - trim leading/trailing whitespace
 *   - if a field is missing/null, set it to "" (empty string)
 * Fields already a trimmed string (including "") are left untouched.
 *
 * Draft by default (read-only: reports how many users would change).
 * Pass --apply to actually perform the updates.
 *
 * Resumable: cursor position checkpointed to a state file after each batch.
 * Re-running with --apply resumes after the last processed _id. Pass
 * --restart to ignore the checkpoint and re-scan from the start.
 *
 * Undo: every --apply run writes an NDJSON undo log ({ id, caste, subCaste }
 * per touched user, their values from right before this run's writes) next to
 * the state file — same format revert.ts expects. Revert with:
 *   npx tsx src/scripts/caste-corrections/revert.ts --undo=<path> --apply
 *
 * Run:
 *   npx tsx src/scripts/caste-corrections/normalize.ts            # draft
 *   npx tsx src/scripts/caste-corrections/normalize.ts --apply
 *   npx tsx src/scripts/caste-corrections/normalize.ts --apply --restart
 */
import { appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import 'dotenv/config';
import { parseArgs, loadState, saveState } from './helper.js';
import { connectMongo } from '../../services/connect-mongo.js';
import { User } from '../../models/index.js';
const DIR = dirname(fileURLToPath(import.meta.url));
const BATCH_SIZE = 500;
function resolveArgs() {
    const raw = parseArgs();
    return {
        state: raw.get('state') || join(DIR, 'normalize-state.json'),
        apply: raw.get('apply') === 'true',
        restart: raw.get('restart') === 'true',
    };
}
function normalize(v) {
    return v === undefined || v === null ? '' : v.trim();
}
function changed(raw, next) {
    return raw === undefined || raw === null ? next !== '' : raw !== next;
}
async function run() {
    const { state: statePath, apply, restart } = resolveArgs();
    const state = loadState(statePath, restart, {
        lastId: null,
        scanned: 0,
        changed: 0,
    });
    await connectMongo();
    console.log(`Mode: ${apply ? 'APPLY' : 'DRAFT (dry run, no writes)'}`);
    if (state.lastId)
        console.log(`Resuming after _id=${state.lastId} (scanned=${state.scanned}, changed=${state.changed})`);
    const undoPath = apply ? `${statePath}.undo.${Date.now()}.ndjson` : null;
    if (undoPath)
        console.log(`Undo log: ${undoPath}`);
    console.log();
    while (true) {
        const query = state.lastId
            ? { _id: { $gt: new mongoose.Types.ObjectId(state.lastId) } }
            : {};
        const batch = await User.find(query)
            .sort({ _id: 1 })
            .limit(BATCH_SIZE)
            .select('otherDetails.caste otherDetails.subCaste')
            .lean();
        if (batch.length === 0)
            break;
        const undoLines = [];
        const ops = [];
        for (const u of batch) {
            const rawCaste = u.otherDetails?.caste;
            const rawSubCaste = u.otherDetails?.subCaste;
            const newCaste = normalize(rawCaste);
            const newSubCaste = normalize(rawSubCaste);
            const casteChanged = changed(rawCaste, newCaste);
            const subCasteChanged = changed(rawSubCaste, newSubCaste);
            if (!casteChanged && !subCasteChanged)
                continue;
            state.changed++;
            if (!apply)
                continue;
            undoLines.push(JSON.stringify({
                id: u._id.toString(),
                caste: rawCaste ?? null,
                subCaste: rawSubCaste ?? null,
            }));
            const set = {};
            if (casteChanged)
                set['otherDetails.caste'] = newCaste;
            if (subCasteChanged)
                set['otherDetails.subCaste'] = newSubCaste;
            ops.push({ updateOne: { filter: { _id: u._id }, update: { $set: set } } });
        }
        if (apply && undoLines.length)
            appendFileSync(undoPath, undoLines.join('\n') + '\n');
        if (apply && ops.length)
            await User.bulkWrite(ops);
        state.scanned += batch.length;
        state.lastId = batch[batch.length - 1]._id.toString();
        saveState(statePath, state);
        console.log(`scanned=${state.scanned} changed=${state.changed} (last _id=${state.lastId})`);
        if (batch.length < BATCH_SIZE)
            break;
    }
    console.log();
    console.log(apply
        ? `Done. ${state.changed} user(s) updated.`
        : `Draft complete — ${state.changed} user(s) would change. Re-run with --apply to perform the updates.`);
    await mongoose.disconnect();
}
run().catch((err) => {
    console.error(err);
    process.exit(1);
});
