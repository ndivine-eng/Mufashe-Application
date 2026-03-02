// backend/tools/approveAllQuestions.js
require("dotenv").config();

const mongoose = require("mongoose");
const Question = require("../src/models/Question");

async function run() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGO_URI (or MONGODB_URI) in your .env");
  }

  await mongoose.connect(uri);

  const res = await Question.updateMany(
    { status: "PENDING" },
    { $set: { status: "APPROVED" } }
  );

  console.log("✅ Updated questions:", res.modifiedCount);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error("❌ Script failed:", e.message);
  process.exit(1);
});