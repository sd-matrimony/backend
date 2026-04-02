import type { ConfigOptions } from 'cloudinary';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../utils/enums.js';

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

export async function getImgUrl(file: any, user_id?: string): Promise<string> {
  const buffer = await (file as Blob).arrayBuffer()
  const nodeBuffer = Buffer.from(buffer)

  const cloudinary = getCloudinary()
  const result: any = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'my_uploads', tags: [user_id || 'temp'] },
      (error: any, result: any) => {
        if (error) reject(error)
        else resolve(result)
      }
    )

    uploadStream.end(nodeBuffer)
  })

  return result.url
}

function extractPublicId(imageUrl: string): string | null {
  const uploadIndex = imageUrl.indexOf('/upload/')
  if (uploadIndex === -1) return null
  const afterUpload = imageUrl.slice(uploadIndex + '/upload/'.length)
  const withoutVersion = afterUpload.replace(/^v\d+\//, '')
  return withoutVersion.replace(/\.[^/.]+$/, '')
}

export async function claimImage(imageUrl: string, userId: string): Promise<void> {
  const publicId = extractPublicId(imageUrl)
  if (!publicId) throw new Error(`Could not extract public_id from: ${imageUrl}`)
  const cloudinary = getCloudinary()
  await cloudinary.uploader.replace_tag(userId, [publicId])
}

export async function deleteImg(public_id: string) {
  const cloudinary = getCloudinary()
  await cloudinary.uploader.destroy(`my_uploads/${public_id}`, { invalidate: true })
}

export async function deleteUserImages(userId: string) {
  const cloudinary = getCloudinary()
  await cloudinary.api.delete_resources_by_tag(userId, { invalidate: true })
}
