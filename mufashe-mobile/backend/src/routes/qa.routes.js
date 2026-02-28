const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const qaController = require("../controllers/qa.controller");

// ✅ Ping routes (GET + POST) so you can test easily in Postman
router.get("/ping", (req, res) => res.json({ ok: true, route: "/api/qa", method: "GET" }));
router.post("/ping", (req, res) => res.json({ ok: true, route: "/api/qa", method: "POST" }));

// ✅ Main ask endpoint (requires auth token)
router.post("/ask", auth, qaController.ask);

module.exports = router;