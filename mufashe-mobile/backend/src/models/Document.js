// src/models/Document.js
const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: { type: String, required: true, trim: true },

    docType: {
      type: String,
      enum: ["LAW", "CASE", "CONTRACT", "OTHER"],
      default: "LAW",
      index: true,
    },

    category: {
      type: String,
      enum: ["FAMILY", "LAND", "LABOR", "BUSINESS"],
      required: true,
      index: true,
    },

    jurisdiction: { type: String, default: "Rwanda", trim: true, index: true },

    // ✅ File location saved after upload
    fileKey: { type: String, required: true, trim: true }, // e.g. data/laws/xxx.pdf
    fileName: { type: String, required: true, trim: true },
    mimeType: { type: String, default: "application/pdf" },
    fileSize: { type: Number, default: 0 },

    // ✅ Status pipeline: UPLOADED -> PROCESSING -> READY/FAILED
    status: {
      type: String,
      enum: ["UPLOADED", "PROCESSING", "READY", "FAILED"],
      default: "UPLOADED",
      index: true,
    },

    // ✅ If processing fails, store error here
    errorMessage: { type: String, default: null },

    // ✅ Step 4: extracted text from PDF
    extractedText: { type: String, default: null },

    // ✅ When extraction completed
    processedAt: { type: Date, default: null },

    // ✅ Quick debugging/analytics
    textLength: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Document", DocumentSchema);