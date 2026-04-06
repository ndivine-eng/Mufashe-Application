// src/services/qa.service.js
// This service implements the core logic for answering legal questions. It retrieves relevant document chunks based on the user's question, constructs a prompt for the language model, generates an answer, and returns the answer along with performance metrics and sources used.

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
          : c.pageStart != null
          ? `p.${c.pageStart}`
          : "p.?";

      return `SOURCE [${i + 1}] — ${title} (${pages})\n${shortText(c.chunkText, 700)}\n`;
    })
    .join("\n");
}

async function ollamaGenerate(prompt) {
  const resp = await axios.post(
    `${OLLAMA_URL}/api/generate`,
    {
      model: OLLAMA_CHAT_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: 0.15,
        num_predict: 420,
      },
    },
    {
      timeout: 180000,
    }
  );

  return String(resp?.data?.response || "").trim();
}

async function retrieveChunksSecure({ userId, question, topK, category, documentId }) {
  const docsFilter = { status: "READY" };

  const cat = normalizeCategory(category);
  if (cat) docsFilter.category = cat;

  if (documentId && mongoose.Types.ObjectId.isValid(documentId)) {
    docsFilter._id = new mongoose.Types.ObjectId(documentId);
  }

  const docs = await Document.find(docsFilter).select("_id title category docType");

  if (!docs.length) {
    return { docs: [], chunks: [] };
  }

  const allowedDocIds = docs.map((d) => d._id);
  const queryVector = await createEmbedding(String(question || "").trim());

  const limit = Math.min(Math.max(Number(topK) || 4, 2), 5);

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

  return { docs, chunks };
}

function buildPrompt(question, contextText) {
  return `
You are MUFASHE, a legal information assistant for Rwanda.

Your job is to help the user understand legal information in a calm, clear, and supportive way.
Use ONLY the legal sources provided below.
Do NOT invent laws, rights, procedures, offices, penalties, or deadlines.
If the sources are incomplete, say that clearly.
Do NOT say "I am sorry" unless necessary.
Do NOT give a one-line vague answer.
Do NOT use difficult legal language unless necessary.
Write in simple English.

VERY IMPORTANT:
- The answer should reduce confusion, not increase it.
- Explain what the answer may mean for the user.
- Give practical next steps where supported by the sources.
- Mention when the user may need a lawyer, police help, legal aid, or urgent action ONLY if supported or clearly prudent.
- Include citation markers like [1], [2] in the relevant sentences.
- End with one short caution line: "This is legal information, not a lawyer-client relationship."

Return the answer using EXACTLY this structure:

Summary:
(2-4 short sentences in simple language)

What this may mean for you:
(plain explanation in bullets)

What you can do next:
(2-5 practical next steps in bullets)

What to prepare:
(documents, proof, records, witnesses, receipts, contracts, IDs, etc. only if relevant)

Urgent note:
(only if the matter appears urgent from the question or sources; otherwise write "No urgent warning from the available sources.")

Sources used:
([1] title, page... etc. short)

Question:
${question}

Legal Sources:
${contextText}
`.trim();
}

async function answerQuestion({ userId, question, topK = 4, category, documentId }) {
  const q = String(question || "").trim();

  if (!q) {
    throw new Error("Question is required");
  }

  const retrievalStart = Date.now();

  const { docs, chunks } = await retrieveChunksSecure({
    userId,
    question: q,
    topK,
    category,
    documentId,
  });

  const retrievalEnd = Date.now();
  const retrievalTimeMs = retrievalEnd - retrievalStart;

  if (!chunks.length) {
    return {
      answer:
        "Summary:\nI could not find enough relevant legal information in the available READY documents.\n\nWhat this may mean for you:\n- The correct document may not be uploaded yet.\n- The uploaded document may not be processed or marked as READY.\n- Your question may need a more specific legal source.\n\nWhat you can do next:\n- Try asking in a more specific way.\n- Upload or process the correct legal document.\n- Choose the correct category or document before asking again.\n\nWhat to prepare:\n- The relevant contract, receipt, ID, agreement, or complaint details if they relate to your question.\n\nUrgent note:\nNo urgent warning from the available sources.\n\nSources used:\n- No matching source found.\n\nThis is legal information, not a lawyer-client relationship.",
      sources: [],
      retrievalTimeMs,
      generationTimeMs: 0,
      topScore: 0,
    };
  }

  const uniqueChunks = dedupeChunks(chunks).slice(0, 4);
  const docMap = new Map(docs.map((d) => [String(d._id), d]));
  const contextText = buildContext(uniqueChunks, docMap);

  const prompt = buildPrompt(q, contextText);

  const generationStart = Date.now();
  const answer = await ollamaGenerate(prompt);
  const generationEnd = Date.now();
  const generationTimeMs = generationEnd - generationStart;

  const sources = uniqueChunks.map((c, i) => ({
    n: i + 1,
    documentId: c.documentId,
    title: docMap.get(String(c.documentId))?.title || "Untitled",
    pageStart: c.pageStart ?? null,
    pageEnd: c.pageEnd ?? null,
    score: c.score ?? null,
    snippet: shortText(c.chunkText, 220),
  }));

  const topScore =
    uniqueChunks.length > 0 && uniqueChunks[0]?.score != null
      ? Number(uniqueChunks[0].score)
      : 0;

  return {
    answer:
      answer ||
      "Summary:\nI could not generate a grounded answer from the available legal sources.\n\nWhat this may mean for you:\n- The system found sources, but they were not enough for a reliable explanation.\n\nWhat you can do next:\n- Rephrase your question more clearly.\n- Open a specific legal document and ask again.\n\nWhat to prepare:\n- Any document connected to your case.\n\nUrgent note:\nNo urgent warning from the available sources.\n\nSources used:\n- See listed sources.\n\nThis is legal information, not a lawyer-client relationship.",
    sources,
    retrievalTimeMs,
    generationTimeMs,
    topScore,
  };
}

module.exports = { answerQuestion };