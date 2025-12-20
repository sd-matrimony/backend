import { Hono } from 'hono';

import { zv, extractImageSchema } from '../validations/index.js';
import { extractImg } from '../controllers/extractor.js';
import roleCheck from '../middlewares/role-check.js';

const extractorRoutes = new Hono()

extractorRoutes.use(roleCheck(["admin", "super-admin"]))

extractorRoutes
  .post('/', zv("form", extractImageSchema), extractImg)

export default extractorRoutes
