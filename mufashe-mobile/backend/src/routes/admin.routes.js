// backend/src/routes/admin.routes.js
const router = require("express").Router();
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const User = require("../models/User");

// ✅ Approve user as lawyer (role + verified)
router.patch("/users/:id/role", auth, requireAdmin, async (req, res) => {
  const role = String(req.body?.role || "").toLowerCase();
  const allowed = ["user", "lawyer", "admin"];
  if (!allowed.includes(role)) return res.status(400).json({ message: "Invalid role" });

  if (String(req.user.id) === String(req.params.id) && role !== "admin") {
    return res.status(400).json({ message: "You cannot change your own admin role." });
  }

  const updates = { role };
  if (role === "lawyer") updates.isVerifiedLawyer = true;
  if (role !== "lawyer") updates.isVerifiedLawyer = false;

  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select(
    "_id name email role isVerifiedLawyer profileReviewStatus"
  );

  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ user });
});

// ✅ Admin views pending lawyer profiles
router.get("/lawyer-profiles", auth, requireAdmin, async (req, res) => {
  const status = String(req.query.status || "PENDING").toUpperCase();

  const items = await User.find({
    role: "lawyer",
    isVerifiedLawyer: true,
    profileReviewStatus: status,
  })
    .select("_id name email lawyerStatus specialization location officeAddress bio yearsExperience licenseNumber languages feeMin feeMax feeNegotiable feeNote profileReviewStatus profileUpdatedAt")
    .sort({ profileUpdatedAt: -1 })
    .limit(200);

  res.json({ items });
});

// ✅ Admin approves/rejects a lawyer profile
router.patch("/lawyer-profiles/:id", auth, requireAdmin, async (req, res) => {
  const status = String(req.body?.status || "").toUpperCase();
  const note = String(req.body?.note || "").trim();

  if (!["APPROVED", "REJECTED"].includes(status)) {
    return res.status(400).json({ message: "status must be APPROVED or REJECTED" });
  }

  const user = await User.findOneAndUpdate(
    { _id: req.params.id, role: "lawyer", isVerifiedLawyer: true },
    {
      profileReviewStatus: status,
      profileReviewNote: note,
      profileReviewedAt: new Date(),
      profileReviewedBy: req.user.id,
    },
    { new: true }
  ).select("_id name email profileReviewStatus profileReviewNote");

  if (!user) return res.status(404).json({ message: "Lawyer not found" });

  res.json({ user });
});

module.exports = router;