/**
 * One-time migration script for legacy Cloudinary images.
 * Tags images referenced in user documents with the userId
 * so they can be bulk-deleted via deleteUserImages(userId).
 *
 * Run:   npx tsx src/scripts/migrate-cloudinary-images.ts
 * Retry: npx tsx src/scripts/migrate-cloudinary-images.ts --retry
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { connectMongo } from '../services/connect-mongo.js';
import { getCloudinary } from '../services/cloudinary.js';
import { User } from '../models/index.js';

const FAILED_LOG = './failed-migrations.json'

type FailedEntry = {
  userId: string
  url: string
  publicId: string
  reason: string
}

function extractPublicId(imageUrl: string): string | null {
  const uploadIndex = imageUrl.indexOf('/upload/')
  if (uploadIndex === -1) return null
  const afterUpload = imageUrl.slice(uploadIndex + '/upload/'.length)
  const withoutVersion = afterUpload.replace(/^v\d+\//, '')
  return withoutVersion.replace(/\.[^/.]+$/, '')
}

function saveFailedLog(entries: FailedEntry[]) {
  writeFileSync(FAILED_LOG, JSON.stringify(entries, null, 2))
  console.log(`Failed entries saved to ${FAILED_LOG}`)
}

async function run() {
  await connectMongo()
  const cloudinary = getCloudinary()

  const isRetry = process.argv.includes('--retry')
  let users: any[] = []

  if (isRetry) {
    if (!existsSync(FAILED_LOG)) {
      console.log('No failed-migrations.json found. Nothing to retry.')
      await mongoose.disconnect()
      return
    }
    const failed: FailedEntry[] = JSON.parse(readFileSync(FAILED_LOG, 'utf-8'))
    const userIds = [...new Set(failed.map(e => e.userId))]
    users = await User.find({ _id: { $in: userIds } }).select('_id profileImg images').lean()
    console.log(`Retrying ${failed.length} failed entries across ${users.length} users`)
  } else {
    users = await User.find({
      $or: [
        { profileImg: { $exists: true, $ne: '' } },
        { images: { $exists: true, $not: { $size: 0 } } },
      ],
    }).select('_id profileImg images').lean()
    console.log(`Found ${users.length} users with images`)
  }

  const failedEntries: FailedEntry[] = []
  let tagged = 0
  let skipped = 0

  for (const user of users) {
    const userId = user._id.toString()

    const urls: string[] = [
      ...(user.profileImg ? [user.profileImg] : []),
      ...(user.images ?? []),
    ]

    const publicIds: string[] = []
    for (const url of urls) {
      const publicId = extractPublicId(url)
      if (!publicId) { skipped++; continue }
      publicIds.push(publicId)
    }

    if (!publicIds.length) continue

    try {
      await cloudinary.uploader.replace_tag(userId, publicIds)
      tagged += publicIds.length
      console.log(`[${userId}] tagged ${publicIds.length} image(s)`)

    } catch (err: any) {
      for (const publicId of publicIds) {
        failedEntries.push({ userId, url: urls[publicIds.indexOf(publicId)], publicId, reason: err?.message })
      }
      console.error(`[${userId}] failed: ${err?.message}`)
    }
  }

  if (failedEntries.length) {
    saveFailedLog(failedEntries)
  } else if (isRetry && existsSync(FAILED_LOG)) {
    writeFileSync(FAILED_LOG, JSON.stringify([], null, 2))
    console.log('All retries succeeded. failed-migrations.json cleared.')
  }

  console.log(`\nDone — tagged: ${tagged}, skipped: ${skipped}, failed: ${failedEntries.length}`)
  await mongoose.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
