const Benchmark = require("../models/benchmark.model");

async function saveBenchmark(data) {
  try {
    return await Benchmark.create(data);
  } catch (error) {
    console.error("Failed to save benchmark:", error.message);
    return null;
  }
}

async function getBenchmarkSummary() {
  const result = await Benchmark.aggregate([
    {
      $group: {
        _id: "$mode",
        totalTests: { $sum: 1 },
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
    {
      $sort: { _id: 1 },
    },
  ]);

  return result.map((item) => ({
    mode: item._id,
    totalTests: item.totalTests,
    avgRetrievalTimeMs: Number((item.avgRetrievalTimeMs || 0).toFixed(2)),
    avgGenerationTimeMs: Number((item.avgGenerationTimeMs || 0).toFixed(2)),
    avgTotalTimeMs: Number((item.avgTotalTimeMs || 0).toFixed(2)),
    avgSourcesCount: Number((item.avgSourcesCount || 0).toFixed(2)),
    avgTopScore: Number((item.avgTopScore || 0).toFixed(4)),
    successRate: Number(((item.successRate || 0) * 100).toFixed(2)),
  }));
}

async function getAllBenchmarks(limit = 50) {
  return Benchmark.find().sort({ createdAt: -1 }).limit(limit);
}

module.exports = {
  saveBenchmark,
  getBenchmarkSummary,
  getAllBenchmarks,
};