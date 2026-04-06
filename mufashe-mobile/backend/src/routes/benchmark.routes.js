// src/routes/benchmark.routes.js
// This route defines the endpoints for retrieving benchmark data related to the question-answering system. It allows clients to fetch detailed benchmark records and summary statistics for performance analysis.

const express = require("express");
const router = express.Router();

const {
  getBenchmarks,
  getBenchmarkSummary,
} = require("../controllers/benchmark.controller");

router.get("/", getBenchmarks);
router.get("/summary", getBenchmarkSummary);

module.exports = router;