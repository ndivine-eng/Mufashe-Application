// src/services/documentProcess.service.js
const Document = require("../models/Document");
const DocumentChunk = require("../models/DocumentChunk");

const { extractTextFromPdfFile } = require("./pdf.service");
const { splitIntoChunks } = require("./chunk.service");
const { createEmbedding } = require("./embedding.service");

/**
 * Process ONE document:
 * - Extract text from PDF
 * - Chunk text into DocumentChunk
 * - Embed each chunk into DocumentChunk.embedding
 * - Update Document status: UPLOADED -> PROCESSING -> READY/FAILED
 */
async function processOneDocument(documentId) {
  const doc = await Document.findById(documentId);
  if (!doc) throw new Error("Document not found");
  if (!doc.fileKey) throw new Error("No file attached to document");

  // mark PROCESSING
  doc.status = "PROCESSING";
  doc.errorMessage = null;
  await doc.save();

  try {
    // Step 4: extract text
    const { text, pageCount } = await extractTextFromPdfFile(doc.fileKey);

    doc.extractedText = text;
    doc.textLength = text.length;
    doc.pageCount = pageCount;
    doc.processedAt = new Date();

    // Step 5: chunk
    const chunks = splitIntoChunks(text, 1200, 200);

    // remove old chunks (reprocess safe)
    await DocumentChunk.deleteMany({ documentId: doc._id });

    // insert chunks (fast)
    let createdChunks = [];
    if (chunks.length > 0) {
      createdChunks = await DocumentChunk.insertMany(
        chunks.map((c) => ({
          documentId: doc._id,
          chunkIndex: c.chunkIndex,
          chunkText: c.chunkText,
          pageStart: null,
          pageEnd: null,
          embedding: [], // fill below
        }))
      );
    }

    // Step 6: embed each chunk (sequential to avoid rate limits)
    let embeddingsSaved = 0;
    for (const ch of createdChunks) {
      const vec = await createEmbedding(ch.chunkText);
      await DocumentChunk.updateOne({ _id: ch._id }, { $set: { embedding: vec } });
      embeddingsSaved += 1;
    }

    // mark READY
    doc.status = "READY";
    await doc.save();

    return {
      id: String(doc._id),
      status: doc.status,
      pageCount,
      textLength: doc.textLength,
      processedAt: doc.processedAt,
      chunksCreated: createdChunks.length,
      embeddingsSaved,
    };
  } catch (err) {
    doc.status = "FAILED";
    doc.errorMessage = err.message;
    await doc.save();
    throw err;
  }
}

module.exports = { processOneDocument };