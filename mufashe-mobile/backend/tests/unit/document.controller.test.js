const path = require("path");

const {
  createDocument,
  listDocuments,
  getDocumentById,
  updateDocument,
  uploadDocumentPdf,
  processDocumentText,
  processAllDocuments,
  deleteDocument,
} = require("../../src/controllers/document.controller");

const Document = require("../../src/models/Document");
const DocumentChunk = require("../../src/models/DocumentChunk");
const { processOneDocument } = require("../../src/services/documentProcess.service");

jest.mock("../../src/models/Document");
jest.mock("../../src/models/DocumentChunk");
jest.mock("../../src/services/documentProcess.service");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("document.controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createDocument", () => {
    it("should return 401 if unauthorized", async () => {
      const req = { user: null, body: {} };
      const res = mockRes();

      await createDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 if missing title/category", async () => {
      const req = { user: { id: "u1" }, body: { title: "Law doc" } };
      const res = mockRes();

      await createDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 if category invalid", async () => {
      const req = { user: { id: "u1" }, body: { title: "Law", category: "WRONG" } };
      const res = mockRes();

      await createDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid category",
        allowed: ["FAMILY", "LAND", "LABOR", "BUSINESS"],
      });
    });

    it("should create document", async () => {
      const req = {
        user: { id: "u1" },
        body: { title: "Land law", category: "land", docType: "LAW", jurisdiction: "Rwanda" },
      };
      const res = mockRes();

      const doc = { _id: "d1", title: "Land law", category: "LAND" };
      Document.create.mockResolvedValue(doc);

      await createDocument(req, res);

      expect(Document.create).toHaveBeenCalledWith({
        owner: "u1",
        title: "Land law",
        category: "LAND",
        docType: "LAW",
        jurisdiction: "Rwanda",
        status: "UPLOADED",
      });

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("should return 500 on error", async () => {
      const req = { user: { id: "u1" }, body: { title: "Land", category: "LAND" } };
      const res = mockRes();

      Document.create.mockRejectedValue(new Error("DB failed"));

      await createDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("listDocuments", () => {
    it("should list documents", async () => {
      const req = { query: { category: "land", status: "ready", q: "law" } };
      const res = mockRes();

      const docs = [{ _id: "d1", title: "Land law" }];
      const sortMock = jest.fn().mockResolvedValue(docs);

      Document.find.mockReturnValue({ sort: sortMock });

      await listDocuments(req, res);

      expect(Document.find).toHaveBeenCalledWith({
        category: "LAND",
        status: "READY",
        title: { $regex: "law", $options: "i" },
      });

      expect(res.json).toHaveBeenCalledWith({
        items: docs,
        total: 1,
        filter: {
          category: "LAND",
          status: "READY",
          title: { $regex: "law", $options: "i" },
        },
      });
    });

    it("should reject invalid category", async () => {
      const req = { query: { category: "invalid" } };
      const res = mockRes();

      await listDocuments(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 500 on error", async () => {
      const req = { query: {} };
      const res = mockRes();

      Document.find.mockImplementation(() => {
        throw new Error("DB failed");
      });

      await listDocuments(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getDocumentById", () => {
    it("should return document", async () => {
      const req = { params: { id: "d1" } };
      const res = mockRes();

      const doc = { _id: "d1", title: "Doc" };
      Document.findById.mockResolvedValue(doc);

      await getDocumentById(req, res);

      expect(res.json).toHaveBeenCalledWith(doc);
    });

    it("should return 404 if not found", async () => {
      const req = { params: { id: "d1" } };
      const res = mockRes();

      Document.findById.mockResolvedValue(null);

      await getDocumentById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return 400 for invalid id", async () => {
      const req = { params: { id: "bad" } };
      const res = mockRes();

      Document.findById.mockRejectedValue(new Error("Cast failed"));

      await getDocumentById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("updateDocument", () => {
    it("should reject invalid category", async () => {
      const req = { params: { id: "d1" }, body: { category: "wrong" } };
      const res = mockRes();

      await updateDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should remove owner from updates", async () => {
      const req = {
        params: { id: "d1" },
        body: { title: "New title", category: "business", owner: "hack" },
      };
      const res = mockRes();

      const doc = { _id: "d1", title: "New title", category: "BUSINESS" };
      Document.findByIdAndUpdate.mockResolvedValue(doc);

      await updateDocument(req, res);

      expect(Document.findByIdAndUpdate).toHaveBeenCalledWith(
        "d1",
        {
          title: "New title",
          category: "BUSINESS",
        },
        { new: true, runValidators: true }
      );
    });

    it("should return 404 if document missing", async () => {
      const req = { params: { id: "d1" }, body: { title: "New title" } };
      const res = mockRes();

      Document.findByIdAndUpdate.mockResolvedValue(null);

      await updateDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return 400 on error", async () => {
      const req = { params: { id: "d1" }, body: { title: "New title" } };
      const res = mockRes();

      Document.findByIdAndUpdate.mockRejectedValue(new Error("Update failed"));

      await updateDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("uploadDocumentPdf", () => {
    it("should return 401 if unauthorized", async () => {
      const req = { user: null, body: {} };
      const res = mockRes();

      await uploadDocumentPdf(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 if file missing", async () => {
      const req = { user: { id: "u1" }, body: {} };
      const res = mockRes();

      await uploadDocumentPdf(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should reject invalid category", async () => {
      const req = {
        user: { id: "u1" },
        file: { filename: "file.pdf", originalname: "file.pdf", mimetype: "application/pdf", size: 100 },
        body: { category: "wrong" },
      };
      const res = mockRes();

      await uploadDocumentPdf(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should update existing document when documentId is provided", async () => {
      const req = {
        user: { id: "u1" },
        file: {
          filename: "abc.pdf",
          originalname: "original.pdf",
          mimetype: "application/pdf",
          size: 999,
        },
        body: {
          documentId: "d1",
          title: "Updated title",
          category: "land",
          docType: "LAW",
          jurisdiction: "Rwanda",
        },
      };
      const res = mockRes();

      const updated = { _id: "d1", title: "Updated title" };
      Document.findByIdAndUpdate.mockResolvedValue(updated);
      DocumentChunk.deleteMany.mockResolvedValue({ deletedCount: 3 });

      await uploadDocumentPdf(req, res);

      expect(Document.findByIdAndUpdate).toHaveBeenCalledWith(
        "d1",
        expect.objectContaining({
          title: "Updated title",
          category: "LAND",
          fileKey: path.join("data", "laws", "abc.pdf").replace(/\\/g, "/"),
          fileName: "original.pdf",
          mimeType: "application/pdf",
          fileSize: 999,
          status: "UPLOADED",
        }),
        { new: true, runValidators: true }
      );

      expect(DocumentChunk.deleteMany).toHaveBeenCalledWith({ documentId: updated._id });
      expect(res.json).toHaveBeenCalledWith({
        message: "PDF uploaded and document updated",
        document: updated,
      });
    });

    it("should return 404 if existing documentId not found", async () => {
      const req = {
        user: { id: "u1" },
        file: {
          filename: "abc.pdf",
          originalname: "original.pdf",
          mimetype: "application/pdf",
          size: 999,
        },
        body: { documentId: "d1" },
      };
      const res = mockRes();

      Document.findByIdAndUpdate.mockResolvedValue(null);

      await uploadDocumentPdf(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should require title and category when creating new upload", async () => {
      const req = {
        user: { id: "u1" },
        file: {
          filename: "abc.pdf",
          originalname: "original.pdf",
          mimetype: "application/pdf",
          size: 999,
        },
        body: {},
      };
      const res = mockRes();

      await uploadDocumentPdf(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should create a new uploaded document", async () => {
      const req = {
        user: { id: "u1" },
        file: {
          filename: "abc.pdf",
          originalname: "original.pdf",
          mimetype: "application/pdf",
          size: 999,
        },
        body: {
          title: "Family law",
          category: "family",
          docType: "LAW",
          jurisdiction: "Rwanda",
        },
      };
      const res = mockRes();

      const doc = { _id: "d2", title: "Family law" };
      Document.create.mockResolvedValue(doc);

      await uploadDocumentPdf(req, res);

      expect(Document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "u1",
          title: "Family law",
          category: "FAMILY",
          fileName: "original.pdf",
          mimeType: "application/pdf",
          fileSize: 999,
          status: "UPLOADED",
        })
      );

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("should return 400 on upload error", async () => {
      const req = {
        user: { id: "u1" },
        file: {
          filename: "abc.pdf",
          originalname: "original.pdf",
          mimetype: "application/pdf",
          size: 999,
        },
        body: {
          title: "Family law",
          category: "family",
        },
      };
      const res = mockRes();

      Document.create.mockRejectedValue(new Error("Upload failed"));

      await uploadDocumentPdf(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("processDocumentText", () => {
    it("should process one document", async () => {
      const req = { params: { id: "d1" } };
      const res = mockRes();

      const result = { id: "d1", status: "READY" };
      processOneDocument.mockResolvedValue(result);

      await processDocumentText(req, res);

      expect(processOneDocument).toHaveBeenCalledWith("d1");
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        message: "Text extracted, chunked, and embeddings saved in MongoDB",
        document: result,
      });
    });

    it("should return 500 on processing error", async () => {
      const req = { params: { id: "d1" } };
      const res = mockRes();

      processOneDocument.mockRejectedValue(new Error("Process failed"));

      await processDocumentText(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("processAllDocuments", () => {
    it("should return no documents message if none found", async () => {
      const req = { query: { status: "UPLOADED", limit: "5" } };
      const res = mockRes();

      const limitMock = jest.fn().mockResolvedValue([]);
      const sortMock = jest.fn().mockReturnValue({ limit: limitMock });
      Document.find.mockReturnValue({ sort: sortMock });

      await processAllDocuments(req, res);

      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        message: "No documents to process with status=UPLOADED",
        total: 0,
        processed: 0,
        failed: 0,
        results: [],
      });
    });

    it("should process all documents with mixed success", async () => {
      const req = { query: { status: "UPLOADED", limit: "5" } };
      const res = mockRes();

      const docs = [
        { _id: "d1", title: "Doc 1" },
        { _id: "d2", title: "Doc 2" },
      ];

      const limitMock = jest.fn().mockResolvedValue(docs);
      const sortMock = jest.fn().mockReturnValue({ limit: limitMock });
      Document.find.mockReturnValue({ sort: sortMock });

      processOneDocument
        .mockResolvedValueOnce({ status: "READY" })
        .mockRejectedValueOnce(new Error("Failed doc 2"));

      await processAllDocuments(req, res);

      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        message: "Batch processing finished",
        total: 2,
        processed: 1,
        failed: 1,
        results: [
          { id: "d1", title: "Doc 1", ok: true, status: "READY" },
          { id: "d2", title: "Doc 2", ok: false, error: "Failed doc 2" },
        ],
      });
    });

    it("should return 500 on batch error", async () => {
      const req = { query: {} };
      const res = mockRes();

      Document.find.mockImplementation(() => {
        throw new Error("Batch failed");
      });

      await processAllDocuments(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("deleteDocument", () => {
    it("should delete document and chunks", async () => {
      const req = { params: { id: "d1" } };
      const res = mockRes();

      const doc = { _id: "d1", title: "Doc 1" };
      Document.findByIdAndDelete.mockResolvedValue(doc);
      DocumentChunk.deleteMany.mockResolvedValue({ deletedCount: 4 });

      await deleteDocument(req, res);

      expect(DocumentChunk.deleteMany).toHaveBeenCalledWith({ documentId: "d1" });
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        message: "Document deleted",
        document: doc,
      });
    });

    it("should return 404 if document not found", async () => {
      const req = { params: { id: "d1" } };
      const res = mockRes();

      Document.findByIdAndDelete.mockResolvedValue(null);

      await deleteDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return 400 on invalid id", async () => {
      const req = { params: { id: "bad" } };
      const res = mockRes();

      Document.findByIdAndDelete.mockRejectedValue(new Error("Invalid id"));

      await deleteDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});