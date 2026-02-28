// src/services/qa.service.js
const axios = require("axios");
const mongoose = require("mongoose");

const Document = require("../models/Document");
const DocumentChunk = require("../models/DocumentChunk");
const { createEmbedding } = require("./embedding.service");

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || "llama3.1:8b-instruct";

const VECTOR_INDEX = process.env.MONGO_VECTOR_INDEX || "vector_index"; // your index name
const VECTOR_PATH = process.env.MONGO_VECTOR_PATH || "embedding";      // embedding field name

function normalizeCategory(c) {
  return c ? String(c).trim().toUpperCase() : undefined;
}

function buildContext(chunks, docMap) {
  return chunks
    .map((c, i) => {
      const doc = docMap.get(String(c.documentId));
      const title = doc?.title || "Untitled";
      const pages =
        c.pageStart != null && c.pageEnd != null ? `p.${c.pageStart}-${c.pageEnd}` : "p.?";
      return `SOURCE [${i + 1}] — ${title} (${pages})\n${c.chunkText}\n`;
    })
    .join("\n");
}

async function ollamaGenerate(prompt) {
  const resp = await axios.post(`${OLLAMA_URL}/api/generate`, {
    model: OLLAMA_CHAT_MODEL,
    prompt,
    stream: false,
    options: { temperature: 0.2 },
  });

  return String(resp?.data?.response || "").trim();
}

/**
 * Security: only search chunks from documents owned by this user
 * because chunks link to documents via `documentId`.
 */
async function retrieveChunksSecure({ userId, question, topK, category, documentId }) {
  const docsFilter = {  status: "READY" };

  const cat = normalizeCategory(category);
  if (cat) docsFilter.category = cat;

  if (documentId && mongoose.Types.ObjectId.isValid(documentId)) {
    docsFilter._id = new mongoose.Types.ObjectId(documentId);
  }

  const docs = await Document.find(docsFilter).select("_id title category docType");
  if (!docs.length) return { docs: [], chunks: [] };

  const allowedDocIds = docs.map((d) => d._id);
  const queryVector = await createEmbedding(String(question || "").trim());

  const limit = Math.min(Math.max(Number(topK) || 6, 3), 12);

  const chunks = await DocumentChunk.aggregate([
    {
      $vectorSearch: {
        index: VECTOR_INDEX,
        path: VECTOR_PATH,
        queryVector,
        numCandidates: 200,
        limit,
        filter: { documentId: { $in: allowedDocIds } },
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
  ]);

  return { docs, chunks };
}

async function answerQuestion({ userId, question, topK = 6, category, documentId }) {
  const q = String(question || "").trim();
  if (!q) throw new Error("Question is required");

  const { docs, chunks } = await retrieveChunksSecure({ userId, question: q, topK, category, documentId });

  if (!chunks.length) {
    return {
      answer:
        "I couldn’t find relevant information in your READY documents. Please process your PDFs (so they become READY) or upload the right one. Not legal advice.",
      sources: [],
    };
  }

  const docMap = new Map(docs.map((d) => [String(d._id), d]));
  const contextText = buildContext(chunks, docMap);

  const systemRules =
    "You are MUFASHE, a legal information assistant. " +
    "Use ONLY the provided SOURCES. " +
    "If sources are not enough, say so and ask what document to upload/clarify. " +
    "Do not invent laws or procedures. " +
    "Add citations like [1], [2] matching SOURCE numbers. " +
    "End with: Not legal advice.";

  const prompt =
    `${systemRules}\n\n` +
    `Question:\n${q}\n\n` +
    `Sources:\n${contextText}\n\n` +
    `Answer:\n`;

  const answer = await ollamaGenerate(prompt);

  const sources = chunks.map((c, i) => ({
    n: i + 1,
    documentId: c.documentId,
    title: docMap.get(String(c.documentId))?.title || "Untitled",
    pageStart: c.pageStart ?? null,
    pageEnd: c.pageEnd ?? null,
    score: c.score ?? null,
    snippet: String(c.chunkText || "").slice(0, 220),
  }));

  return {
    answer: answer || "I couldn’t generate an answer from the sources. Not legal advice.",
    sources,
  };
}

module.exports = { answerQuestion };