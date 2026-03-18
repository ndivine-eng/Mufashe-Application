const { splitIntoChunks } = require("../../src/services/chunk.service");

describe("chunk.service - splitIntoChunks", () => {
  it("should return empty array for empty text", () => {
    expect(splitIntoChunks("")).toEqual([]);
    expect(splitIntoChunks(null)).toEqual([]);
    expect(splitIntoChunks(undefined)).toEqual([]);
  });

  it("should return one chunk if text is shorter than chunk size", () => {
    const text = "Hello world";
    const result = splitIntoChunks(text, 50, 10);

    expect(result).toEqual([
      {
        chunkIndex: 0,
        chunkText: "Hello world",
      },
    ]);
  });

  it("should split long text into multiple chunks", () => {
    const text = "A".repeat(2500);
    const result = splitIntoChunks(text, 1200, 200);

    expect(result.length).toBeGreaterThan(1);
    expect(result[0]).toHaveProperty("chunkIndex", 0);
    expect(result[0]).toHaveProperty("chunkText");
    expect(result[1]).toHaveProperty("chunkIndex", 1);
  });

  it("should preserve overlap behavior", () => {
    const text = "ABCDEFGHIJ";
    const result = splitIntoChunks(text, 6, 2);

    expect(result).toEqual([
      { chunkIndex: 0, chunkText: "ABCDEF" },
      { chunkIndex: 1, chunkText: "EFGHIJ" },
    ]);
  });

  it("should trim input text", () => {
    const result = splitIntoChunks("   Hello world   ", 50, 10);

    expect(result).toEqual([
      {
        chunkIndex: 0,
        chunkText: "Hello world",
      },
    ]);
  });
});