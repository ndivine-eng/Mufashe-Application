// src/services/chunk.service.js

/**
 * Split text into chunks with overlap.
 *
 * chunkSize: max characters per chunk
 * overlap: repeated characters from previous chunk (helps context)
 */
function splitIntoChunks(text, chunkSize = 1200, overlap = 200) {
  const cleaned = String(text || "").trim();
  if (!cleaned) return [];

  const chunks = [];
  let start = 0;
  let index = 0;

  while (start < cleaned.length) {
    const end = Math.min(start + chunkSize, cleaned.length);
    const chunkText = cleaned.slice(start, end).trim();

    if (chunkText.length > 0) {
      chunks.push({ chunkIndex: index, chunkText });
      index++;
    }

    // move forward but keep overlap
    start = end - overlap;
    if (start < 0) start = 0;

    // safety break to avoid infinite loops
    if (end === cleaned.length) break;
  }

  return chunks;
}

module.exports = { splitIntoChunks };