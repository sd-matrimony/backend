import { Hono } from 'hono';

import { User, UserAccess } from '../models/index.js';
import { env } from '../utils/index.js';

const migrationRoutes = new Hono()

// migrations for updating schema
migrationRoutes
  .post('/', async (c) => {
    if (env.NODE_ENV === 'development') return c.json({ message: 'This route is only available in development mode' }, 400)

    // rename: paymentRefId -> payment
    // await UserAccess.updateMany(
    //   { paymentRefId: { $exists: true } },
    //   { $rename: { "paymentRefId": "payment" } }
    // )

    // await UserAccess.collection.dropIndex("viewer_1_viewed_1_paymentRefId_1")


    await User.updateMany(
      { createdBy: "" },
      [
        {
          $set: {
            "otherDetails.subCaste": "$otherDetails.caste",
            "otherDetails.caste": "Mudaliyar"
          }
        }
      ]
    );

    return c.json({ message: "Migration done" })
  })

export default migrationRoutes
