// controllers/questions.controller.js
const Question = require("../models/Question");

function isAdmin(req) {
  return String(req.user?.role || "").toLowerCase() === "admin";
}

exports.myRecent = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const limit = Math.min(Number(req.query.limit || 5), 20);

    const items = await Question.find({ owner: userId })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select("_id question category status createdAt updatedAt");

    return res.json({ items, total: items.length });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.myAll = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const items = await Question.find({ owner: userId })
      .sort({ createdAt: -1 })
      .select("_id question category status createdAt updatedAt");

    return res.json({ items, total: items.length });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const item = await Question.findById(req.params.id).populate(
      "owner",
      "fullName name username email role"
    );

    if (!item) return res.status(404).json({ message: "Question not found" });

    if (!isAdmin(req) && String(item.owner?._id) !== String(userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json({ item });
  } catch (err) {
    return res.status(400).json({ message: "Invalid id", error: err.message });
  }
};

// ADMIN: list questions by status + search
exports.adminList = async (req, res) => {
  try {
    const status = String(req.query.status || "").toUpperCase();
    const q = String(req.query.q || "").trim();

    const filter = {};
    if (["PENDING", "APPROVED", "REJECTED"].includes(status)) filter.status = status;
    if (q) filter.question = { $regex: q, $options: "i" };

    const items = await Question.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("owner", "fullName name username email")
      .select("_id question answer category status owner createdAt updatedAt");

    return res.json({ items, total: items.length, filter });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.approve = async (req, res) => {
  try {
    const adminId = req.user?.id || req.user?._id;

    const item = await Question.findByIdAndUpdate(
      req.params.id,
      { status: "APPROVED", reviewedBy: adminId, reviewedAt: new Date(), reviewNote: "" },
      { new: true }
    );

    if (!item) return res.status(404).json({ message: "Question not found" });
    return res.json({ ok: true, item });
  } catch (err) {
    return res.status(400).json({ message: "Approve failed", error: err.message });
  }
};

exports.reject = async (req, res) => {
  try {
    const adminId = req.user?.id || req.user?._id;
    const reviewNote = String(req.body?.reviewNote || "").trim();

    const item = await Question.findByIdAndUpdate(
      req.params.id,
      { status: "REJECTED", reviewedBy: adminId, reviewedAt: new Date(), reviewNote },
      { new: true }
    );

    if (!item) return res.status(404).json({ message: "Question not found" });
    return res.json({ ok: true, item });
  } catch (err) {
    return res.status(400).json({ message: "Reject failed", error: err.message });
  }
};