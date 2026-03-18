const {
  listUsers,
  getUser,
  updateUser,
  updateUserRole,
  deleteUser,
} = require("../../src/controllers/users.controller");

const User = require("../../src/models/User");

jest.mock("../../src/models/User");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("users.controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("listUsers", () => {
    it("should list users with pagination and filters", async () => {
      const req = {
        query: { q: "ben", role: "user", page: "2", limit: "10" },
      };
      const res = mockRes();

      const items = [{ _id: "1", name: "Ben", email: "ben@test.com" }];

      const limitMock = jest.fn().mockResolvedValue(items);
      const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
      const sortMock = jest.fn().mockReturnValue({ skip: skipMock });
      const selectMock = jest.fn().mockReturnValue({ sort: sortMock });

      User.find.mockReturnValue({ select: selectMock });
      User.countDocuments.mockResolvedValue(15);

      await listUsers(req, res);

      expect(User.find).toHaveBeenCalledWith({
        role: "user",
        $or: [
          { name: { $regex: "ben", $options: "i" } },
          { email: { $regex: "ben", $options: "i" } },
          { phone: { $regex: "ben", $options: "i" } },
        ],
      });

      expect(User.countDocuments).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        items,
        page: 2,
        limit: 10,
        total: 15,
        totalPages: 2,
      });
    });

    it("should clamp page and limit values", async () => {
      const req = {
        query: { page: "0", limit: "999" },
      };
      const res = mockRes();

      const items = [];

      const limitMock = jest.fn().mockResolvedValue(items);
      const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
      const sortMock = jest.fn().mockReturnValue({ skip: skipMock });
      const selectMock = jest.fn().mockReturnValue({ sort: sortMock });

      User.find.mockReturnValue({ select: selectMock });
      User.countDocuments.mockResolvedValue(0);

      await listUsers(req, res);

      expect(res.json).toHaveBeenCalledWith({
        items: [],
        page: 1,
        limit: 100,
        total: 0,
        totalPages: 0,
      });
    });

    it("should return 500 on error", async () => {
      const req = { query: {} };
      const res = mockRes();

      User.find.mockImplementation(() => {
        throw new Error("DB failed");
      });

      await listUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Server error",
        error: "DB failed",
      });
    });
  });

  describe("getUser", () => {
    it("should return a user by id", async () => {
      const req = { params: { id: "123" } };
      const res = mockRes();

      const user = { _id: "123", name: "Ben" };
      const select = jest.fn().mockResolvedValue(user);

      User.findById.mockReturnValue({ select });

      await getUser(req, res);

      expect(User.findById).toHaveBeenCalledWith("123");
      expect(res.json).toHaveBeenCalledWith(user);
    });

    it("should return 404 when user not found", async () => {
      const req = { params: { id: "123" } };
      const res = mockRes();

      const select = jest.fn().mockResolvedValue(null);
      User.findById.mockReturnValue({ select });

      await getUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "User not found" });
    });

    it("should return 400 for invalid id", async () => {
      const req = { params: { id: "bad-id" } };
      const res = mockRes();

      const select = jest.fn().mockRejectedValue(new Error("Cast error"));
      User.findById.mockReturnValue({ select });

      await getUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid user id",
        error: "Cast error",
      });
    });
  });

  describe("updateUser", () => {
    it("should update user fields", async () => {
      const req = {
        params: { id: "123" },
        body: { name: "  Benjamin ", email: " TEST@MAIL.COM ", phone: " 0788 " },
      };
      const res = mockRes();

      const updatedUser = { _id: "123", name: "Benjamin", email: "test@mail.com", phone: "0788" };
      const select = jest.fn().mockResolvedValue(updatedUser);

      User.findByIdAndUpdate.mockReturnValue({ select });

      await updateUser(req, res);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        "123",
        {
          name: "Benjamin",
          email: "test@mail.com",
          phone: "0788",
        },
        {
          new: true,
          runValidators: true,
        }
      );

      expect(res.json).toHaveBeenCalledWith(updatedUser);
    });

    it("should return 404 if user not found", async () => {
      const req = { params: { id: "123" }, body: { name: "Ben" } };
      const res = mockRes();

      const select = jest.fn().mockResolvedValue(null);
      User.findByIdAndUpdate.mockReturnValue({ select });

      await updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "User not found" });
    });

    it("should return 409 for duplicate error", async () => {
      const req = { params: { id: "123" }, body: { email: "dup@test.com" } };
      const res = mockRes();

      const err = new Error("duplicate");
      err.code = 11000;

      const select = jest.fn().mockRejectedValue(err);
      User.findByIdAndUpdate.mockReturnValue({ select });

      await updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: "Duplicate field already exists",
      });
    });

    it("should return 400 for invalid request", async () => {
      const req = { params: { id: "123" }, body: { email: "bad" } };
      const res = mockRes();

      const select = jest.fn().mockRejectedValue(new Error("Validation failed"));
      User.findByIdAndUpdate.mockReturnValue({ select });

      await updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid request",
        error: "Validation failed",
      });
    });
  });

  describe("updateUserRole", () => {
    it("should reject invalid role", async () => {
      const req = { params: { id: "123" }, body: { role: "lawyer" } };
      const res = mockRes();

      await updateUserRole(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'role must be "admin" or "user"',
      });
    });

    it("should update user role", async () => {
      const req = { params: { id: "123" }, body: { role: "admin" } };
      const res = mockRes();

      const updatedUser = { _id: "123", role: "admin" };
      const select = jest.fn().mockResolvedValue(updatedUser);

      User.findByIdAndUpdate.mockReturnValue({ select });

      await updateUserRole(req, res);

      expect(res.json).toHaveBeenCalledWith(updatedUser);
    });

    it("should return 404 if user not found", async () => {
      const req = { params: { id: "123" }, body: { role: "user" } };
      const res = mockRes();

      const select = jest.fn().mockResolvedValue(null);
      User.findByIdAndUpdate.mockReturnValue({ select });

      await updateUserRole(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "User not found" });
    });

    it("should return 400 on error", async () => {
      const req = { params: { id: "123" }, body: { role: "admin" } };
      const res = mockRes();

      const select = jest.fn().mockRejectedValue(new Error("Bad request"));
      User.findByIdAndUpdate.mockReturnValue({ select });

      await updateUserRole(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid request",
        error: "Bad request",
      });
    });
  });

  describe("deleteUser", () => {
    it("should delete a user", async () => {
      const req = { params: { id: "123" } };
      const res = mockRes();

      const deletedUser = { _id: "123", name: "Ben" };
      const select = jest.fn().mockResolvedValue(deletedUser);

      User.findByIdAndDelete.mockReturnValue({ select });

      await deleteUser(req, res);

      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        message: "User deleted",
        user: deletedUser,
      });
    });

    it("should return 404 if user not found", async () => {
      const req = { params: { id: "123" } };
      const res = mockRes();

      const select = jest.fn().mockResolvedValue(null);
      User.findByIdAndDelete.mockReturnValue({ select });

      await deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "User not found" });
    });

    it("should return 400 on invalid id", async () => {
      const req = { params: { id: "bad-id" } };
      const res = mockRes();

      const select = jest.fn().mockRejectedValue(new Error("Cast failed"));
      User.findByIdAndDelete.mockReturnValue({ select });

      await deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid user id",
        error: "Cast failed",
      });
    });
  });
});