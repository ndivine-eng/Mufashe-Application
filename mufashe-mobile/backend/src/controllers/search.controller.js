// src/controllers/search.controller.js
const { embedChunksForDocument } = require("../services/embedChunks.mongo.service");
const { vectorSearch } = require("../services/vectorSearch.mongo.service");

/**
 * POST /api/search/embed/:documentId
 * Creates embeddings for all chunks of a document and stores them in MongoDB.
 * (Make admin-only if you want)
 */
exports.embedDocumentChunks = async (req, res) => {
  try {
    const { documentId } = req.params;

    const result = await embedChunksForDocument(documentId);

    return res.json({
      ok: true,
      message: "Embeddings created and saved in MongoDB",
      documentId,
      ...result,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: "Embedding chunks failed",
      error: err.message,
    });
  }
};

/**
 * POST /api/search/semantic
 * Body: { question, topK=5, documentId(optional) }
 */
exports.semanticSearch = async (req, res) => {
  try {
    const { question, topK = 5, documentId } = req.body || {};

    if (!question || String(question).trim().length < 3) {
      return res.status(400).json({ message: "question is required (min 3 chars)" });
    }

    const results = await vectorSearch(String(question), {
      limit: Number(topK) || 5,
      documentId: documentId || null,
    });

    return res.json({
      ok: true,
      question,
      topK: Number(topK) || 5,
      results, // each result already contains chunkText + score
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: "Semantic search failed",
      error: err.message,
    });
  }
};