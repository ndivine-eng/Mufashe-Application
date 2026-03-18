const requireRole = require("../../src/middleware/requireRole");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("requireRole middleware", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {};
    res = mockRes();
    next = jest.fn();
  });

  it("should return 401 if req.user is missing", () => {
    const middleware = requireRole("admin");

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Authentication required",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 403 if role is not allowed", () => {
    req.user = { role: "user" };
    const middleware = requireRole("admin");

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Access denied",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should allow access when role matches exactly", () => {
    req.user = { role: "admin" };
    const middleware = requireRole("admin");

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should allow access when role matches case-insensitively", () => {
    req.user = { role: "Admin" };
    const middleware = requireRole("ADMIN");

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should allow access when one of multiple roles matches", () => {
    req.user = { role: "lawyer" };
    const middleware = requireRole("admin", "lawyer");

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should deny access when user role is empty", () => {
    req.user = { role: "" };
    const middleware = requireRole("admin", "lawyer");

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Access denied",
    });
    expect(next).not.toHaveBeenCalled();
  });
});