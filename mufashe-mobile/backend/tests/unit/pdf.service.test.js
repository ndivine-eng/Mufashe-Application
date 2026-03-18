const fs = require("fs");
const pdf = require("pdf-parse");

const { extractTextFromPdfFile } = require("../../src/services/pdf.service");

jest.mock("fs");
jest.mock("pdf-parse");

describe("pdf.service - extractTextFromPdfFile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should throw if file does not exist", async () => {
    fs.existsSync.mockReturnValue(false);

    await expect(extractTextFromPdfFile("data/laws/test.pdf")).rejects.toThrow("File not found");
  });

  it("should extract and clean pdf text", async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(Buffer.from("fake pdf"));

    pdf.mockResolvedValue({
      text: "Hello\r\n\r\nWorld\n\n\nThis is test",
      numpages: 3,
    });

    const result = await extractTextFromPdfFile("data/laws/test.pdf");

    expect(result).toEqual({
      text: "Hello\nWorld\nThis is test",
      pageCount: 3,
    });
  });

  it("should throw if pdf contains no readable text", async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(Buffer.from("fake pdf"));

    pdf.mockResolvedValue({
      text: "   ",
      numpages: 1,
    });

    await expect(extractTextFromPdfFile("data/laws/test.pdf")).rejects.toThrow(
      "PDF contains no readable text"
    );
  });

  it("should rethrow parser errors", async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(Buffer.from("fake pdf"));

    pdf.mockRejectedValue(new Error("PDF parse failed"));

    await expect(extractTextFromPdfFile("data/laws/test.pdf")).rejects.toThrow(
      "PDF parse failed"
    );
  });
});