// src/models/DocumentChunk.js
const mongoose = require("mongoose");

const DocumentChunkSchema = new mongoose.Schema(
  {
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document", required: true, index: true },
    chunkIndex: { type: Number, required: true, index: true },
    chunkText: { type: String, required: true },

    pageStart: { type: Number, default: null },
    pageEnd: { type: Number, default: null },

    embedding: { type: [Number], default: [] }, // Step 6
  },
  { timestamps: true }
);

DocumentChunkSchema.index({ documentId: 1, chunkIndex: 1 }, { unique: true });

module.exports = mongoose.model("DocumentChunk", DocumentChunkSchema);