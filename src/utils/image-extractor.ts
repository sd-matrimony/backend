import { promises as fsPromise } from 'fs';
import path from 'path';

function getFileExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp'
  }

  return map[mimeType] || 'jpg'
}

export async function saveImageLocally(file: any): Promise<string> {
  const uploadDir = path.resolve(process.cwd(), 'uploads')

  const buffer = await (file as Blob).arrayBuffer()

  const nodeBuffer = Buffer.from(buffer)

  const fileName = file.name || `image_${Date.now()}.${getFileExtension(file.type)}`

  const filePath = path.join(uploadDir, fileName)

  try {
    await fsPromise.mkdir(uploadDir, { recursive: true });
  } catch (error) {
    console.error('Error creating directory:', error);
    throw new Error('Failed to create upload directory');
  }

  try {
    await fsPromise.writeFile(filePath, nodeBuffer)
  } catch (error) {
    console.error('Error saving file:', error)
    throw new Error('Failed to save file')
  }

  return filePath
}
