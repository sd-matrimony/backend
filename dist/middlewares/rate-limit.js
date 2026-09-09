import { getConnInfo } from '@hono/node-server/conninfo';
import { rateLimiter } from 'hono-rate-limiter';
import crypto from 'crypto';
import { t } from '../utils/i18n.js';
function createRateLimiter({ limit = 100, windowMs = 15 * 60 * 1000 } = {}) {
    return rateLimiter({
        limit,
        windowMs,
        standardHeaders: "draft-6",
        keyGenerator: (c) => {
            const { remote } = getConnInfo(c);
            const address = remote.address;
            const ua = c.req.header('user-agent') || '';
            const uaHash = crypto.createHash('sha256').update(ua).digest('hex').slice(0, 8);
            return `${address}-${uaHash}`;
        },
        handler: c => c.json({ message: t(c, "tooManyRequests") }, 429)
    });
}
export default createRateLimiter;
