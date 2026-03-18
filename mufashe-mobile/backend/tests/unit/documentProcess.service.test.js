const Document = require("../../src/models/Document");
const DocumentChunk = require("../../src/models/DocumentChunk");

const { extractTextFromPdfFile } = require("../../src/services/pdf.service");
const { splitIntoChunks } = require("../../src/services/chunk.service");
const { createEmbedding } = require("../../src/services/embedding.service");
const { processOneDocument } = require("../../src/services/documentProcess.service");

jest.mock("../../src/models/Document");
jest.mock("../../src/models/DocumentChunk");
jest.mock("../../src/services/pdf.service");
jest.mock("../../src/services/chunk.service");
jest.mock("../../src/services/embedding.service");

describe("documentProcess.service - processOneDocument", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should throw if document not found", async () => {
    Document.findById.mockResolvedValue(null);

    await expect(processOneDocument("doc1")).rejects.toThrow("Document not found");
  });

  it("should throw if document has no fileKey", async () => {
    Document.findById.mockResolvedValue({
      _id: "doc1",
      fileKey: null,
    });

    await expect(processOneDocument("doc1")).rejects.toThrow("No file attached to document");
  });

  it("should process document successfully", async () => {
    const saveMock = jest.fn().mockResolvedValue(true);

    const doc = {
      _id: "doc1",
      fileKey: "data/laws/test.pdf",
      status: "UPLOADED",
      errorMessage: null,
      save: saveMock,
    };

    Document.findById.mockResolvedValue(doc);

    extractTextFromPdfFile.mockResolvedValue({
      text: "This is extracted text",
      pageCount: 2,
    });

    splitIntoChunks.mockReturnValue([
      { chunkIndex: 0, chunkText: "chunk 1" },
      { chunkIndex: 1, chunkText: "chunk 2" },
    ]);

    DocumentChunk.deleteMany.mockResolvedValue({ deletedCount: 1 });

    const createdChunks = [
      { _id: "c1", chunkText: "chunk 1" },
      { _id: "c2", chunkText: "chunk 2" },
    ];

    DocumentChunk.insertMany.mockResolvedValue(createdChunks);

    createEmbedding
      .mockResolvedValueOnce([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      .mockResolvedValueOnce([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);

    DocumentChunk.updateOne.mockResolvedValue({ acknowledged: true });

    const result = await processOneDocument("doc1");

    expect(doc.status).toBe("READY");
    expect(DocumentChunk.deleteMany).toHaveBeenCalledWith({ documentId: "doc1" });
    expect(DocumentChunk.insertMany).toHaveBeenCalledTimes(1);
    expect(createEmbedding).toHaveBeenCalledTimes(2);
    expect(DocumentChunk.updateOne).toHaveBeenCalledTimes(2);

    expect(result).toEqual({
      id: "doc1",
      status: "READY",
      pageCount: 2,
      textLength: "This is extracted text".length,
      processedAt: doc.processedAt,
      chunksCreated: 2,
      embeddingsSaved: 2,
    });
  });

  it("should handle case with zero chunks", async () => {
    const saveMock = jest.fn().mockResolvedValue(true);

    const doc = {
      _id: "doc1",
      fileKey: "data/laws/test.pdf",
      status: "UPLOADED",
      errorMessage: null,
      save: saveMock,
    };

    Document.findById.mockResolvedValue(doc);

    extractTextFromPdfFile.mockResolvedValue({
      text: "This is extracted text",
      pageCount: 1,
    });

    splitIntoChunks.mockReturnValue([]);
    DocumentChunk.deleteMany.mockResolvedValue({ deletedCount: 0 });

    const result = await processOneDocument("doc1");

    expect(DocumentChunk.insertMany).not.toHaveBeenCalled();
    expect(createEmbedding).not.toHaveBeenCalled();

    expect(result).toEqual({
      id: "doc1",
      status: "READY",
      pageCount: 1,
      textLength: "This is extracted text".length,
      processedAt: doc.processedAt,
      chunksCreated: 0,
      embeddingsSaved: 0,
    });
  });

  it("should mark document as FAILED if processing throws", async () => {
    const saveMock = jest.fn().mockResolvedValue(true);

    const doc = {
      _id: "doc1",
      fileKey: "data/laws/test.pdf",
      status: "UPLOADED",
      errorMessage: null,
      save: saveMock,
    };

    Document.findById.mockResolvedValue(doc);

    extractTextFromPdfFile.mockRejectedValue(new Error("PDF broken"));

    await expect(processOneDocument("doc1")).rejects.toThrow("PDF broken");

    expect(doc.status).toBe("FAILED");
    expect(doc.errorMessage).toBe("PDF broken");
    expect(saveMock).toHaveBeenCalled();
  });
});