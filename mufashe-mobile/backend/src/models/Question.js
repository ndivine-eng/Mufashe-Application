const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true },

    // optional filters used at ask time
    category: { type: String, default: null },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document", default: null },

    // store sources used
    sources: [
      {
        n: Number,
        documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document" },
        title: String,
        pageStart: Number,
        pageEnd: Number,
        score: Number,
        snippet: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Question", QuestionSchema);