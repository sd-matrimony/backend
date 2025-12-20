import mongoose, { connect } from 'mongoose';
import { env } from '../utils/index.js';

export async function connectMongo() {
  try {
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected')
    })

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB error:', err)
    })

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected')
    })

    await connect(env.MONGODB_URL)
    console.log("MongoDB is connected now")

  } catch (error) {
    console.log("Can't connect to MongoDB", error)
    throw error
  }
}
