const fs = require("fs");
const path = require("path");
const pdf = require("pdf-parse");

async function extractTextFromPdfFile(relativePath) {
  try {
    // Resolve path: src/services → backend
    const fullPath = path.join(__dirname, "..", "..", relativePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error("File not found: " + fullPath);
    }

    const dataBuffer = fs.readFileSync(fullPath);

    // pdf-parse returns a promise
    const data = await pdf(dataBuffer);

    if (!data.text || data.text.trim().length === 0) {
      throw new Error("PDF contains no readable text");
    }

    const cleanedText = data.text
      .replace(/\r\n/g, "\n")
      .replace(/\n{2,}/g, "\n")
      .trim();

    return {
      text: cleanedText,
      pageCount: data.numpages,
    };

  } catch (error) {
    throw new Error(error.message);
  }
}

module.exports = {
  extractTextFromPdfFile,
};