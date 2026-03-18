const requireAdmin = require("../../src/middleware/requireAdmin");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("requireAdmin middleware", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {};
    res = mockRes();
    next = jest.fn();
  });

  it("should return 401 if req.user is missing", () => {
    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Authentication required",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 403 if user is not admin", () => {
    req.user = { id: "u1", role: "user" };

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Access denied. Admins only.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should call next if user is admin", () => {
    req.user = { id: "u1", role: "admin" };

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should return 500 if an unexpected error happens", () => {
    Object.defineProperty(req, "user", {
      get() {
        throw new Error("Unexpected failure");
      },
    });

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Server error",
    });
    expect(next).not.toHaveBeenCalled();
  });
});