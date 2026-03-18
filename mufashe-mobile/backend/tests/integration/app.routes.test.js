const request = require("supertest");
const app = require("../../src/app");

describe("App Routes", () => {
  test("unknown route should return 404", async () => {
    const res = await request(app).get("/this-route-does-not-exist");
    expect(res.statusCode).toBe(404);
  });
});