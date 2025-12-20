import { z } from "zod";

import { imgFileSchema } from "./general.js";

export const extractImageSchema = z.object({
  images: z.array(imgFileSchema).length(2, "Exactly two images are required"),
})
