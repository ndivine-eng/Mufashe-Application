const express = require("express");
const request = require("supertest");

jest.mock("../../src/middleware/auth", () =>
  jest.fn((req, res, next) => {
    req.user = { id: "admin1", role: "admin" };
    next();
  })
);

jest.mock("../../src/middleware/requireAdmin", () =>
  jest.fn((req, res, next) => next())
);

jest.mock("../../src/middleware/uploadPdf", () => ({
  single: jest.fn(() => (req, res, next) => next()),
}));

jest.mock("../../src/controllers/document.controller", () => ({
  createDocument: jest.fn((req, res) => res.json({ ok: true, action: "createDocument" })),
  listDocuments: jest.fn((req, res) => res.json({ ok: true, action: "listDocuments" })),
  getDocumentById: jest.fn((req, res) => res.json({ ok: true, action: "getDocumentById", id: req.params.id })),
  updateDocument: jest.fn((req, res) => res.json({ ok: true, action: "updateDocument", id: req.params.id })),
  deleteDocument: jest.fn((req, res) => res.json({ ok: true, action: "deleteDocument", id: req.params.id })),
  uploadDocumentPdf: jest.fn((req, res) => res.json({ ok: true, action: "uploadDocumentPdf" })),
  processDocumentText: jest.fn((req, res) => res.json({ ok: true, action: "processDocumentText", id: req.params.id })),
  processAllDocuments: jest.fn((req, res) => res.json({ ok: true, action: "processAllDocuments" })),
}));

const documentRouter = require("../../src/routes/document.routes");

describe("document.routes", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/documents", documentRouter);
  });

  it("GET / should call listDocuments", async () => {
    const res = await request(app).get("/api/documents");
    expect(res.body).toEqual({ ok: true, action: "listDocuments" });
  });

  it("POST / should call createDocument", async () => {
    const res = await request(app).post("/api/documents");
    expect(res.body).toEqual({ ok: true, action: "createDocument" });
  });

  it("POST /upload should call uploadDocumentPdf", async () => {
    const res = await request(app).post("/api/documents/upload");
    expect(res.body).toEqual({ ok: true, action: "uploadDocumentPdf" });
  });

  it("POST /process-all should call processAllDocuments", async () => {
    const res = await request(app).post("/api/documents/process-all");
    expect(res.body).toEqual({ ok: true, action: "processAllDocuments" });
  });

  it("POST /:id/process should call processDocumentText", async () => {
    const res = await request(app).post("/api/documents/doc1/process");
    expect(res.body).toEqual({ ok: true, action: "processDocumentText", id: "doc1" });
  });

  it("GET /:id should call getDocumentById", async () => {
    const res = await request(app).get("/api/documents/doc1");
    expect(res.body).toEqual({ ok: true, action: "getDocumentById", id: "doc1" });
  });

  it("PUT /:id should call updateDocument", async () => {
    const res = await request(app).put("/api/documents/doc1");
    expect(res.body).toEqual({ ok: true, action: "updateDocument", id: "doc1" });
  });

  it("DELETE /:id should call deleteDocument", async () => {
    const res = await request(app).delete("/api/documents/doc1");
    expect(res.body).toEqual({ ok: true, action: "deleteDocument", id: "doc1" });
  });
});