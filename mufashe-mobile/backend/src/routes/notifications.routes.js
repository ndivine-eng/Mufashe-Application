// backend/src/routes/notifications.routes.js
const router = require("express").Router();
const auth = require("../middleware/auth");
const Notification = require("../models/Notification");

router.get("/my", auth, async (req, res) => {
  const items = await Notification.find({ recipient: req.user.id }).sort({ createdAt: -1 }).limit(200);
  res.json({ items });
});

router.patch("/:id/read", auth, async (req, res) => {
  const n = await Notification.findOne({ _id: req.params.id, recipient: req.user.id });
  if (!n) return res.status(404).json({ message: "Notification not found" });

  if (!n.readAt) n.readAt = new Date();
  await n.save();

  res.json({ item: n });
});

module.exports = router;