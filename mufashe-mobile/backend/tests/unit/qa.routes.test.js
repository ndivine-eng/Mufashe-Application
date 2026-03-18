const express = require("express");
const request = require("supertest");

jest.mock("../../src/middleware/auth", () =>
  jest.fn((req, res, next) => {
    req.user = { id: "u1", role: "user" };
    next();
  })
);

jest.mock("../../src/controllers/qa.controller", () => ({
  ask: jest.fn((req, res) => {
    res.json({ ok: true, route: "ask", user: req.user });
  }),
}));

const qaRouter = require("../../src/routes/qa.routes");

describe("qa.routes", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/qa", qaRouter);
  });

  it("GET /ping should return ping response", async () => {
    const res = await request(app).get("/api/qa/ping");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      route: "/api/qa",
      method: "GET",
    });
  });

  it("POST /ping should return ping response", async () => {
    const res = await request(app).post("/api/qa/ping");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      route: "/api/qa",
      method: "POST",
    });
  });

  it("POST /ask should call auth and controller", async () => {
    const res = await request(app).post("/api/qa/ask").send({ question: "Hello" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.route).toBe("ask");
    expect(res.body.user).toEqual({ id: "u1", role: "user" });
  });
});