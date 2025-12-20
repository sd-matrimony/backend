// import ollama from 'ollama';

import type { extractImageSchema } from "../validations/extractor.js";
import type { zContext } from "../types/index.js";

// import { saveImageLocally } from "../utils/index.js";
import { getImgUrl } from "../services/cloudinary.js";

export async function extractImg(c: zContext<{ form: typeof extractImageSchema }>) {
  const { images } = c.req.valid("form")

  // const [detailImg, ...rest] = images
  // const imagePath = await saveImageLocally(detailImg)

  // const response = await ollama.chat({
  //   model: 'llava:7b',
  //   messages: [
  //     {
  //       role: 'system',
  //       content: `
  // You are a Tamil OCR and data extraction expert. The input will be an image of a biodata/matrimony profile in Tamil language. 

  // Use the following fields:
  // இனம், பெயர், பிறந்ததேதி / நேரம், பிறந்த ஊர், நட்சத்திரம், ராசி, லக்னம், கல்வி தகுதி, வேலை / சம்பளம், தந்தை பெயர், தாயார் பெயர், உடன்பிறந்த ஆண்கள், உடன்பிறந்த பெண்கள், பிறப்புவரிசை, இருப்பிடம்  

  // Your task:
  // - Extract all relevant data from the image.
  // - Do not add any explanation, notes, or markdown. Only return raw extracted data in JSON format.
  //       `
  //     },
  //     {
  //       role: 'user',
  //       content: 'Extract biodata and return in JSON',
  //       images: [imagePath]
  //     }
  //   ],
  // })

  const imagePaths = await Promise.all(images.map(async (image) => await getImgUrl(image)))

  return c.json({ imagePaths }) // extracted: response.message.content
}
