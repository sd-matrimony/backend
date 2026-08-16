import { v2 as cloudinary } from 'cloudinary';
import { env } from '../utils/enums.js';
export function getCloudinary() {
    const config = {
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_secret: env.CLOUDINARY_API_SECRET,
        api_key: env.CLOUDINARY_API_KEY,
        secure: true,
    };
    cloudinary.config(config);
    return cloudinary;
}
export async function getImgUrl(file, user_id) {
    const buffer = await file.arrayBuffer();
    const nodeBuffer = Buffer.from(buffer);
    const cloudinary = getCloudinary();
    const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({ folder: 'my_uploads', tags: [user_id || 'temp'] }, (error, result) => {
            if (error)
                reject(error);
            else
                resolve(result);
        });
        uploadStream.end(nodeBuffer);
    });
    return result.url;
}
function extractPublicId(imageUrl) {
    const uploadIndex = imageUrl.indexOf('/upload/');
    if (uploadIndex === -1)
        return null;
    const afterUpload = imageUrl.slice(uploadIndex + '/upload/'.length);
    const withoutVersion = afterUpload.replace(/^v\d+\//, '');
    return withoutVersion.replace(/\.[^/.]+$/, '');
}
export async function claimImage(imageUrl, userId) {
    const publicId = extractPublicId(imageUrl);
    if (!publicId)
        throw new Error(`Could not extract public_id from: ${imageUrl}`);
    const cloudinary = getCloudinary();
    await cloudinary.uploader.replace_tag(userId, [publicId]);
}
export async function deleteImg(public_id) {
    const cloudinary = getCloudinary();
    await cloudinary.uploader.destroy(`my_uploads/${public_id}`, { invalidate: true });
}
export async function deleteUserImages(userId) {
    const cloudinary = getCloudinary();
    await cloudinary.api.delete_resources_by_tag(userId, { invalidate: true });
}
