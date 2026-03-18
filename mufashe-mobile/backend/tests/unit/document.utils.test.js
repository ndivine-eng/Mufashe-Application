const { normalizeCategory } = require("../../src/utils/document.utils");

describe("normalizeCategory", () => {
  test("converts to uppercase", () => {
    expect(normalizeCategory("land")).toBe("LAND");
  });

  test("trims spaces", () => {
    expect(normalizeCategory(" family ")).toBe("FAMILY");
  });

  test("returns undefined when value is missing", () => {
    expect(normalizeCategory()).toBeUndefined();
  });
});