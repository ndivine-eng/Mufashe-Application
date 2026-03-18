// controllers/qa.controller.js
const { answerQuestion } = require("../services/qa.service");
const Question = require("../models/Question");

exports.ask = async (req, res) => {
  try {
    console.log("========== QA ASK START ==========");
    console.log("USER:", req.user);
    console.log("BODY:", req.body);

    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { question, topK = 6, category, documentId } = req.body || {};
    const q = String(question || "").trim();

    console.log("QUESTION:", q);
    console.log("TOPK:", topK);
    console.log("CATEGORY:", category);
    console.log("DOCUMENT ID:", documentId);

    if (q.length < 3) {
      return res.status(400).json({ message: "Question is required" });
    }

    console.log("Calling answerQuestion...");
    const result = await answerQuestion({
      userId,
      question: q,
      topK: Number(topK) || 6,
      category,
      documentId,
    });
    console.log("answerQuestion finished");

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

    console.log("ANSWER LENGTH:", String(answerText || "").length);
    console.log("SOURCES COUNT:", sources.length);

    const saved = await Question.create({
      owner: userId,
      question: q,
      answer: answerText?.trim()
        ? answerText
        : "I couldn’t generate an answer from the sources. Not legal advice.",
      category: category ? String(category).trim().toUpperCase() : null,
      documentId: documentId || null,
      sources,
      status: "APPROVED",
    });

    console.log("QUESTION SAVED:", saved._id);
    console.log("========== QA ASK SUCCESS ==========");

    return res.status(200).json({
      answer: answerText?.trim()
        ? answerText
        : "I couldn’t generate an answer from the sources. Not legal advice.",
      sources,
      savedQuestionId: saved._id,
      status: saved.status,
    });
  } catch (err) {
    console.error("❌ QA ask error:", err);
    console.error("❌ QA ask stack:", err?.stack);
    return res.status(500).json({
      message: "Failed to answer",
      error: err?.message || "Unknown error",
    });
  }
};