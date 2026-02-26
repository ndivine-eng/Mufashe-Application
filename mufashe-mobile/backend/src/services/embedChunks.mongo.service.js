// src/services/embedChunks.mongo.service.js
const mongoose = require("mongoose");
const DocumentChunk = require("../models/DocumentChunk");
const { createEmbedding } = require("./embedding.service");

async function embedChunksForDocument(documentId) {
  if (!mongoose.Types.ObjectId.isValid(documentId)) {
    throw new Error("Invalid documentId");
  }

  const docObjectId = new mongoose.Types.ObjectId(documentId);

  const chunks = await DocumentChunk.find({ documentId: docObjectId }).sort({ chunkIndex: 1 });

  if (!chunks.length) {
    return { total: 0, embeddedNow: 0, alreadyEmbedded: 0 };
  }

  let embeddedNow = 0;

  for (const chunk of chunks) {
    if (Array.isArray(chunk.embedding) && chunk.embedding.length > 0) continue;

    const vec = await createEmbedding(chunk.chunkText);
    chunk.embedding = vec;
    await chunk.save();
    embeddedNow += 1;
  }

  return {
    total: chunks.length,
    embeddedNow,
    alreadyEmbedded: chunks.length - embeddedNow,
  };
}

module.exports = { embedChunksForDocument };