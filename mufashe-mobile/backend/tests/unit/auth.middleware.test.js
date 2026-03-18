jest.mock("jsonwebtoken", () => ({
  verify: jest.fn(),
}));

const jwt = require("jsonwebtoken");
const auth = require("../../src/middleware/auth");

describe("Auth Middleware", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      headers: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();

    jest.clearAllMocks();
    process.env.JWT_SECRET = "testsecret";
  });

  test("should return 401 if authorization header is missing", () => {
    auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "No token provided",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("should return 401 if authorization header does not start with Bearer", () => {
    req.headers.authorization = "Token abc123";

    auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "No token provided",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("should return 401 if bearer token is empty", () => {
    req.headers.authorization = "Bearer   ";

    auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "No token provided",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("should return 401 if token is invalid", () => {
    req.headers.authorization = "Bearer invalidtoken";

    jwt.verify.mockImplementation(() => {
      throw new Error("Invalid token");
    });

    auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid token",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("should return 401 if token is expired", () => {
    req.headers.authorization = "Bearer expiredtoken";

    const err = new Error("Token expired");
    err.name = "TokenExpiredError";

    jwt.verify.mockImplementation(() => {
      throw err;
    });

    auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Token expired",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("should attach decoded user and call next for valid token", () => {
    req.headers.authorization = "Bearer validtoken";

    jwt.verify.mockReturnValue({
      id: "507f1f77bcf86cd799439011",
      role: "user",
      name: "Divine",
    });

    auth(req, res, next);

    expect(req.user).toEqual({
      id: "507f1f77bcf86cd799439011",
      role: "user",
      name: "Divine",
    });

    expect(next).toHaveBeenCalled();
  });
});