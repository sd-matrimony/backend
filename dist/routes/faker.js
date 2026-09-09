import { Hono } from 'hono';
import { env, t } from '../utils/index.js';
import { randomUsers } from '../controllers/faker.js';
import { User } from '../models/index.js';
const fakerRoutes = new Hono();
fakerRoutes
    .post('/', async (c) => {
    if (env.NODE_ENV === 'development')
        return c.json({ message: t(c, 'devOnlyRoute') }, 400);
    const users = await User.insertMany(await randomUsers());
    return c.json(users);
});
export default fakerRoutes;
