// controllers/qa.controller.js
const { answerQuestion } = require("../services/qa.service");
const Question = require("../models/Question");

exports.ask = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { question, topK = 6, category, documentId } = req.body || {};
    const q = String(question || "").trim();

    if (q.length < 3) {
      return res.status(400).json({ message: "question is required" });
    }

    const result = await answerQuestion({
      userId,
      question: q,
      topK: Number(topK) || 6,
      category,
      documentId,
    });

    // robust extraction (depends on your qa.service shape)
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

    const saved = await Question.create({
      owner: userId,
      question: q,
      answer: answerText?.trim() ? answerText : "(no answer returned)",
      category: category ? String(category).trim().toUpperCase() : null,
      documentId: documentId || null,
      sources,
      // status defaults to PENDING
    });

    return res.json({
      ...result,
      savedQuestionId: saved._id,
      status: saved.status,
    });
  } catch (err) {
    console.error("❌ QA ask error:", err);
    return res.status(500).json({ message: "Failed to answer", error: err.message });
  }
};