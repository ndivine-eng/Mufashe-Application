// src/models/benchmark.model.js
// This model defines the schema for storing benchmark results of the question-answering system. Each benchmark entry captures details about the question, retrieval and generation times, sources used, and whether the answer was successful.
const mongoose = require("mongoose");

const BenchmarkSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    question: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: null,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      default: null,
    },
    topK: {
      type: Number,
      default: 6,
    },
    retrievalTimeMs: {
      type: Number,
      default: 0,
    },
    generationTimeMs: {
      type: Number,
      default: 0,
    },
    totalTimeMs: {
      type: Number,
      default: 0,
    },
    sourcesCount: {
      type: Number,
      default: 0,
    },
    topScore: {
      type: Number,
      default: 0,
    },
    success: {
      type: Boolean,
      default: true,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    answerPreview: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Benchmark", BenchmarkSchema);