// src/routes/document.routes.js
const router = require("express").Router();

const auth = require("../middleware/auth");
const uploadPdf = require("../middleware/uploadPdf");
const requireAdmin = require("../middleware/requireAdmin");

const {
  createDocument,
  listDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
  uploadDocumentPdf,
  processDocumentText,
  processAllDocuments,
} = require("../controllers/document.controller");

console.log("✅ DOCUMENT ROUTES LOADED:", __filename);

// ✅ PUBLIC
router.get("/", listDocuments);

// ✅ ADMIN ONLY - metadata
router.post("/", auth, requireAdmin, createDocument);

// ✅ ADMIN ONLY - upload
router.post("/upload", auth, requireAdmin, uploadPdf.single("file"), uploadDocumentPdf);

// ✅ ADMIN ONLY - process ALL (MUST be before "/:id")
router.post("/process-all", auth, requireAdmin, processAllDocuments);

// ✅ ADMIN ONLY - process ONE
router.post("/:id/process", auth, requireAdmin, processDocumentText);

// ✅ PUBLIC - get one
router.get("/:id", getDocumentById);

// ✅ ADMIN ONLY - update
router.put("/:id", auth, requireAdmin, updateDocument);

// ✅ ADMIN ONLY - delete
router.delete("/:id", auth, requireAdmin, deleteDocument);

module.exports = router;