import type { ConfigOptions, UploadApiResponse } from 'cloudinary';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../utils/enums.js';

export const TEMP_TAG = 'temp'
export const TEMP_FOLDER = 'temp'
export const MAX_IMAGE_DIMENSION = 1600

// Applied on upload so only the compressed version is stored.
export const incomingTransformation = [
  { width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, crop: 'limit', quality: 'auto:good' },
]

export function getCloudinary() {
  const config: ConfigOptions = {
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_secret: env.CLOUDINARY_API_SECRET,
    api_key: env.CLOUDINARY_API_KEY,
    secure: true,
  }

  cloudinary.config(config)

  return cloudinary
}

export function userFolder(userId: string) {
  return `users/${userId}`
}

export function publicIdFromUrl(imageUrl: string): string | null {
  const uploadIndex = imageUrl.indexOf('/upload/')
  if (uploadIndex === -1) return null
  const afterUpload = imageUrl.slice(uploadIndex + '/upload/'.length)
  const withoutVersion = afterUpload.replace(/^v\d+\//, '')
  return withoutVersion.replace(/\.[^/.]+$/, '')
}

export function isUserImage(imageUrl: string, userId: string) {
  return publicIdFromUrl(imageUrl)?.startsWith(`${userFolder(userId)}/`) ?? false
}

export async function getImgUrl(file: Blob, userId?: string): Promise<string> {
  const nodeBuffer = Buffer.from(await file.arrayBuffer())
  const client = getCloudinary()

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const uploadStream = client.uploader.upload_stream(
      {
        folder: userId ? userFolder(userId) : TEMP_FOLDER,
        tags: [userId || TEMP_TAG],
        transformation: incomingTransformation,
      },
      (error, result) => {
        if (error || !result) reject(error)
        else resolve(result)
      }
    )

    uploadStream.end(nodeBuffer)
  })

  return result.secure_url
}

/**
 * Moves an image uploaded before signup (tagged "temp") into the user's folder.
 * Images that are not temp uploads are returned untouched, so nobody can claim
 * another user's image by sending its URL.
 */
export async function claimImage(imageUrl: string, userId: string): Promise<string> {
  const publicId = publicIdFromUrl(imageUrl)
  if (!publicId) return imageUrl

  const client = getCloudinary()
  const resource = await client.api.resource(publicId, { tags: true }).catch(() => null)
  if (!resource || !resource.tags?.includes(TEMP_TAG)) return imageUrl

  const fileName = publicId.split('/').pop()
  const renamed = await client.uploader.rename(publicId, `${userFolder(userId)}/${fileName}`, { overwrite: false })
  await client.uploader.replace_tag(userId, [renamed.public_id])

  return renamed.secure_url
}

type userImagesT = {
  profileImg?: string
  images?: string[]
  vedicHoroscope?: { vedicHoroscopePic?: string }
}

// Claims every temp image referenced by a new user and returns the fields with the moved URLs.
export async function claimUserImages<T extends userImagesT>(data: T, userId: string): Promise<T> {
  const urls = [...new Set([
    ...(data.profileImg ? [data.profileImg] : []),
    ...(data.images ?? []),
    ...(data.vedicHoroscope?.vedicHoroscopePic ? [data.vedicHoroscope.vedicHoroscopePic] : []),
  ])]
  if (!urls.length) return data

  const claimed = new Map(await Promise.all(urls.map(async url => [url, await claimImage(url, userId)] as const)))
  const moved = (url?: string) => (url && claimed.get(url)) || url

  return {
    ...data,
    ...(data.profileImg && { profileImg: moved(data.profileImg) }),
    ...(data.images && { images: data.images.map(url => moved(url) as string) }),
    ...(data.vedicHoroscope?.vedicHoroscopePic && {
      vedicHoroscope: { ...data.vedicHoroscope, vedicHoroscopePic: moved(data.vedicHoroscope.vedicHoroscopePic) },
    }),
  }
}

export async function deleteImageByUrl(imageUrl: string) {
  const publicId = publicIdFromUrl(imageUrl)
  if (!publicId) return
  await getCloudinary().uploader.destroy(publicId, { invalidate: true })
}

export async function deleteUserImages(userId: string) {
  const client = getCloudinary()
  await client.api.delete_resources_by_tag(userId, { invalidate: true })
  await client.api.delete_resources_by_prefix(`${userFolder(userId)}/`, { invalidate: true })
}

export async function deleteTempImagesOlderThan(hours: number, includeLegacy = false) {
  const client = getCloudinary()
  const cutoff = Date.now() - hours * 60 * 60 * 1000
  let deleted = 0
  let nextCursor: string | undefined

  do {
    const page = await client.api.resources_by_tag(TEMP_TAG, { max_results: 500, next_cursor: nextCursor })
    const stale = page.resources
      .filter((resource: { public_id: string, created_at: string }) =>
        (includeLegacy || resource.public_id.startsWith(`${TEMP_FOLDER}/`)) &&
        new Date(resource.created_at).getTime() < cutoff
      )
      .map((resource: { public_id: string }) => resource.public_id)

    if (stale.length) {
      await client.api.delete_resources(stale, { invalidate: true })
      deleted += stale.length
    }

    nextCursor = page.next_cursor
  } while (nextCursor)

  return deleted
}
