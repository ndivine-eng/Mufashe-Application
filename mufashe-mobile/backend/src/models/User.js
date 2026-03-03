// backend/src/models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },

    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },

    phone: { type: String, unique: true, sparse: true, trim: true },

    passwordHash: { type: String, required: true },

    role: {
      type: String,
      enum: ["admin", "user", "lawyer"],
      default: "user",
      index: true,
    },

    // ✅ lawyer approval
    isVerifiedLawyer: { type: Boolean, default: false, index: true },

    // ✅ lawyer profile fields
    lawyerStatus: {
      type: String,
      enum: ["AVAILABLE", "BUSY", "OFFLINE"],
      default: "OFFLINE",
      index: true,
    },

    specialization: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    officeAddress: { type: String, trim: true, default: "" },
    bio: { type: String, trim: true, default: "" },

    yearsExperience: { type: Number, default: 0 },
    licenseNumber: { type: String, trim: true, default: "" },

    languages: { type: [String], default: [] },

    feeMin: { type: Number, default: 0 },
    feeMax: { type: Number, default: 0 },
    feeNegotiable: { type: Boolean, default: true },
    feeNote: { type: String, trim: true, default: "" },

    // ✅ profile review workflow (optional)
    profileReviewStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    profileReviewNote: { type: String, trim: true, default: "" },
    profileReviewedAt: { type: Date, default: null },
    profileReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    profileUpdatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);