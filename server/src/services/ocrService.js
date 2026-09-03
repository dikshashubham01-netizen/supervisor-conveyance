import { createWorker } from 'tesseract.js';
import fs from 'fs';

/**
 * Extracts and sanitizes numerical digits from raw OCR text
 * Handles common odometer misreads (O->0, I/l->1, B->8, S->5)
 */
export function parseOdometerNumber(text) {
  if (!text) return null;

  // Clean and normalize text
  const clean = text
    .toUpperCase()
    .replace(/[O]/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/[B]/g, '8')
    .replace(/[S]/g, '5')
    .replace(/[,.]/g, ''); // strip thousand separators

  // Match 3 to 7 consecutive digits
  const matches = clean.match(/\b\d{3,7}\b/g);
  if (matches && matches.length > 0) {
    // Pick the most likely odometer candidate (usually the longest or last number before KM)
    const candidate = matches[0];
    const val = parseFloat(candidate);
    return isNaN(val) ? null : val;
  }

  // Fallback: any sequence of digits
  const anyDigits = clean.replace(/\D+/g, '');
  if (anyDigits.length >= 3 && anyDigits.length <= 7) {
    const val = parseFloat(anyDigits);
    return isNaN(val) ? null : val;
  }

  return null;
}

/**
 * Runs OCR on an image file on the server
 */
export async function performServerOcr(imagePath) {
  try {
    if (!fs.existsSync(imagePath)) {
      return { detectedKm: null, confidence: 0, rawText: '' };
    }

    const worker = await createWorker('eng');
    const ret = await worker.recognize(imagePath);
    await worker.terminate();

    const rawText = ret.data.text || '';
    const confidence = ret.data.confidence || 0;
    const detectedKm = parseOdometerNumber(rawText);

    return {
      detectedKm,
      confidence: Math.round(confidence),
      rawText: rawText.trim()
    };
  } catch (err) {
    console.error('Server OCR error:', err.message);
    return { detectedKm: null, confidence: 0, rawText: '', error: err.message };
  }
}
