// src/controllers/document.controller.js
// ------------------------------------------------------------
// Documents Controller (MUFASHE)
// Step 2: Metadata library (CRUD + filter)
// Step 3: PDF upload (multipart/form-data)
// Step 4: Text extraction -> UPLOADED → PROCESSING → READY/FAILED
// Step 5: Chunking -> store many chunks in documentChunks collection
// Step 6 (MongoDB): Create embeddings for each chunk and store in MongoDB
// ------------------------------------------------------------

const path = require("path");

const Document = require("../models/Document");
const DocumentChunk = require("../models/DocumentChunk");

const { processOneDocument } = require("../services/documentProcess.service");

/** Normalize category input like "land" -> "LAND" */
const normalizeCategory = (c) => (c ? String(c).trim().toUpperCase() : undefined);

/** Allowed categories (must match Document model enum) */
const ALLOWED_CATEGORIES = ["FAMILY", "LAND", "LABOR", "BUSINESS"];

/* ============================================================
   STEP 2 — CREATE DOCUMENT METADATA (admin-only)
   POST /api/documents
============================================================ */
exports.createDocument = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { title, category, docType = "LAW", jurisdiction = "Rwanda" } = req.body || {};
    const cat = normalizeCategory(category);

    if (!title || !cat) {
      return res.status(400).json({
        message: "Missing required fields",
        required: ["title", "category"],
      });
    }

    if (!ALLOWED_CATEGORIES.includes(cat)) {
      return res.status(400).json({
        message: "Invalid category",
        allowed: ALLOWED_CATEGORIES,
      });
    }

    const doc = await Document.create({
      owner: userId,
      title: String(title).trim(),
      category: cat,
      docType,
      jurisdiction,
      status: "UPLOADED",
    });

    return res.status(201).json({ message: "Document created", document: doc });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

/* ============================================================
   STEP 2 — LIST DOCUMENTS (public)
   GET /api/documents
   GET /api/documents?category=LAND&status=READY&q=law
============================================================ */
exports.listDocuments = async (req, res) => {
  try {
    const { category, status, q } = req.query;
    const filter = {};

    if (category) {
      const cat = normalizeCategory(category);
      if (!cat || !ALLOWED_CATEGORIES.includes(cat)) {
        return res.status(400).json({ message: "Invalid category", allowed: ALLOWED_CATEGORIES });
      }
      filter.category = cat;
    }

    if (status) filter.status = String(status).trim().toUpperCase();
    if (q) filter.title = { $regex: String(q).trim(), $options: "i" };

    const docs = await Document.find(filter).sort({ createdAt: -1 });
    return res.json({ items: docs, total: docs.length, filter });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

/* ============================================================
   GET SINGLE DOCUMENT (public)
   GET /api/documents/:id
============================================================ */
exports.getDocumentById = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    return res.json(doc);
  } catch (err) {
    return res.status(400).json({ message: "Invalid document id", error: err.message });
  }
};

/* ============================================================
   UPDATE DOCUMENT METADATA (admin-only)
   PUT /api/documents/:id
============================================================ */
exports.updateDocument = async (req, res) => {
  try {
    const updates = { ...req.body };

    if (updates.category) {
      const cat = normalizeCategory(updates.category);
      if (!cat || !ALLOWED_CATEGORIES.includes(cat)) {
        return res.status(400).json({ message: "Invalid category", allowed: ALLOWED_CATEGORIES });
      }
      updates.category = cat;
    }

    // Safety: never allow client to overwrite owner
    delete updates.owner;

    const doc = await Document.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!doc) return res.status(404).json({ message: "Document not found" });
    return res.json({ message: "Document updated", document: doc });
  } catch (err) {
    return res.status(400).json({ message: "Update failed", error: err.message });
  }
};

/* ============================================================
   STEP 3 — UPLOAD PDF (admin-only)
   POST /api/documents/upload  (multipart/form-data)
============================================================ */
exports.uploadDocumentPdf = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    if (!req.file) {
      return res.status(400).json({
        message: "Missing PDF file",
        hint: "Use multipart/form-data with key: file",
      });
    }

    const { title, category, docType = "LAW", jurisdiction = "Rwanda", documentId } = req.body || {};
    const cat = normalizeCategory(category);

    if (cat && !ALLOWED_CATEGORIES.includes(cat)) {
      return res.status(400).json({ message: "Invalid category", allowed: ALLOWED_CATEGORIES });
    }

    // save relative path
    const fileKey = path.join("data", "laws", req.file.filename).replace(/\\/g, "/");

    // CASE A: Update existing document
    if (documentId) {
      const updated = await Document.findByIdAndUpdate(
        documentId,
        {
          ...(title ? { title: title.trim() } : {}),
          ...(cat ? { category: cat } : {}),
          docType,
          jurisdiction,
          fileKey,
          fileName: req.file.originalname,
          mimeType: req.file.mimetype,
          fileSize: req.file.size,

          // reset pipeline
          extractedText: null,
          processedAt: null,
          textLength: 0,
          errorMessage: null,
          status: "UPLOADED",
        },
        { new: true, runValidators: true }
      );

      if (!updated) return res.status(404).json({ message: "Document not found" });

      await DocumentChunk.deleteMany({ documentId: updated._id });
      return res.json({ message: "PDF uploaded and document updated", document: updated });
    }

    // CASE B: Create new document
    if (!title || !cat) {
      return res.status(400).json({
        message: "Missing required fields",
        required: ["title", "category"],
        note: "When uploading without documentId, you must provide title + category.",
      });
    }

    const doc = await Document.create({
      owner: userId,
      title: title.trim(),
      category: cat,
      docType,
      jurisdiction,
      fileKey,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      status: "UPLOADED",
    });

    return res.status(201).json({ message: "PDF uploaded and document created", document: doc });
  } catch (err) {
    return res.status(400).json({ message: "Upload failed", error: err.message });
  }
};

/* ============================================================
   STEP 4 + 5 + 6 — PROCESS ONE DOCUMENT (admin-only)
   POST /api/documents/:id/process
============================================================ */
exports.processDocumentText = async (req, res) => {
  try {
    const result = await processOneDocument(req.params.id);

    return res.json({
      ok: true,
      message: "Text extracted, chunked, and embeddings saved in MongoDB",
      document: result,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: "Processing failed",
      error: err.message,
    });
  }
};

/* ============================================================
   PROCESS ALL DOCUMENTS (admin-only)
   POST /api/documents/process-all?status=UPLOADED&limit=50
   - status: UPLOADED (default) or FAILED
============================================================ */
exports.processAllDocuments = async (req, res) => {
  try {
    const status = String(req.query.status || "UPLOADED").toUpperCase();
    const limit = Number(req.query.limit || 50);

    const docs = await Document.find({ status }).sort({ createdAt: 1 }).limit(limit);

    if (!docs.length) {
      return res.json({
        ok: true,
        message: `No documents to process with status=${status}`,
        total: 0,
        processed: 0,
        failed: 0,
        results: [],
      });
    }

    const results = [];
    let processed = 0;
    let failed = 0;

    for (const d of docs) {
      try {
        const r = await processOneDocument(d._id);
        processed += 1;
        results.push({ id: String(d._id), title: d.title, ok: true, ...r });
      } catch (e) {
        failed += 1;
        results.push({ id: String(d._id), title: d.title, ok: false, error: e.message });
      }
    }

    return res.json({
      ok: true,
      message: "Batch processing finished",
      total: docs.length,
      processed,
      failed,
      results,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: "Batch processing failed",
      error: err.message,
    });
  }
};

/* ============================================================
   DELETE DOCUMENT (admin-only)
   DELETE /api/documents/:id
============================================================ */
exports.deleteDocument = async (req, res) => {
  try {
    const doc = await Document.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    await DocumentChunk.deleteMany({ documentId: doc._id });

    return res.json({ ok: true, message: "Document deleted", document: doc });
  } catch (err) {
    return res.status(400).json({ message: "Invalid document id", error: err.message });
  }
};