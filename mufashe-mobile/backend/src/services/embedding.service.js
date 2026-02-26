// src/services/embedding.service.js
const axios = require("axios");

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text:latest";

async function createEmbedding(text) {
  const input = String(text || "").trim();
  if (!input) throw new Error("Cannot embed empty text");

  const resp = await axios.post(`${OLLAMA_URL}/api/embeddings`, {
    model: OLLAMA_EMBED_MODEL,
    prompt: input,
  });

  const vec = resp?.data?.embedding;

  if (!Array.isArray(vec) || vec.length < 10) {
    throw new Error(`Ollama embedding failed (len=${vec?.length})`);
  }

  return vec;
}

module.exports = { createEmbedding };