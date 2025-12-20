import { Hono } from 'hono';
import { env } from '../utils/index.js';
import { randomUsers } from '../controllers/faker.js';
import { User } from '../models/index.js';

const fakerRoutes = new Hono()

fakerRoutes
  .post('/', async (c) => {
    if (env.NODE_ENV === 'development') return c.json({ message: 'This route is only available in development mode' }, 400)

    const users = await User.insertMany(randomUsers())

    return c.json(users)
  })

export default fakerRoutes
