// src/services/qa.service.js
const axios = require("axios");
const mongoose = require("mongoose");

const Document = require("../models/Document");
const DocumentChunk = require("../models/DocumentChunk");
const { createEmbedding } = require("./embedding.service");

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const OLLAMA_CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || "gemma3:4b";

const VECTOR_INDEX = process.env.MONGO_VECTOR_INDEX || "vector_index";
const VECTOR_PATH = process.env.MONGO_VECTOR_PATH || "embedding";

function normalizeCategory(c) {
  return c ? String(c).trim().toUpperCase() : undefined;
}

function shortText(text, max = 700) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max) + "...";
}

function dedupeChunks(chunks) {
  const seen = new Set();
  const result = [];

  for (const chunk of chunks) {
    const key = `${String(chunk.documentId)}::${shortText(chunk.chunkText, 220)}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(chunk);
    }
  }

  return result;
}

function buildContext(chunks, docMap) {
  return chunks
    .map((c, i) => {
      const doc = docMap.get(String(c.documentId));
      const title = doc?.title || "Untitled";
      const pages =
        c.pageStart != null && c.pageEnd != null
          ? `p.${c.pageStart}-${c.pageEnd}`
          : "p.?";

      return `SOURCE [${i + 1}] — ${title} (${pages})\n${shortText(c.chunkText, 700)}\n`;
    })
    .join("\n");
}

async function ollamaGenerate(prompt) {
  console.log("QA SERVICE: ollamaGenerate start");
  console.log("QA SERVICE: OLLAMA_URL =", OLLAMA_URL);
  console.log("QA SERVICE: MODEL =", OLLAMA_CHAT_MODEL);
  console.log("QA SERVICE: prompt length =", prompt.length);

  const resp = await axios.post(
    `${OLLAMA_URL}/api/generate`,
    {
      model: OLLAMA_CHAT_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: 0.2,
        num_predict: 220,
      },
    },
    {
      timeout: 180000,
    }
  );

  console.log("QA SERVICE: ollamaGenerate done");
  return String(resp?.data?.response || "").trim();
}

async function retrieveChunksSecure({ userId, question, topK, category, documentId }) {
  console.log("QA SERVICE: retrieveChunksSecure start");
  console.log("QA SERVICE: userId =", userId);
  console.log("QA SERVICE: question =", question);

  const docsFilter = { status: "READY" };

  const cat = normalizeCategory(category);
  if (cat) docsFilter.category = cat;

  if (documentId && mongoose.Types.ObjectId.isValid(documentId)) {
    docsFilter._id = new mongoose.Types.ObjectId(documentId);
  }

  console.log("QA SERVICE: docsFilter =", docsFilter);

  const docs = await Document.find(docsFilter).select("_id title category docType");
  console.log("QA SERVICE: docs found =", docs.length);

  if (!docs.length) {
    return { docs: [], chunks: [] };
  }

  const allowedDocIds = docs.map((d) => d._id);
  console.log("QA SERVICE: allowedDocIds count =", allowedDocIds.length);

  console.log("QA SERVICE: creating embedding...");
  const queryVector = await createEmbedding(String(question || "").trim());
  console.log(
    "QA SERVICE: embedding done, length =",
    Array.isArray(queryVector) ? queryVector.length : "not-array"
  );

  const limit = Math.min(Math.max(Number(topK) || 4, 2), 4);
  console.log("QA SERVICE: vector search limit =", limit);
  console.log("QA SERVICE: VECTOR_INDEX =", VECTOR_INDEX);
  console.log("QA SERVICE: VECTOR_PATH =", VECTOR_PATH);

  const chunks = await DocumentChunk.aggregate([
    {
      $vectorSearch: {
        index: VECTOR_INDEX,
        path: VECTOR_PATH,
        queryVector,
        numCandidates: 100,
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

  console.log("QA SERVICE: chunks found =", chunks.length);
  return { docs, chunks };
}

async function answerQuestion({ userId, question, topK = 4, category, documentId }) {
  console.log("========== QA SERVICE START ==========");
  const q = String(question || "").trim();

  if (!q) {
    throw new Error("Question is required");
  }

  const { docs, chunks } = await retrieveChunksSecure({
    userId,
    question: q,
    topK,
    category,
    documentId,
  });

  if (!chunks.length) {
    console.log("QA SERVICE: no chunks found");
    return {
      answer:
        "I couldn’t find relevant information in your READY documents. Please process your PDFs so they become READY, or upload the correct one. Not legal advice.",
      sources: [],
    };
  }

  const uniqueChunks = dedupeChunks(chunks).slice(0, 3);
  console.log("QA SERVICE: unique chunks =", uniqueChunks.length);

  const docMap = new Map(docs.map((d) => [String(d._id), d]));
  const contextText = buildContext(uniqueChunks, docMap);
  console.log("QA SERVICE: context built, length =", contextText.length);

  const prompt =
    `You are MUFASHE, a legal information assistant.\n` +
    `Use only the sources below.\n` +
    `Answer in simple English.\n` +
    `If the sources are not enough, say so clearly.\n` +
    `Do not invent laws.\n` +
    `Use citations like [1], [2].\n` +
    `End with: Not legal advice.\n\n` +
    `Question:\n${q}\n\n` +
    `Sources:\n${contextText}\n\n` +
    `Answer briefly:\n`;

  console.log("QA SERVICE: generating final answer...");
  const answer = await ollamaGenerate(prompt);
  console.log("QA SERVICE: final answer generated");

  const sources = uniqueChunks.map((c, i) => ({
    n: i + 1,
    documentId: c.documentId,
    title: docMap.get(String(c.documentId))?.title || "Untitled",
    pageStart: c.pageStart ?? null,
    pageEnd: c.pageEnd ?? null,
    score: c.score ?? null,
    snippet: shortText(c.chunkText, 220),
  }));

  console.log("QA SERVICE: sources built =", sources.length);
  console.log("========== QA SERVICE SUCCESS ==========");

  return {
    answer: answer || "I couldn’t generate an answer from the sources. Not legal advice.",
    sources,
  };
}

module.exports = { answerQuestion };