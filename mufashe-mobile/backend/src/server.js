const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const connectDB = require("./config/db");
const app = require("./app");

const PORT = process.env.PORT || 5000;

console.log("=== STARTUP DEBUG ===");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT exists:", !!process.env.PORT);
console.log("MONGODB_URI exists:", !!process.env.MONGODB_URI);
console.log("JWT_SECRET exists:", !!process.env.JWT_SECRET);
console.log("OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY);
console.log("Working directory:", process.cwd());
console.log("Server file loaded successfully");

connectDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
});