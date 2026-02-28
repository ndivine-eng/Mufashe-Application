const { answerQuestion } = require("../services/qa.service");

exports.ask = async (req, res) => {
  try {
    const userId = req.user?.id;
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

    return res.json(result);
  } catch (err) {
    console.error("❌ QA ask error:", err);
    return res.status(500).json({ message: "Failed to answer", error: err.message });
  }
};