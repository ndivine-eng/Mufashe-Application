const mongoose = require("mongoose");
const DocumentChunk = require("../../src/models/DocumentChunk");
const { createEmbedding } = require("../../src/services/embedding.service");
const { vectorSearch } = require("../../src/services/vectorSearch.mongo.service");

jest.mock("../../src/models/DocumentChunk");
jest.mock("../../src/services/embedding.service");

describe("vectorSearch.mongo.service - vectorSearch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should throw if question is empty", async () => {
    await expect(vectorSearch("")).rejects.toThrow("Question is required");
  });

  it("should build pipeline without documentId filter", async () => {
    createEmbedding.mockResolvedValue([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    DocumentChunk.aggregate.mockResolvedValue([{ chunkText: "result" }]);

    const result = await vectorSearch("What is law?");

    expect(createEmbedding).toHaveBeenCalledWith("What is law?");
    expect(DocumentChunk.aggregate).toHaveBeenCalledWith([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          numCandidates: 200,
          limit: 5,
        },
      },
      {
        $project: {
          _id: 1,
          documentId: 1,
          chunkIndex: 1,
          chunkText: 1,
          pageStart: 1,
          pageEnd: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ]);

    expect(result).toEqual([{ chunkText: "result" }]);
  });

  it("should build pipeline with valid documentId filter", async () => {
    const docId = new mongoose.Types.ObjectId().toString();

    createEmbedding.mockResolvedValue([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    DocumentChunk.aggregate.mockResolvedValue([]);

    await vectorSearch("Question", { limit: 3, documentId: docId });

    expect(DocumentChunk.aggregate).toHaveBeenCalledWith([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          numCandidates: 200,
          limit: 3,
          filter: { documentId: new mongoose.Types.ObjectId(docId) },
        },
      },
      {
        $project: {
          _id: 1,
          documentId: 1,
          chunkIndex: 1,
          chunkText: 1,
          pageStart: 1,
          pageEnd: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ]);
  });

  it("should ignore invalid documentId", async () => {
    createEmbedding.mockResolvedValue([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    DocumentChunk.aggregate.mockResolvedValue([]);

    await vectorSearch("Question", { limit: 2, documentId: "bad-id" });

    const pipeline = DocumentChunk.aggregate.mock.calls[0][0];
    expect(pipeline[0].$vectorSearch.filter).toBeUndefined();
  });
});