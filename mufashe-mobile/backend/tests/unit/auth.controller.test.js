jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(),
}));

jest.mock("../../src/models/User", () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  exists: jest.fn(),
  create: jest.fn(),
}));

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../../src/models/User");
const authController = require("../../src/controllers/auth.controller");

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe("Auth Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "testsecret";
    process.env.ADMIN_EMAIL = "admin@example.com";
    process.env.ADMIN_SETUP_KEY = "setup123";
  });

  describe("register()", () => {
    test("should return 400 if name or password is missing", async () => {
      const req = {
        body: {
          name: "",
          email: "user@example.com",
          password: "",
        },
      };
      const res = mockRes();

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "name and password are required",
      });
    });

    test("should return 400 if neither email nor phone is provided", async () => {
      const req = {
        body: {
          name: "Divine",
          password: "123456",
        },
      };
      const res = mockRes();

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Provide at least one: email or phone",
      });
    });

    test("should return 400 if password is too short", async () => {
      const req = {
        body: {
          name: "Divine",
          email: "user@example.com",
          password: "123",
        },
      };
      const res = mockRes();

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Password must be at least 6 characters",
      });
    });

    test("should return 409 if email already exists", async () => {
      User.findOne.mockResolvedValueOnce({ _id: "existing-user-id" });

      const req = {
        body: {
          name: "Divine",
          email: "user@example.com",
          password: "123456",
        },
      };
      const res = mockRes();

      await authController.register(req, res);

      expect(User.findOne).toHaveBeenCalledWith({ email: "user@example.com" });
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: "Email already exists",
      });
    });

    test("should return 409 if phone already exists", async () => {
      User.findOne
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce({ _id: "existing-phone-id" }); // phone check

      const req = {
        body: {
          name: "Divine",
          email: "user@example.com",
          phone: "+250 788-123-456",
          password: "123456",
        },
      };
      const res = mockRes();

      await authController.register(req, res);

      expect(User.findOne).toHaveBeenCalledWith({ phone: "+250788123456" });
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: "Phone already exists",
      });
    });

    test("should return 409 if name already exists", async () => {
      User.findOne
        .mockResolvedValueOnce(null) // email
        .mockResolvedValueOnce(null) // phone
        .mockResolvedValueOnce({ _id: "existing-name-id" }); // name

      const req = {
        body: {
          name: "Divine",
          email: "user@example.com",
          phone: "+250788123456",
          password: "123456",
        },
      };
      const res = mockRes();

      await authController.register(req, res);

      expect(User.findOne).toHaveBeenCalledWith({ name: "Divine" });
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: "Name already exists",
      });
    });

    test("should register successfully for normal user", async () => {
      User.findOne
        .mockResolvedValueOnce(null) // email
        .mockResolvedValueOnce(null) // phone
        .mockResolvedValueOnce(null); // name

      bcrypt.hash.mockResolvedValue("hashed-password");
      jwt.sign.mockReturnValue("fake-jwt-token");

      User.create.mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        name: "Divine",
        email: "user@example.com",
        phone: "+250788123456",
        role: "user",
      });

      const req = {
        body: {
          name: " Divine ",
          email: "USER@example.com",
          phone: "+250 788 123 456",
          password: "123456",
        },
      };
      const res = mockRes();

      await authController.register(req, res);

      expect(bcrypt.hash).toHaveBeenCalledWith("123456", 10);
      expect(User.create).toHaveBeenCalledWith({
        name: "Divine",
        email: "user@example.com",
        phone: "+250788123456",
        passwordHash: "hashed-password",
      });

      expect(jwt.sign).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          token: "fake-jwt-token",
          user: expect.objectContaining({
            name: "Divine",
            email: "user@example.com",
            phone: "+250788123456",
            role: "user",
          }),
        })
      );
    });

    test("should auto-promote to admin if email matches ADMIN_EMAIL", async () => {
      User.findOne
        .mockResolvedValueOnce(null) // email
        .mockResolvedValueOnce(null); // name

      bcrypt.hash.mockResolvedValue("hashed-password");
      jwt.sign.mockReturnValue("admin-token");

      const save = jest.fn().mockResolvedValue(true);

      User.create.mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        name: "Admin User",
        email: "admin@example.com",
        phone: null,
        role: "user",
        save,
      });

      const req = {
        body: {
          name: "Admin User",
          email: "admin@example.com",
          password: "123456",
        },
      };
      const res = mockRes();

      await authController.register(req, res);

      expect(save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);

      const response = res.json.mock.calls[0][0];
      expect(response.token).toBe("admin-token");
      expect(response.user.role).toBe("admin");
    });

    test("should return 409 for duplicate key database error", async () => {
      User.findOne
        .mockResolvedValueOnce(null) // email
        .mockResolvedValueOnce(null); // name

      bcrypt.hash.mockResolvedValue("hashed-password");

      const dupError = new Error("duplicate");
      dupError.code = 11000;
      dupError.keyPattern = { email: 1 };

      User.create.mockRejectedValue(dupError);

      const req = {
        body: {
          name: "Divine",
          email: "user@example.com",
          password: "123456",
        },
      };
      const res = mockRes();

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: "email already exists",
      });
    });
  });

  describe("login()", () => {
    test("should return 400 if identifier or password is missing", async () => {
      const req = {
        body: {
          identifier: "",
          password: "",
        },
      };
      const res = mockRes();

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "identifier (email, phone, or name) and password are required",
      });
    });

    test("should login using email", async () => {
      User.findOne.mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        name: "Divine",
        email: "user@example.com",
        phone: "+250788123456",
        role: "user",
        passwordHash: "hashed-password",
      });

      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue("email-login-token");

      const req = {
        body: {
          identifier: "USER@example.com",
          password: "123456",
        },
      };
      const res = mockRes();

      await authController.login(req, res);

      expect(User.findOne).toHaveBeenCalledWith({ email: "user@example.com" });
      expect(bcrypt.compare).toHaveBeenCalledWith("123456", "hashed-password");

      const response = res.json.mock.calls[0][0];
      expect(response.token).toBe("email-login-token");
      expect(response.user.name).toBe("Divine");
    });

    test("should login using phone", async () => {
      User.findOne.mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        name: "Divine",
        email: "user@example.com",
        phone: "+250788123456",
        role: "user",
        passwordHash: "hashed-password",
      });

      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue("phone-login-token");

      const req = {
        body: {
          identifier: "+250 788 123 456",
          password: "123456",
        },
      };
      const res = mockRes();

      await authController.login(req, res);

      expect(User.findOne).toHaveBeenCalledWith({ phone: "+250788123456" });

      const response = res.json.mock.calls[0][0];
      expect(response.token).toBe("phone-login-token");
    });

    test("should login using name", async () => {
      User.findOne.mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        name: "Divine",
        email: "user@example.com",
        phone: "+250788123456",
        role: "user",
        passwordHash: "hashed-password",
      });

      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue("name-login-token");

      const req = {
        body: {
          identifier: "Divine",
          password: "123456",
        },
      };
      const res = mockRes();

      await authController.login(req, res);

      expect(User.findOne).toHaveBeenCalledWith({ name: "Divine" });

      const response = res.json.mock.calls[0][0];
      expect(response.token).toBe("name-login-token");
    });

    test("should return 401 if user is not found", async () => {
      User.findOne.mockResolvedValue(null);

      const req = {
        body: {
          identifier: "missing@example.com",
          password: "123456",
        },
      };
      const res = mockRes();

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid credentials",
      });
    });

    test("should return 401 if password is incorrect", async () => {
      User.findOne.mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        name: "Divine",
        email: "user@example.com",
        role: "user",
        passwordHash: "hashed-password",
      });

      bcrypt.compare.mockResolvedValue(false);

      const req = {
        body: {
          identifier: "user@example.com",
          password: "wrongpass",
        },
      };
      const res = mockRes();

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid credentials",
      });
    });
  });

  describe("me()", () => {
    test("should return 404 if user not found", async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const req = {
        user: { id: "507f1f77bcf86cd799439011" },
      };
      const res = mockRes();

      await authController.me(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "User not found",
      });
    });

    test("should return current user", async () => {
      const userData = {
        _id: "507f1f77bcf86cd799439011",
        name: "Divine",
        email: "user@example.com",
        role: "user",
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(userData),
      });

      const req = {
        user: { id: "507f1f77bcf86cd799439011" },
      };
      const res = mockRes();

      await authController.me(req, res);

      expect(res.json).toHaveBeenCalledWith(userData);
    });
  });

  describe("bootstrapAdmin()", () => {
    test("should return 403 for invalid setup key", async () => {
      const req = {
        body: { setupKey: "wrong-key" },
        user: { id: "507f1f77bcf86cd799439011" },
      };
      const res = mockRes();

      await authController.bootstrapAdmin(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid setup key",
      });
    });

    test("should return 409 if admin already exists", async () => {
      User.exists.mockResolvedValue(true);

      const req = {
        body: { setupKey: "setup123" },
        user: { id: "507f1f77bcf86cd799439011" },
      };
      const res = mockRes();

      await authController.bootstrapAdmin(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: "Admin already exists. Bootstrap disabled.",
      });
    });

    test("should return 404 if current user is not found", async () => {
      User.exists.mockResolvedValue(false);
      User.findById.mockResolvedValue(null);

      const req = {
        body: { setupKey: "setup123" },
        user: { id: "507f1f77bcf86cd799439011" },
      };
      const res = mockRes();

      await authController.bootstrapAdmin(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "User not found",
      });
    });

    test("should promote current user to admin successfully", async () => {
      User.exists.mockResolvedValue(false);

      const save = jest.fn().mockResolvedValue(true);

      User.findById.mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        name: "Divine",
        email: "user@example.com",
        role: "user",
        save,
      });

      const req = {
        body: { setupKey: "setup123" },
        user: { id: "507f1f77bcf86cd799439011" },
      };
      const res = mockRes();

      await authController.bootstrapAdmin(req, res);

      expect(save).toHaveBeenCalled();

      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        message: "Bootstrap successful. You are now admin.",
        user: {
          id: "507f1f77bcf86cd799439011",
          name: "Divine",
          email: "user@example.com",
          role: "admin",
        },
      });
    });
  });
});