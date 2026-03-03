// backend/src/models/Notification.js
const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    type: {
      type: String,
      enum: ["APPOINTMENT_REQUEST", "APPOINTMENT_APPROVED", "APPOINTMENT_REJECTED"],
      required: true,
      index: true,
    },

    title: { type: String, required: true, trim: true },
    body: { type: String, trim: true, default: "" },

    data: { type: Object, default: {} }, // { appointmentId }

    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", NotificationSchema);