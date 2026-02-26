// src/services/vectorSearch.mongo.service.js
const mongoose = require("mongoose");
const DocumentChunk = require("../models/DocumentChunk");
const { createEmbedding } = require("./embedding.service");

async function vectorSearch(question, { limit = 5, documentId = null } = {}) {
  const q = String(question || "").trim();
  if (!q) throw new Error("Question is required");

  const queryVector = await createEmbedding(q);

  const filter =
    documentId && mongoose.Types.ObjectId.isValid(documentId)
      ? { documentId: new mongoose.Types.ObjectId(documentId) }
      : undefined;

  const pipeline = [
    {
      $vectorSearch: {
        index: "vector_index", // must match Atlas index name
        path: "embedding",
        queryVector,
        numCandidates: 200,
        limit: Number(limit) || 5,
        ...(filter ? { filter } : {}),
      },
    },
    {
      $project: {
        _id: 1,
        documentId: 1,
        chunkIndex: 1,
        chunkText: 1,
        pageStart: 1,
        pageEnd: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ];

  return DocumentChunk.aggregate(pipeline);
}

module.exports = { vectorSearch };