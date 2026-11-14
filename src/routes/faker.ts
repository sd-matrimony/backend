import { Hono } from 'hono';

import { env, t } from '../utils/index.js';
import { randomUsers } from '../controllers/faker.js';
import { User } from '../models/index.js';
import { fakerSchema, zv } from '../validations/index.js';

const fakerRoutes = new Hono()

fakerRoutes
  .post('/', zv("query", fakerSchema), async (c) => {
    if (env.NODE_ENV === 'production') return c.json({ message: t(c, 'devOnlyRoute') }, 403)

    const { count } = c.req.valid("query") || { count: 50 }
    const users = await User.insertMany(await randomUsers(count))

    return c.json({ message: `${users.length} users created` })
  })

export default fakerRoutes
