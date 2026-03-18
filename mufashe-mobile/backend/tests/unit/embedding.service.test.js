const axios = require("axios");
const { createEmbedding } = require("../../src/services/embedding.service");

jest.mock("axios");

describe("embedding.service - createEmbedding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should throw if text is empty", async () => {
    await expect(createEmbedding("")).rejects.toThrow("Cannot embed empty text");
  });

  it("should call ollama embed endpoint and return vector", async () => {
    const vector = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

    axios.post.mockResolvedValue({
      data: {
        embeddings: [vector],
      },
    });

    const result = await createEmbedding("What is a constitution?");

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining("/api/embed"),
      {
        model: expect.any(String),
        input: "What is a constitution?",
      }
    );

    expect(result).toEqual(vector);
  });

  it("should throw if embedding is invalid", async () => {
    axios.post.mockResolvedValue({
      data: {
        embeddings: [[1, 2, 3]],
      },
    });

    await expect(createEmbedding("Hello")).rejects.toThrow("Ollama embed failed");
  });

  it("should throw if no embedding returned", async () => {
    axios.post.mockResolvedValue({
      data: {},
    });

    await expect(createEmbedding("Hello")).rejects.toThrow("Ollama embed failed");
  });
});