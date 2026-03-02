const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const ctrl = require("../controllers/questions.controller");

console.log("✅ QUESTIONS ROUTES LOADED:", __filename);

// ✅ PUBLIC PING
router.get("/ping", (req, res) => res.json({ ok: true, route: "/api/questions" }));

router.use(auth);

//ser
router.get("/recent", ctrl.myRecent);
router.get("/me", ctrl.myAll);

// admin
router.get("/", requireAdmin, ctrl.adminList);
router.post("/:id/approve", requireAdmin, ctrl.approve);
router.post("/:id/reject", requireAdmin, ctrl.reject);

// last
router.get("/:id", ctrl.getById);

module.exports = router;