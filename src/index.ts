import { serveStatic } from '@hono/node-server/serve-static';
import { serve } from '@hono/node-server';

import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import { compress } from 'hono/compress';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { Hono } from 'hono';

import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import path from 'path';

import createRateLimiter from './middlewares/rate-limit.js';
import authMiddleware from './middlewares/auth.js';

import superAdminRoutes from './routes/super-admin.js';
import migrationRoutes from './routes/migration.js';
import extractorRoutes from './routes/extractor.js';
import accountRoutes from './routes/account.js';
import paymentRoutes from './routes/payment.js';
import adminRoutes from './routes/admin.js';
import fakerRoutes from './routes/faker.js';
import userRoutes from './routes/user.js';

import { connectMongo, connectRedis, redisClient } from './services/index.js';
import { env } from './utils/enums.js';

try {
  await Promise.all([connectMongo(), connectRedis()])
} catch (error) {
  process.exit(1)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const assestPath = env.NODE_ENV === "production"
  ? path.resolve(__dirname, "assets")
  : "./src/assets"

const app = new Hono().basePath("api")

app.use(logger())
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }))
app.use(secureHeaders())
app.use(compress())

app.use("/static/*",
  serveStatic({
    root: assestPath,
    rewriteRequestPath: (path) => path.replace(/^\/api\/static/, ""),
    onFound: (path, c) => {
      if (!path.includes("latest.json")) {
        c.header('Cache-Control', `public, max-age=${60 * 60 * 24 * 10}`) // 10 days
      }
    },
    onNotFound: () => {
      throw new HTTPException(404, {
        res: new Response(JSON.stringify({ message: "File not found" }), { status: 404 })
      })
    },
  })
)

app.route("/account", accountRoutes)

app.use(createRateLimiter())

app.get("/health", c => c.json({ status: "ok" }))

app.route("/faker", fakerRoutes)
app.route("/migration", migrationRoutes)

app.use(authMiddleware)

app.route("/user", userRoutes)
app.route("/admin", adminRoutes)
app.route("/payment", paymentRoutes)
app.route("/extractor", extractorRoutes)
app.route("/super-admin", superAdminRoutes)

app.notFound(c => c.json({ message: 'Route not found' }, 404))

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse()
  console.log(err)
  return c.json({ message: err?.message || "Internal sever eror" }, 500)
})

const port = Number(process.env.PORT || 5000)
console.log(`Server is running on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port
})

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...')
  try {
    await Promise.all([
      mongoose.connection.close(),
      redisClient.quit()
    ])
    console.log('Database connections closed')
    process.exit(0)

  } catch (err) {
    // console.error('Error during shutdown:', err)
    process.exit(1)
  }
})

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...')
  await mongoose.connection.close()
  await redisClient.quit()
  process.exit(0)
})