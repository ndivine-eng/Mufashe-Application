// server.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Root check
app.get("/", (req, res) => res.send("Mufashe API running ✅"));

// Debug ping
app.get("/api/ping", (req, res) =>
  res.json({ ok: true, msg: "server running" })
);

// ================= ROUTES =================
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/documents", require("./routes/document.routes"));
app.use("/api/search", require("./routes/search.routes"));
app.use("/api/users", require("./routes/users.routes"));
app.use("/api/qa", require("./routes/qa.routes"));

// ==========================================

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () =>
    console.log(`🚀 Server running on port ${PORT}`)
  );
});