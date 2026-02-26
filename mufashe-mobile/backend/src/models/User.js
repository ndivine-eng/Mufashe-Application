// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },

    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },

    phone: { type: String, unique: true, sparse: true, trim: true },

    passwordHash: { type: String, required: true },

    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
