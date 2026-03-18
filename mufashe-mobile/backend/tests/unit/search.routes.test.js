const express = require("express");
const request = require("supertest");

jest.mock("../../src/controllers/search.controller", () => ({
  embedDocumentChunks: jest.fn((req, res) => {
    res.json({ ok: true, route: "embed", documentId: req.params.documentId });
  }),
  semanticSearch: jest.fn((req, res) => {
    res.json({ ok: true, route: "semantic", body: req.body });
  }),
}));

const searchRouter = require("../../src/routes/search.routes");

describe("search.routes", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/search", searchRouter);
  });

  it("POST /embed/:documentId should call embedDocumentChunks", async () => {
    const res = await request(app).post("/api/search/embed/doc123");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      route: "embed",
      documentId: "doc123",
    });
  });

  it("POST /semantic should call semanticSearch", async () => {
    const res = await request(app)
      .post("/api/search/semantic")
      .send({ question: "What is land law?" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      route: "semantic",
      body: { question: "What is land law?" },
    });
  });
});