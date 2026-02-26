// src/routes/auth.routes.js
const router = require("express").Router();

const authController = require("../controllers/auth.controller"); // ✅ import as object
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const { googleLogin } = require("../controllers/googleAuth.controller");

console.log("✅ AUTH ROUTES LOADED:", __filename);

// ✅ These logs will show which one is undefined
console.log("register type:", typeof authController.register);
console.log("login type:", typeof authController.login);
console.log("me type:", typeof authController.me);
console.log("bootstrapAdmin type:", typeof authController.bootstrapAdmin);
console.log("googleLogin type:", typeof googleLogin);

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/google", googleLogin);

router.get("/me", auth, authController.me);

// ✅ only works if bootstrapAdmin is a function
router.post("/bootstrap-admin", auth, authController.bootstrapAdmin);

router.get("/admin-test", auth, requireAdmin, (req, res) => {
  res.json({ ok: true, msg: "admin ok", user: req.user });
});

module.exports = router;
