// backend/src/routes/appointments.routes.js
const router = require("express").Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");

const Appointment = require("../models/Appointment");
const User = require("../models/User");
const Notification = require("../models/Notification");

// USER books appointment (PENDING)
router.post("/", auth, async (req, res) => {
  const { lawyerId, startsAt, durationMin, topic, caseDescription } = req.body || {};
  if (!lawyerId || !startsAt) return res.status(400).json({ message: "lawyerId and startsAt are required" });

  const lawyer = await User.findOne({ _id: lawyerId, role: "lawyer", isVerifiedLawyer: true }).select("_id");
  if (!lawyer) return res.status(404).json({ message: "Lawyer not found or not verified" });

  const dt = new Date(startsAt);
  if (Number.isNaN(dt.getTime())) return res.status(400).json({ message: "Invalid startsAt date" });

  const appt = await Appointment.create({
    user: req.user.id,
    lawyer: lawyerId,
    startsAt: dt,
    durationMin: Number(durationMin) || 30,
    topic: String(topic || "").trim(),
    caseDescription: String(caseDescription || "").trim(),
    status: "PENDING",
  });

  // notify lawyer
  await Notification.create({
    recipient: lawyerId,
    actor: req.user.id,
    type: "APPOINTMENT_REQUEST",
    title: "New appointment request",
    body: "A user requested an appointment.",
    data: { appointmentId: String(appt._id) },
  });

  res.status(201).json({ item: appt });
});

// USER or LAWYER views own appointments
router.get("/my", auth, async (req, res) => {
  const isLawyer = String(req.user.role || "").toLowerCase() === "lawyer";
  const filter = isLawyer ? { lawyer: req.user.id } : { user: req.user.id };

  const items = await Appointment.find(filter)
    .populate("user", "_id name email phone")
    .populate("lawyer", "_id name specialization location")
    .sort({ createdAt: -1 });

  res.json({ items });
});

// LAWYER approves
router.patch("/:id/approve", auth, requireRole("lawyer"), async (req, res) => {
  const appt = await Appointment.findById(req.params.id);
  if (!appt) return res.status(404).json({ message: "Appointment not found" });
  if (String(appt.lawyer) !== String(req.user.id)) return res.status(403).json({ message: "Not your appointment" });
  if (appt.status !== "PENDING") return res.status(400).json({ message: "Only PENDING can be approved" });

  appt.status = "APPROVED";
  appt.lawyerNote = String(req.body?.note || "").trim();
  await appt.save();

  // notify user
  await Notification.create({
    recipient: appt.user,
    actor: req.user.id,
    type: "APPOINTMENT_APPROVED",
    title: "Appointment approved",
    body: "Your appointment request was approved.",
    data: { appointmentId: String(appt._id) },
  });

  res.json({ item: appt });
});

// LAWYER rejects
router.patch("/:id/reject", auth, requireRole("lawyer"), async (req, res) => {
  const appt = await Appointment.findById(req.params.id);
  if (!appt) return res.status(404).json({ message: "Appointment not found" });
  if (String(appt.lawyer) !== String(req.user.id)) return res.status(403).json({ message: "Not your appointment" });
  if (appt.status !== "PENDING") return res.status(400).json({ message: "Only PENDING can be rejected" });

  appt.status = "REJECTED";
  appt.lawyerNote = String(req.body?.note || "").trim();
  await appt.save();

  // notify user
  await Notification.create({
    recipient: appt.user,
    actor: req.user.id,
    type: "APPOINTMENT_REJECTED",
    title: "Appointment rejected",
    body: "Your appointment request was rejected.",
    data: { appointmentId: String(appt._id) },
  });

  res.json({ item: appt });
});

module.exports = router;