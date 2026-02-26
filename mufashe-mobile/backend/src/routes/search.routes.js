// src/routes/search.routes.js
const router = require("express").Router();
const searchController = require("../controllers/search.controller");

// Optional: protect embed route (recommended)
// const auth = require("../middleware/auth.middleware");
// const admin = require("../middleware/admin.middleware");

// Step 6
router.post("/embed/:documentId", searchController.embedDocumentChunks);
router.post("/semantic", searchController.semanticSearch);

module.exports = router;