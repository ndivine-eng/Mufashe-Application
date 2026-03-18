const express = require("express");
const request = require("supertest");

jest.mock("../../src/middleware/auth", () =>
  jest.fn((req, res, next) => {
    req.user = { id: "u1", role: "admin" };
    next();
  })
);

jest.mock("../../src/middleware/requireAdmin", () =>
  jest.fn((req, res, next) => next())
);

jest.mock("../../src/controllers/questions.controller", () => ({
  myRecent: jest.fn((req, res) => res.json({ ok: true, action: "myRecent" })),
  myAll: jest.fn((req, res) => res.json({ ok: true, action: "myAll" })),
  adminList: jest.fn((req, res) => res.json({ ok: true, action: "adminList" })),
  approve: jest.fn((req, res) => res.json({ ok: true, action: "approve", id: req.params.id })),
  reject: jest.fn((req, res) => res.json({ ok: true, action: "reject", id: req.params.id })),
  getById: jest.fn((req, res) => res.json({ ok: true, action: "getById", id: req.params.id })),
}));

const questionsRouter = require("../../src/routes/questions.routes");

describe("questions.routes", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/questions", questionsRouter);
  });

  it("GET /ping should work", async () => {
    const res = await request(app).get("/api/questions/ping");
    expect(res.body).toEqual({ ok: true, route: "/api/questions" });
  });

  it("GET /recent should call myRecent", async () => {
    const res = await request(app).get("/api/questions/recent");
    expect(res.body).toEqual({ ok: true, action: "myRecent" });
  });

  it("GET /me should call myAll", async () => {
    const res = await request(app).get("/api/questions/me");
    expect(res.body).toEqual({ ok: true, action: "myAll" });
  });

  it("GET / should call adminList", async () => {
    const res = await request(app).get("/api/questions");
    expect(res.body).toEqual({ ok: true, action: "adminList" });
  });

  it("POST /:id/approve should call approve", async () => {
    const res = await request(app).post("/api/questions/q1/approve");
    expect(res.body).toEqual({ ok: true, action: "approve", id: "q1" });
  });

  it("POST /:id/reject should call reject", async () => {
    const res = await request(app).post("/api/questions/q1/reject");
    expect(res.body).toEqual({ ok: true, action: "reject", id: "q1" });
  });

  it("GET /:id should call getById", async () => {
    const res = await request(app).get("/api/questions/q1");
    expect(res.body).toEqual({ ok: true, action: "getById", id: "q1" });
  });
});