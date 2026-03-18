const {
  embedDocumentChunks,
  semanticSearch,
} = require("../../src/controllers/search.controller");

const {
  embedChunksForDocument,
} = require("../../src/services/embedChunks.mongo.service");

const {
  vectorSearch,
} = require("../../src/services/vectorSearch.mongo.service");

jest.mock("../../src/services/embedChunks.mongo.service");
jest.mock("../../src/services/vectorSearch.mongo.service");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("search.controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("embedDocumentChunks", () => {
    it("should embed chunks successfully", async () => {
      const req = { params: { documentId: "doc123" } };
      const res = mockRes();

      embedChunksForDocument.mockResolvedValue({
        embeddedCount: 10,
      });

      await embedDocumentChunks(req, res);

      expect(embedChunksForDocument).toHaveBeenCalledWith("doc123");
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        message: "Embeddings created and saved in MongoDB",
        documentId: "doc123",
        embeddedCount: 10,
      });
    });

    it("should return 500 if embedding fails", async () => {
      const req = { params: { documentId: "doc123" } };
      const res = mockRes();

      embedChunksForDocument.mockRejectedValue(new Error("Embedding failed"));

      await embedDocumentChunks(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        ok: false,
        message: "Embedding chunks failed",
        error: "Embedding failed",
      });
    });
  });

  describe("semanticSearch", () => {
    it("should reject short question", async () => {
      const req = { body: { question: "hi" } };
      const res = mockRes();

      await semanticSearch(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "question is required (min 3 chars)",
      });
    });

    it("should return search results", async () => {
      const req = {
        body: {
          question: "What is land law?",
          topK: 3,
          documentId: "doc1",
        },
      };
      const res = mockRes();

      const results = [{ chunkText: "Land law info", score: 0.91 }];
      vectorSearch.mockResolvedValue(results);

      await semanticSearch(req, res);

      expect(vectorSearch).toHaveBeenCalledWith("What is land law?", {
        limit: 3,
        documentId: "doc1",
      });

      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        question: "What is land law?",
        topK: 3,
        results,
      });
    });

    it("should default topK to 5", async () => {
      const req = { body: { question: "Explain business law" } };
      const res = mockRes();

      vectorSearch.mockResolvedValue([]);

      await semanticSearch(req, res);

      expect(vectorSearch).toHaveBeenCalledWith("Explain business law", {
        limit: 5,
        documentId: null,
      });
    });

    it("should return 500 on search error", async () => {
      const req = { body: { question: "Explain labor law" } };
      const res = mockRes();

      vectorSearch.mockRejectedValue(new Error("Vector failed"));

      await semanticSearch(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        ok: false,
        message: "Semantic search failed",
        error: "Vector failed",
      });
    });
  });
});