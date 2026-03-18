const path = require("path");

jest.mock("fs", () => ({
  mkdirSync: jest.fn(),
}));

const mockDiskStorage = jest.fn((config) => ({
  _storageConfig: config,
}));

const mockMulter = jest.fn((options) => ({
  _multerOptions: options,
}));

mockMulter.diskStorage = mockDiskStorage;

jest.mock("multer", () => mockMulter);

describe("uploadPdf middleware", () => {
  let uploadPdf;
  let fs;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    fs = require("fs");
    uploadPdf = require("../../src/middleware/uploadPdf");
  });

  it("should create upload directory on load", () => {
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      path.join(process.cwd(), "data", "laws"),
      { recursive: true }
    );
  });

  it("should configure multer with storage, fileFilter, and size limit", () => {
    expect(mockMulter).toHaveBeenCalledTimes(1);

    const options = mockMulter.mock.calls[0][0];

    expect(options).toHaveProperty("storage");
    expect(options).toHaveProperty("fileFilter");
    expect(options).toHaveProperty("limits");
    expect(options.limits).toEqual({ fileSize: 25 * 1024 * 1024 });

    expect(uploadPdf).toEqual({
      _multerOptions: options,
    });
  });

  it("should configure diskStorage with destination and filename functions", () => {
    expect(mockDiskStorage).toHaveBeenCalledTimes(1);

    const storageConfig = mockDiskStorage.mock.calls[0][0];

    expect(typeof storageConfig.destination).toBe("function");
    expect(typeof storageConfig.filename).toBe("function");
  });

  it("destination should send files to uploadDir", () => {
    const storageConfig = mockDiskStorage.mock.calls[0][0];
    const cb = jest.fn();

    storageConfig.destination({}, {}, cb);

    expect(cb).toHaveBeenCalledWith(
      null,
      path.join(process.cwd(), "data", "laws")
    );
  });

  it("filename should generate sanitized unique filename", () => {
    const storageConfig = mockDiskStorage.mock.calls[0][0];
    const cb = jest.fn();

    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1234567890);

    storageConfig.filename(
      {},
      { originalname: "my unsafe file name!!.pdf" },
      cb
    );

    expect(cb).toHaveBeenCalledWith(
      null,
      "1234567890_my_unsafe_file_name__.pdf"
    );

    nowSpy.mockRestore();
  });

  it("filename should default extension to .pdf when extname is empty", () => {
    const storageConfig = mockDiskStorage.mock.calls[0][0];
    const cb = jest.fn();

    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1234567890);
    const pathModule = require("path");
    const extSpy = jest.spyOn(pathModule, "extname").mockReturnValue("");

    storageConfig.filename({}, { originalname: "document" }, cb);

    expect(cb).toHaveBeenCalledWith(
      null,
      "1234567890_document.pdf"
    );

    extSpy.mockRestore();
    nowSpy.mockRestore();
  });

  it("filename should limit basename length to 60 characters", () => {
    const storageConfig = mockDiskStorage.mock.calls[0][0];
    const cb = jest.fn();

    const longName = `${"a".repeat(100)}.pdf`;
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(111);

    storageConfig.filename({}, { originalname: longName }, cb);

    const generatedName = cb.mock.calls[0][1];
    const afterPrefix = generatedName.replace(/^111_/, "");
    const baseOnly = afterPrefix.replace(/\.pdf$/, "");

    expect(baseOnly.length).toBeLessThanOrEqual(60);

    nowSpy.mockRestore();
  });

  it("fileFilter should accept application/pdf mimetype", () => {
    const options = mockMulter.mock.calls[0][0];
    const cb = jest.fn();

    options.fileFilter(
      {},
      { mimetype: "application/pdf", originalname: "file.txt" },
      cb
    );

    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it("fileFilter should accept .pdf extension even if mimetype differs", () => {
    const options = mockMulter.mock.calls[0][0];
    const cb = jest.fn();

    options.fileFilter(
      {},
      { mimetype: "application/octet-stream", originalname: "file.pdf" },
      cb
    );

    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it("fileFilter should reject non-pdf files", () => {
    const options = mockMulter.mock.calls[0][0];
    const cb = jest.fn();

    options.fileFilter(
      {},
      { mimetype: "image/png", originalname: "image.png" },
      cb
    );

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(cb.mock.calls[0][0].message).toBe("Only PDF files are allowed");
    expect(cb.mock.calls[0][1]).toBe(false);
  });
});