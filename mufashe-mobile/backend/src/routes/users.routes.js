// src/routes/users.routes.js
const router = require("express").Router();

const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const users = require("../controllers/users.controller");

// Debug (optional but helpful)
console.log("✅ USERS ROUTES LOADED FROM:", __filename);

// Protect everything below
router.use(auth, requireAdmin);

// CRUD
router.get("/", users.listUsers);                 // GET /api/users
router.get("/:id", users.getUser);                // GET /api/users/:id
router.put("/:id", users.updateUser);             // PUT /api/users/:id
router.patch("/:id/role", users.updateUserRole);  // PATCH /api/users/:id/role
router.delete("/:id", users.deleteUser);          // DELETE /api/users/:id

module.exports = router;
