const express = require("express");
const request = require("supertest");

jest.mock("../../src/middleware/auth", () =>
  jest.fn((req, res, next) => {
    req.user = { id: "admin1", role: "admin" };
    next();
  })
);

jest.mock("../../src/middleware/requireAdmin", () =>
  jest.fn((req, res, next) => next())
);

jest.mock("../../src/controllers/users.controller", () => ({
  listUsers: jest.fn((req, res) => res.json({ ok: true, action: "listUsers" })),
  getUser: jest.fn((req, res) => res.json({ ok: true, action: "getUser", id: req.params.id })),
  updateUser: jest.fn((req, res) => res.json({ ok: true, action: "updateUser", id: req.params.id })),
  updateUserRole: jest.fn((req, res) => res.json({ ok: true, action: "updateUserRole", id: req.params.id })),
  deleteUser: jest.fn((req, res) => res.json({ ok: true, action: "deleteUser", id: req.params.id })),
}));

const usersRouter = require("../../src/routes/users.routes");

describe("users.routes", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/users", usersRouter);
  });

  it("GET / should call listUsers", async () => {
    const res = await request(app).get("/api/users");
    expect(res.body).toEqual({ ok: true, action: "listUsers" });
  });

  it("GET /:id should call getUser", async () => {
    const res = await request(app).get("/api/users/123");
    expect(res.body).toEqual({ ok: true, action: "getUser", id: "123" });
  });

  it("PUT /:id should call updateUser", async () => {
    const res = await request(app).put("/api/users/123").send({ name: "Ben" });
    expect(res.body).toEqual({ ok: true, action: "updateUser", id: "123" });
  });

  it("PATCH /:id/role should call updateUserRole", async () => {
    const res = await request(app).patch("/api/users/123/role").send({ role: "admin" });
    expect(res.body).toEqual({ ok: true, action: "updateUserRole", id: "123" });
  });

  it("DELETE /:id should call deleteUser", async () => {
    const res = await request(app).delete("/api/users/123");
    expect(res.body).toEqual({ ok: true, action: "deleteUser", id: "123" });
  });
});