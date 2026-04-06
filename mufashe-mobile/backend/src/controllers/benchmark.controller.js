const Benchmark = require("../models/benchmark.model");

exports.getBenchmarks = async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 200));

    const data = await Benchmark.find()
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.status(200).json({
      count: data.length,
      data,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to fetch benchmarks",
      error: err.message,
    });
  }
};

exports.getBenchmarkSummary = async (req, res) => {
  try {
    const summary = await Benchmark.aggregate([
      {
        $group: {
          _id: null,
          totalQuestions: { $sum: 1 },
          avgRetrievalTimeMs: { $avg: "$retrievalTimeMs" },
          avgGenerationTimeMs: { $avg: "$generationTimeMs" },
          avgTotalTimeMs: { $avg: "$totalTimeMs" },
          avgSourcesCount: { $avg: "$sourcesCount" },
          avgTopScore: { $avg: "$topScore" },
          successRate: {
            $avg: {
              $cond: [{ $eq: ["$success", true] }, 1, 0],
            },
          },
        },
      },
    ]);

    const item = summary[0] || {};

    return res.status(200).json({
      totalQuestions: item.totalQuestions || 0,
      avgRetrievalTimeMs: Number((item.avgRetrievalTimeMs || 0).toFixed(2)),
      avgGenerationTimeMs: Number((item.avgGenerationTimeMs || 0).toFixed(2)),
      avgTotalTimeMs: Number((item.avgTotalTimeMs || 0).toFixed(2)),
      avgSourcesCount: Number((item.avgSourcesCount || 0).toFixed(2)),
      avgTopScore: Number((item.avgTopScore || 0).toFixed(4)),
      successRate: Number(((item.successRate || 0) * 100).toFixed(2)),
    });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to fetch benchmark summary",
      error: err.message,
    });
  }
};