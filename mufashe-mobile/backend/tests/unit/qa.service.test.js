const axios = require("axios");
const mongoose = require("mongoose");

const Document = require("../../src/models/Document");
const DocumentChunk = require("../../src/models/DocumentChunk");
const { createEmbedding } = require("../../src/services/embedding.service");
const { answerQuestion } = require("../../src/services/qa.service");

jest.mock("axios");
jest.mock("../../src/models/Document");
jest.mock("../../src/models/DocumentChunk");
jest.mock("../../src/services/embedding.service");

describe("qa.service - answerQuestion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should throw if question is empty", async () => {
    await expect(answerQuestion({ userId: "u1", question: "" })).rejects.toThrow(
      "Question is required"
    );
  });

  it("should return fallback answer if no READY docs exist", async () => {
    Document.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([]),
    });

    const result = await answerQuestion({
      userId: "u1",
      question: "What is land law?",
    });

    expect(result.answer).toContain("I could not find enough relevant legal information");
    expect(result.sources).toEqual([]);
  });

  it("should return fallback answer if docs exist but no chunks found", async () => {
    const docs = [{ _id: new mongoose.Types.ObjectId(), title: "Land Law" }];

    Document.find.mockReturnValue({
      select: jest.fn().mockResolvedValue(docs),
    });

    createEmbedding.mockResolvedValue([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    DocumentChunk.aggregate.mockResolvedValue([]);

    const result = await answerQuestion({
      userId: "u1",
      question: "What is land law?",
    });

    expect(result.answer).toContain("I could not find enough relevant legal information");
    expect(result.sources).toEqual([]);
  });

  it("should generate grounded answer with sources", async () => {
    const docId = new mongoose.Types.ObjectId();

    const docs = [
      {
        _id: docId,
        title: "Land Law",
        category: "LAND",
        docType: "LAW",
      },
    ];

    const chunks = [
      {
        _id: "c1",
        documentId: docId,
        chunkIndex: 0,
        chunkText: "Land disputes should be reported to authorities.",
        pageStart: 2,
        pageEnd: 2,
        score: 0.95,
      },
    ];

    Document.find.mockReturnValue({
      select: jest.fn().mockResolvedValue(docs),
    });

    createEmbedding.mockResolvedValue([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    DocumentChunk.aggregate.mockResolvedValue(chunks);

    axios.post.mockResolvedValue({
      data: {
        response:
          "Summary:\nThis is a grounded legal answer.\n\nWhat this may mean for you:\n- It helps the user.\n\nWhat you can do next:\n- Follow the law.\n\nWhat to prepare:\n- Evidence.\n\nUrgent note:\nNo urgent warning from the available sources.\n\nSources used:\n- [1] Land Law\n\nThis is legal information, not a lawyer-client relationship.",
      },
    });

    const result = await answerQuestion({
      userId: "u1",
      question: "What should I do in a land dispute?",
      topK: 4,
    });

    expect(result.answer).toContain("This is a grounded legal answer");
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toMatchObject({
      n: 1,
      title: "Land Law",
      pageStart: 2,
      pageEnd: 2,
    });
  });

  it("should return fallback answer if ollama returns empty response", async () => {
    const docId = new mongoose.Types.ObjectId();

    const docs = [
      {
        _id: docId,
        title: "Family Law",
        category: "FAMILY",
        docType: "LAW",
      },
    ];

    const chunks = [
      {
        _id: "c1",
        documentId: docId,
        chunkIndex: 0,
        chunkText: "Family disputes may involve mediation.",
        pageStart: 1,
        pageEnd: 1,
        score: 0.89,
      },
    ];

    Document.find.mockReturnValue({
      select: jest.fn().mockResolvedValue(docs),
    });

    createEmbedding.mockResolvedValue([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    DocumentChunk.aggregate.mockResolvedValue(chunks);

    axios.post.mockResolvedValue({
      data: {
        response: "",
      },
    });

    const result = await answerQuestion({
      userId: "u1",
      question: "What happens in a family dispute?",
    });

    expect(result.answer).toContain("I could not generate a grounded answer");
    expect(result.sources).toHaveLength(1);
  });
});