import bcrypt from 'bcryptjs';
// import { promisify } from 'util';
// import crypto from 'crypto';

// const randomBytesAsync = promisify(crypto.randomBytes)
// const scryptAsync = promisify(crypto.scrypt)

export async function hashPassword(password: string): Promise<string> {
  // const salt = await randomBytesAsync(16)
  // const hash = await scryptAsync(password, salt, 32) as Buffer
  // return `${salt.toString('hex')}:${hash.toString('hex')}`
  return await bcrypt.hash(password, 10)
}

export async function comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
  // const [salt, hash] = hashedPassword.split(':')
  // const hashedInput = await scryptAsync(password, Buffer.from(salt, 'hex'), 32) as Buffer
  // return hash === hashedInput.toString('hex')
  return await bcrypt.compare(password, hashedPassword)
}
