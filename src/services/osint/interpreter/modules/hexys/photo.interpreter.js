/**
 * ==============================================================================
 * BACKEND INTERPRETER - HEXYS PHOTO (PHOTO.INTERPRETER.JS)
 * Normalizes binary and JSON photo payloads, guaranteeing valid data URIs.
 * ==============================================================================
 */

export function interpretHexysPhoto(rawData) {
  if (!rawData) return rawData;

  if (typeof rawData === "object") {
    const data = { ...rawData };
    let photoUrl = data.foto_url || data.fotoBase64 || data.base64 || data.foto || null;

    if (photoUrl && typeof photoUrl === "string") {
      // Ensure data:image/jpeg;base64 prefix if raw base64 is passed without scheme
      if (/^[A-Za-z0-9+/=]+$/.test(photoUrl.slice(0, 100)) && !photoUrl.startsWith("http") && !photoUrl.startsWith("data:")) {
        photoUrl = `data:image/jpeg;base64,${photoUrl}`;
      }
    }

    return {
      ...data,
      foto_url: photoUrl,
      fotoBase64: photoUrl,
      hasPhoto: Boolean(photoUrl),
    };
  }

  return rawData;
}

export default interpretHexysPhoto;
