import crypto from "node:crypto";
import sharp from "sharp";

const MAX_DIMENSION = 1024;
const SECOND_PASS_DIMENSION = 800;
const MAX_TARGET_BYTES = 900 * 1024;

function extractBufferFromBase64(rawBase64) {
  const cleaned = String(rawBase64 || "")
    .trim()
    .replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/i, "")
    .replace(/\s+/g, "");

  if (!cleaned || cleaned.length < 32) {
    const err = new Error("Imagem inválida ou vazia para reconhecimento facial.");
    err.statusCode = 400;
    throw err;
  }

  return Buffer.from(cleaned, "base64");
}

async function compressToJpeg(inputBuffer, maxDim, quality) {
  return sharp(inputBuffer, { failOn: "truncated" })
    .rotate()
    .resize({
      width: maxDim,
      height: maxDim,
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
}

/**
 * Otimiza a imagem enviada (upload multipart ou base64), redimensiona com correção EXIF,
 * converte para JPEG enxuto e retorna base64 limpo pronto para a Zeroy API (/api/v1/reconnc).
 *
 * @param {Object} params
 * @param {Buffer} [params.buffer]
 * @param {string} [params.base64]
 * @param {string} [params.originalName]
 * @returns {Promise<{base64: string, mimeType: string, originalBytes: number, optimizedBytes: number, width: number|null, height: number|null, sha256: string, originalName: string}>}
 */
export async function optimizeFacialImageToBase64({ buffer = null, base64 = null, originalName = "face.jpg" } = {}) {
  const inputBuffer = Buffer.isBuffer(buffer) && buffer.length > 0 ? buffer : extractBufferFromBase64(base64);

  if (!inputBuffer || inputBuffer.length < 64) {
    const err = new Error("Arquivo de imagem inválido ou vazio.");
    err.statusCode = 400;
    throw err;
  }

  try {
    const metadata = await sharp(inputBuffer, { failOn: "truncated" }).metadata();
    if (!metadata || !metadata.width || !metadata.height) {
      const err = new Error("Formato de imagem não suportado. Envie JPG, PNG ou WEBP válido.");
      err.statusCode = 400;
      throw err;
    }

    let outputBuffer = await compressToJpeg(inputBuffer, MAX_DIMENSION, 82);
    if (outputBuffer.length > MAX_TARGET_BYTES) {
      outputBuffer = await compressToJpeg(inputBuffer, SECOND_PASS_DIMENSION, 72);
    }

    const outMeta = await sharp(outputBuffer).metadata().catch(() => ({}));
    const sha256 = crypto.createHash("sha256").update(outputBuffer).digest("hex");

    return {
      base64: outputBuffer.toString("base64"),
      mimeType: "image/jpeg",
      originalBytes: inputBuffer.length,
      optimizedBytes: outputBuffer.length,
      width: outMeta.width || null,
      height: outMeta.height || null,
      sha256,
      originalName: String(originalName || "face.jpg").slice(0, 100),
    };
  } catch (err) {
    if (err.statusCode) throw err;
    const wrapped = new Error("Não foi possível processar a imagem enviada. Certifique-se de enviar uma foto JPG, PNG ou WEBP válida.");
    wrapped.statusCode = 400;
    throw wrapped;
  }
}

export default { optimizeFacialImageToBase64 };
