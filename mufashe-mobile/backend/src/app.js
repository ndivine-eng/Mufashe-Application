// backend/src/app.js
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const documentRoutes = require("./routes/document.routes");
const searchRoutes = require("./routes/search.routes");
const usersRoutes = require("./routes/users.routes");
const qaRoutes = require("./routes/qa.routes");
const questionsRoutes = require("./routes/questions.routes");

// ✅ NEW routes (make sure these files exist)
const lawyersRoutes = require("./routes/lawyers.routes");
const appointmentsRoutes = require("./routes/appointments.routes");
const notificationsRoutes = require("./routes/notifications.routes");
const adminRoutes = require("./routes/admin.routes");

const app = express();

app.use(cors());
app.use(express.json());

// Root check
app.get("/", (req, res) => res.send("Mufashe API running ✅"));
app.get("/api/ping", (req, res) => res.json({ ok: true, msg: "app is running" }));

// Existing routes
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/qa", qaRoutes);
app.use("/api/questions", questionsRoutes);

// New feature routes
app.use("/api/lawyers", lawyersRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/admin", adminRoutes);

module.exports = app;