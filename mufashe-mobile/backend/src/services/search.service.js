// src/services/search.service.js
// Step 6: Semantic search (embed question -> Qdrant search -> return chunk payloads)

const { embedTexts } = require("./embeddingClient");
const { searchPoints, ensureCollection } = require("./qdrant.service");
const DocumentChunk = require("../models/DocumentChunk");

/**
 * Semantic search using Qdrant + MongoDB chunks
 * @param {Object} params
 * @param {string} params.question
 * @param {number} params.topK
 * @param {string=} params.documentId (optional)
 * @returns {Promise<Array>}
 */
async function semanticSearch({ question, topK = 5, documentId = null }) {
  if (!question || String(question).trim().length < 3) {
    throw new Error("Question is too short");
  }

  // 1) Embed the question (FastAPI)
  const { vectors } = await embedTexts([String(question)]);
  const queryVector = vectors?.[0];
  if (!queryVector) throw new Error("Embedder returned no vector");

  // 2) Search Qdrant
  await ensureCollection();

  const filter = documentId
    ? {
        must: [
          { key: "documentId", match: { value: String(documentId) } },
        ],
      }
    : null;

  const qdrantResults = await searchPoints(queryVector, topK, filter);
  // qdrantResults = [{ id, score, payload }, ...]

  // 3) Hydrate with Mongo chunk text (recommended)
  const chunkIds = qdrantResults.map((r) => r.payload?.chunkId).filter(Boolean);

  const chunks = await DocumentChunk.find({ _id: { $in: chunkIds } })
    .select("_id documentId chunkIndex chunkText pageNumber")
    .lean();

  const chunkMap = new Map(chunks.map((c) => [String(c._id), c]));

  return qdrantResults.map((r) => {
    const payload = r.payload || {};
    const chunk = chunkMap.get(String(payload.chunkId)) || null;

    return {
      score: r.score,
      documentId: payload.documentId || null,
      chunkId: payload.chunkId || null,
      chunkIndex: payload.chunkIndex ?? (chunk ? chunk.chunkIndex : null),
      pageNumber: chunk?.pageNumber ?? null,
      text: chunk?.chunkText ?? null, // this is what you show to user
    };
  });
}

module.exports = { semanticSearch };