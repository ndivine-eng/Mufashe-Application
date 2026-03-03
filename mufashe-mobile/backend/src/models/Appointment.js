// backend/src/models/Appointment.js
const mongoose = require("mongoose");

const AppointmentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    lawyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    startsAt: { type: Date, required: true, index: true },
    durationMin: { type: Number, default: 30 },

    topic: { type: String, trim: true, default: "" },

    // ✅ user case description
    caseDescription: { type: String, trim: true, default: "" },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },

    lawyerNote: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appointment", AppointmentSchema);