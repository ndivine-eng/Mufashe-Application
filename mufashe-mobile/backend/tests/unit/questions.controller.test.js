const {
  myRecent,
  myAll,
  getById,
  adminList,
  approve,
  reject,
} = require("../../src/controllers/questions.controller");

const Question = require("../../src/models/Question");

jest.mock("../../src/models/Question");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("questions.controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("myRecent", () => {
    it("should return unauthorized if no user", async () => {
      const req = { user: null, query: {} };
      const res = mockRes();

      await myRecent(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized" });
    });

    it("should return recent questions", async () => {
      const req = { user: { id: "u1" }, query: { limit: "3" } };
      const res = mockRes();

      const items = [{ _id: "q1", question: "What is law?" }];

      const selectMock = jest.fn().mockResolvedValue(items);
      const limitMock = jest.fn().mockReturnValue({ select: selectMock });
      const sortMock = jest.fn().mockReturnValue({ limit: limitMock });

      Question.find.mockReturnValue({ sort: sortMock });

      await myRecent(req, res);

      expect(Question.find).toHaveBeenCalledWith({ owner: "u1" });
      expect(res.json).toHaveBeenCalledWith({ items, total: 1 });
    });

    it("should cap limit at 20", async () => {
      const req = { user: { id: "u1" }, query: { limit: "50" } };
      const res = mockRes();

      const selectMock = jest.fn().mockResolvedValue([]);
      const limitMock = jest.fn().mockReturnValue({ select: selectMock });
      const sortMock = jest.fn().mockReturnValue({ limit: limitMock });

      Question.find.mockReturnValue({ sort: sortMock });

      await myRecent(req, res);

      expect(limitMock).toHaveBeenCalledWith(20);
    });

    it("should return 500 on error", async () => {
      const req = { user: { id: "u1" }, query: {} };
      const res = mockRes();

      Question.find.mockImplementation(() => {
        throw new Error("DB error");
      });

      await myRecent(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("myAll", () => {
    it("should return unauthorized if no user", async () => {
      const req = { user: null };
      const res = mockRes();

      await myAll(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return all questions for user", async () => {
      const req = { user: { _id: "u1" } };
      const res = mockRes();

      const items = [{ _id: "q1", question: "Question 1" }];
      const selectMock = jest.fn().mockResolvedValue(items);
      const sortMock = jest.fn().mockReturnValue({ select: selectMock });

      Question.find.mockReturnValue({ sort: sortMock });

      await myAll(req, res);

      expect(Question.find).toHaveBeenCalledWith({ owner: "u1" });
      expect(res.json).toHaveBeenCalledWith({ items, total: 1 });
    });

    it("should return 500 on error", async () => {
      const req = { user: { id: "u1" } };
      const res = mockRes();

      Question.find.mockImplementation(() => {
        throw new Error("DB error");
      });

      await myAll(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getById", () => {
    it("should return unauthorized if no user", async () => {
      const req = { user: null, params: { id: "q1" } };
      const res = mockRes();

      await getById(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 404 if question not found", async () => {
      const req = { user: { id: "u1", role: "user" }, params: { id: "q1" } };
      const res = mockRes();

      const populateMock = jest.fn().mockResolvedValue(null);
      Question.findById.mockReturnValue({ populate: populateMock });

      await getById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Question not found" });
    });

    it("should forbid access for non-owner non-admin", async () => {
      const req = { user: { id: "u1", role: "user" }, params: { id: "q1" } };
      const res = mockRes();

      const item = { _id: "q1", owner: { _id: "u2" } };
      const populateMock = jest.fn().mockResolvedValue(item);
      Question.findById.mockReturnValue({ populate: populateMock });

      await getById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Forbidden" });
    });

    it("should allow owner to access question", async () => {
      const req = { user: { id: "u1", role: "user" }, params: { id: "q1" } };
      const res = mockRes();

      const item = { _id: "q1", owner: { _id: "u1" } };
      const populateMock = jest.fn().mockResolvedValue(item);
      Question.findById.mockReturnValue({ populate: populateMock });

      await getById(req, res);

      expect(res.json).toHaveBeenCalledWith({ item });
    });

    it("should allow admin to access any question", async () => {
      const req = { user: { id: "admin1", role: "admin" }, params: { id: "q1" } };
      const res = mockRes();

      const item = { _id: "q1", owner: { _id: "u2" } };
      const populateMock = jest.fn().mockResolvedValue(item);
      Question.findById.mockReturnValue({ populate: populateMock });

      await getById(req, res);

      expect(res.json).toHaveBeenCalledWith({ item });
    });

    it("should return 400 on invalid id", async () => {
      const req = { user: { id: "u1", role: "user" }, params: { id: "bad" } };
      const res = mockRes();

      const populateMock = jest.fn().mockRejectedValue(new Error("Bad id"));
      Question.findById.mockReturnValue({ populate: populateMock });

      await getById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("adminList", () => {
    it("should return filtered admin list", async () => {
      const req = { query: { status: "approved", q: "land" } };
      const res = mockRes();

      const items = [{ _id: "q1", question: "land case" }];

      const selectMock = jest.fn().mockResolvedValue(items);
      const populateMock = jest.fn().mockReturnValue({ select: selectMock });
      const limitMock = jest.fn().mockReturnValue({ populate: populateMock });
      const sortMock = jest.fn().mockReturnValue({ limit: limitMock });

      Question.find.mockReturnValue({ sort: sortMock });

      await adminList(req, res);

      expect(Question.find).toHaveBeenCalledWith({
        status: "APPROVED",
        question: { $regex: "land", $options: "i" },
      });

      expect(res.json).toHaveBeenCalledWith({
        items,
        total: 1,
        filter: {
          status: "APPROVED",
          question: { $regex: "land", $options: "i" },
        },
      });
    });

    it("should return 500 on error", async () => {
      const req = { query: {} };
      const res = mockRes();

      Question.find.mockImplementation(() => {
        throw new Error("DB error");
      });

      await adminList(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("approve", () => {
    it("should approve question", async () => {
      const req = { user: { id: "admin1" }, params: { id: "q1" } };
      const res = mockRes();

      const item = { _id: "q1", status: "APPROVED" };
      Question.findByIdAndUpdate.mockResolvedValue(item);

      await approve(req, res);

      expect(Question.findByIdAndUpdate).toHaveBeenCalledWith(
        "q1",
        expect.objectContaining({
          status: "APPROVED",
          reviewedBy: "admin1",
          reviewNote: "",
        }),
        { new: true }
      );

      expect(res.json).toHaveBeenCalledWith({ ok: true, item });
    });

    it("should return 404 if question not found", async () => {
      const req = { user: { id: "admin1" }, params: { id: "q1" } };
      const res = mockRes();

      Question.findByIdAndUpdate.mockResolvedValue(null);

      await approve(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return 400 on error", async () => {
      const req = { user: { id: "admin1" }, params: { id: "q1" } };
      const res = mockRes();

      Question.findByIdAndUpdate.mockRejectedValue(new Error("Approve failed"));

      await approve(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("reject", () => {
    it("should reject question with note", async () => {
      const req = {
        user: { _id: "admin1" },
        params: { id: "q1" },
        body: { reviewNote: "Not enough detail" },
      };
      const res = mockRes();

      const item = { _id: "q1", status: "REJECTED", reviewNote: "Not enough detail" };
      Question.findByIdAndUpdate.mockResolvedValue(item);

      await reject(req, res);

      expect(Question.findByIdAndUpdate).toHaveBeenCalledWith(
        "q1",
        expect.objectContaining({
          status: "REJECTED",
          reviewedBy: "admin1",
          reviewNote: "Not enough detail",
        }),
        { new: true }
      );

      expect(res.json).toHaveBeenCalledWith({ ok: true, item });
    });

    it("should trim review note", async () => {
      const req = {
        user: { id: "admin1" },
        params: { id: "q1" },
        body: { reviewNote: "  bad content  " },
      };
      const res = mockRes();

      const item = { _id: "q1", status: "REJECTED" };
      Question.findByIdAndUpdate.mockResolvedValue(item);

      await reject(req, res);

      expect(Question.findByIdAndUpdate).toHaveBeenCalledWith(
        "q1",
        expect.objectContaining({
          reviewNote: "bad content",
        }),
        { new: true }
      );
    });

    it("should return 404 if question not found", async () => {
      const req = {
        user: { id: "admin1" },
        params: { id: "q1" },
        body: {},
      };
      const res = mockRes();

      Question.findByIdAndUpdate.mockResolvedValue(null);

      await reject(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return 400 on error", async () => {
      const req = {
        user: { id: "admin1" },
        params: { id: "q1" },
        body: {},
      };
      const res = mockRes();

      Question.findByIdAndUpdate.mockRejectedValue(new Error("Reject failed"));

      await reject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});