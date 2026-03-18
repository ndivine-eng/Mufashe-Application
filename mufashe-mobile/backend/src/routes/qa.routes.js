// routes/qa.routes.js

const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const qaController = require("../controllers/qa.controller");

// Ping routes
router.get("/ping", (req, res) =>
  res.json({ ok: true, route: "/api/qa", method: "GET" })
);

router.post("/ping", (req, res) =>
  res.json({ ok: true, route: "/api/qa", method: "POST" })
);

// Main ask endpoint
router.post("/ask", auth, qaController.ask);

module.exports = router;