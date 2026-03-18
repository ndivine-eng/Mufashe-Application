const mongoose = require("mongoose");
const DocumentChunk = require("../../src/models/DocumentChunk");
const { createEmbedding } = require("../../src/services/embedding.service");
const { embedChunksForDocument } = require("../../src/services/embedChunks.mongo.service");

jest.mock("../../src/models/DocumentChunk");
jest.mock("../../src/services/embedding.service");

describe("embedChunks.mongo.service - embedChunksForDocument", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should throw for invalid documentId", async () => {
    await expect(embedChunksForDocument("bad-id")).rejects.toThrow("Invalid documentId");
  });

  it("should return zero counts if no chunks found", async () => {
    const validId = new mongoose.Types.ObjectId().toString();

    const sortMock = jest.fn().mockResolvedValue([]);
    DocumentChunk.find.mockReturnValue({ sort: sortMock });

    const result = await embedChunksForDocument(validId);

    expect(result).toEqual({
      total: 0,
      embeddedNow: 0,
      alreadyEmbedded: 0,
    });
  });

  it("should embed only chunks without embeddings", async () => {
    const validId = new mongoose.Types.ObjectId().toString();

    const chunk1 = {
      chunkText: "chunk one",
      embedding: [],
      save: jest.fn().mockResolvedValue(true),
    };

    const chunk2 = {
      chunkText: "chunk two",
      embedding: [0.1, 0.2],
      save: jest.fn(),
    };

    const sortMock = jest.fn().mockResolvedValue([chunk1, chunk2]);
    DocumentChunk.find.mockReturnValue({ sort: sortMock });

    createEmbedding.mockResolvedValue([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    const result = await embedChunksForDocument(validId);

    expect(createEmbedding).toHaveBeenCalledTimes(1);
    expect(createEmbedding).toHaveBeenCalledWith("chunk one");
    expect(chunk1.save).toHaveBeenCalled();
    expect(chunk2.save).not.toHaveBeenCalled();

    expect(result).toEqual({
      total: 2,
      embeddedNow: 1,
      alreadyEmbedded: 1,
    });
  });
});