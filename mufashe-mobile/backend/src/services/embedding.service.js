// src/services/embedding.service.js
const axios = require("axios");

const OLLAMA_URL = String(process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/+$/, "");
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text:latest";

async function createEmbedding(text) {
  const input = String(text || "").trim();
  if (!input) throw new Error("Cannot embed empty text");

  // ✅ Newer Ollama endpoint
  const resp = await axios.post(`${OLLAMA_URL}/api/embed`, {
    model: OLLAMA_EMBED_MODEL,
    input,
  });

  // Ollama returns embeddings as an array of arrays
  const vec = resp?.data?.embeddings?.[0];

  if (!Array.isArray(vec) || vec.length < 10) {
    throw new Error(`Ollama embed failed (len=${vec?.length})`);
  }

  return vec;
}

module.exports = { createEmbedding };