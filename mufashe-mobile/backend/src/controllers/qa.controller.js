// backend/src/controllers/qa.controller.js
// this controller handles the main question-answering logic, including receiving questions from users, processing them with the QA service, and saving the results in the database.
const { answerQuestion } = require("../services/qa.service");
const Question = require("../models/Question");

exports.ask = async (req, res) => {
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

    return res.status(200).json({
      answer: finalAnswer,
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