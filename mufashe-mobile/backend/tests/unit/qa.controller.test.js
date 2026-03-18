jest.mock("../../src/services/qa.service", () => ({
  answerQuestion: jest.fn(),
}));

jest.mock("../../src/models/Question", () => ({
  create: jest.fn(),
}));

const { answerQuestion } = require("../../src/services/qa.service");
const Question = require("../../src/models/Question");
const qaController = require("../../src/controllers/qa.controller");

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe("QA Controller - ask()", () => {
  const validUserId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should return 401 if user not authenticated", async () => {
    const req = {
      user: null,
      body: { question: "What is a contract?" },
    };
    const res = mockRes();

    await qaController.ask(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized" });
  });

  test("should return 400 for short question", async () => {
    const req = {
      user: { id: validUserId },
      body: { question: "hi" },
    };
    const res = mockRes();

    await qaController.ask(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Question is required" });
  });

  test("should return answer when successful", async () => {
    Question.create.mockResolvedValue({
      _id: "507f191e810c19729de860ea",
      owner: validUserId,
      question: "What is a contract?",
    });

    answerQuestion.mockResolvedValue({
      answer: "A contract is a legal agreement.",
      sources: [{ title: "Contract Law" }],
    });

    const req = {
      user: { id: validUserId },
      body: { question: "What is a contract?" },
    };
    const res = mockRes();

    await qaController.ask(req, res);

    expect(Question.create).toHaveBeenCalled();
    expect(answerQuestion).toHaveBeenCalled();

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        answer: "A contract is a legal agreement.",
      })
    );
  });

  test("should return 500 when service fails", async () => {
    Question.create.mockResolvedValue({
      _id: "507f191e810c19729de860ea",
      owner: validUserId,
      question: "What is a contract?",
    });

    answerQuestion.mockRejectedValue(new Error("Service failed"));

    const req = {
      user: { id: validUserId },
      body: { question: "What is a contract?" },
    };
    const res = mockRes();

    await qaController.ask(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Failed to answer",
      })
    );
  });
});