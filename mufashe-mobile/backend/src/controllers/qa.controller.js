// src/controllers/qa.controller.js
// This controller handles incoming requests to the /api/qa endpoint. It validates the request, calls the QA service to get an answer, saves the question and answer to the database, and records benchmark data for performance analysis.

const { answerQuestion } = require("../services/qa.service");
const Question = require("../models/Question");
const Benchmark = require("../models/benchmark.model");

exports.ask = async (req, res) => {
  const totalStart = Date.now();

  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { question, topK = 6, category, documentId } = req.body || {};
    const q = String(question || "").trim();

    if (q.length < 3) {
      return res.status(400).json({ message: "Question is required" });
    }

    const result = await answerQuestion({
      userId,
      question: q,
      topK: Number(topK) || 6,
      category,
      documentId,
    });

    const answerText =
      result?.answer ||
      result?.finalAnswer ||
      result?.data?.answer ||
      "";

    const sources = Array.isArray(result?.sources)
      ? result.sources
      : Array.isArray(result?.citations)
      ? result.citations
      : [];

    const finalAnswer = answerText?.trim()
      ? answerText
      : "Summary:\nI could not generate a reliable answer from the available sources.\n\nWhat this may mean for you:\n- The system may need a clearer question or better matching legal sources.\n\nWhat you can do next:\n- Ask again using more specific details.\n- Choose the correct document or category.\n\nWhat to prepare:\n- Any document linked to your issue.\n\nUrgent note:\nNo urgent warning from the available sources.\n\nSources used:\n- No usable source found.\n\nThis is legal information, not a lawyer-client relationship.";

    const saved = await Question.create({
      owner: userId,
      question: q,
      answer: finalAnswer,
      category: category ? String(category).trim().toUpperCase() : null,
      documentId: documentId || null,
      sources,
      status: "APPROVED",
    });

    const totalEnd = Date.now();

    await Benchmark.create({
      userId,
      question: q,
      category: category ? String(category).trim().toUpperCase() : null,
      documentId: documentId || null,
      topK: Number(topK) || 6,
      retrievalTimeMs: result?.retrievalTimeMs || 0,
      generationTimeMs: result?.generationTimeMs || 0,
      totalTimeMs: totalEnd - totalStart,
      sourcesCount: sources.length,
      topScore: result?.topScore || 0,
      success: true,
      answerPreview: String(finalAnswer).slice(0, 300),
    });

    return res.status(200).json({
      answer: finalAnswer,
      sources,
      savedQuestionId: saved._id,
      status: saved.status,
      benchmark: {
        retrievalTimeMs: result?.retrievalTimeMs || 0,
        generationTimeMs: result?.generationTimeMs || 0,
        totalTimeMs: totalEnd - totalStart,
        sourcesCount: sources.length,
        topScore: result?.topScore || 0,
      },
    });
  } catch (err) {
    console.error("❌ QA ask error:", err);
    console.error("❌ QA ask stack:", err?.stack);

    const totalEnd = Date.now();

    try {
      await Benchmark.create({
        userId: req.user?.id || req.user?._id || null,
        question: String(req.body?.question || "").trim() || "Unknown question",
        category: req.body?.category
          ? String(req.body.category).trim().toUpperCase()
          : null,
        documentId: req.body?.documentId || null,
        topK: Number(req.body?.topK) || 6,
        retrievalTimeMs: 0,
        generationTimeMs: 0,
        totalTimeMs: totalEnd - totalStart,
        sourcesCount: 0,
        topScore: 0,
        success: false,
        errorMessage: err?.message || "Unknown error",
        answerPreview: "",
      });
    } catch (benchmarkError) {
      console.error("❌ Benchmark save error:", benchmarkError?.message);
    }

    return res.status(500).json({
      message: "Failed to answer",
      error: err?.message || "Unknown error",
    });
  }
};