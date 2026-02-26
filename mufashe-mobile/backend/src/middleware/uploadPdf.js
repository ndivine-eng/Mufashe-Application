// src/middleware/uploadPdf.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(process.cwd(), "data", "laws");

// ensure folder exists
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    // safe unique file name
    const ext = path.extname(file.originalname).toLowerCase() || ".pdf";
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 60);

    cb(null, `${Date.now()}_${base}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const isPdf =
    file.mimetype === "application/pdf" ||
    path.extname(file.originalname).toLowerCase() === ".pdf";

  if (!isPdf) return cb(new Error("Only PDF files are allowed"), false);
  cb(null, true);
};

const uploadPdf = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

module.exports = uploadPdf;
