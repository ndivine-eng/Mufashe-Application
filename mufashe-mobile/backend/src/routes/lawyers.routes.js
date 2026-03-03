// backend/src/routes/lawyers.routes.js
const router = require("express").Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const User = require("../models/User");

// ✅ Lawyer fetch own profile
router.get("/me", auth, requireRole("lawyer"), async (req, res) => {
  const me = await User.findById(req.user.id).select(
    "_id name email phone role isVerifiedLawyer lawyerStatus specialization location officeAddress bio yearsExperience licenseNumber languages feeMin feeMax feeNegotiable feeNote profileReviewStatus profileReviewNote"
  );
  if (!me) return res.status(404).json({ message: "User not found" });
  res.json({ user: me });
});

// ✅ Users fetch public lawyers (only approved profiles)
router.get("/", auth, async (req, res) => {
  const q = String(req.query.q || "").trim();

  const filter = {
    role: "lawyer",
    isVerifiedLawyer: true,
    profileReviewStatus: "APPROVED",
    specialization: { $ne: "" },
    location: { $ne: "" },
    bio: { $ne: "" },
  };

  if (q) {
    filter.$or = [
      { name: new RegExp(q, "i") },
      { specialization: new RegExp(q, "i") },
      { location: new RegExp(q, "i") },
    ];
  }

  const items = await User.find(filter)
    .select(
      "_id name lawyerStatus specialization location officeAddress bio yearsExperience languages feeMin feeMax feeNegotiable feeNote"
    )
    .sort({ createdAt: -1 })
    .limit(100);

  res.json({ items });
});

// ✅ Lawyer details (approved only)
router.get("/:id", auth, async (req, res) => {
  const lawyer = await User.findOne({
    _id: req.params.id,
    role: "lawyer",
    isVerifiedLawyer: true,
    profileReviewStatus: "APPROVED",
  }).select(
    "_id name lawyerStatus specialization location officeAddress bio yearsExperience languages feeMin feeMax feeNegotiable feeNote"
  );

  if (!lawyer) return res.status(404).json({ message: "Lawyer not found" });
  res.json({ item: lawyer });
});

// ✅ Lawyer updates own profile (goes to PENDING for admin review)
router.patch("/me", auth, requireRole("lawyer"), async (req, res) => {
  const updates = {
    lawyerStatus: String(req.body?.lawyerStatus || "OFFLINE").toUpperCase(),

    specialization: String(req.body?.specialization || "").trim(),
    location: String(req.body?.location || "").trim(),
    officeAddress: String(req.body?.officeAddress || "").trim(),
    bio: String(req.body?.bio || "").trim(),

    yearsExperience: Number(req.body?.yearsExperience || 0),
    licenseNumber: String(req.body?.licenseNumber || "").trim(),

    languages: Array.isArray(req.body?.languages) ? req.body.languages.map((x) => String(x).trim()).filter(Boolean) : [],

    feeMin: Number(req.body?.feeMin || 0),
    feeMax: Number(req.body?.feeMax || 0),
    feeNegotiable: Boolean(req.body?.feeNegotiable),
    feeNote: String(req.body?.feeNote || "").trim(),

    // ✅ mark as pending review on every update
    profileReviewStatus: "PENDING",
    profileReviewNote: "",
    profileReviewedAt: null,
    profileReviewedBy: null,
    profileUpdatedAt: new Date(),
  };

  const allowedStatus = ["AVAILABLE", "BUSY", "OFFLINE"];
  if (!allowedStatus.includes(updates.lawyerStatus)) updates.lawyerStatus = "OFFLINE";

  if (updates.feeMin < 0) updates.feeMin = 0;
  if (updates.feeMax < 0) updates.feeMax = 0;
  if (updates.feeMax > 0 && updates.feeMin > updates.feeMax) {
    return res.status(400).json({ message: "feeMin cannot be greater than feeMax" });
  }
  if (updates.yearsExperience < 0) updates.yearsExperience = 0;

  // optional: force OFFLINE if incomplete
  const complete = updates.specialization && updates.location && updates.bio.length >= 20;
  if (!complete) updates.lawyerStatus = "OFFLINE";

  const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select(
    "_id name role isVerifiedLawyer lawyerStatus specialization location officeAddress bio yearsExperience licenseNumber languages feeMin feeMax feeNegotiable feeNote profileReviewStatus profileReviewNote"
  );

  res.json({ user });
});

module.exports = router;