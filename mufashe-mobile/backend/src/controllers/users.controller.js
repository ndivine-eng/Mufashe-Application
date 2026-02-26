// src/controllers/users.controller.js
const User = require("../models/User");

const safeUserSelect = "-passwordHash";

exports.listUsers = async (req, res) => {
  try {
    const { q, role, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (role) filter.role = role;

    if (q) {
      const query = String(q).trim();
      filter.$or = [
        { name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
        { phone: { $regex: query, $options: "i" } },
      ];
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const [items, total] = await Promise.all([
      User.find(filter)
        .select(safeUserSelect)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      User.countDocuments(filter),
    ]);

    return res.json({
      items,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(safeUserSelect);
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(user);
  } catch (err) {
    return res.status(400).json({ message: "Invalid user id", error: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    const update = {};
    if (name !== undefined) update.name = String(name).trim();
    if (email !== undefined) update.email = email ? String(email).trim().toLowerCase() : undefined;
    if (phone !== undefined) update.phone = phone ? String(phone).trim() : undefined;

    const user = await User.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).select(safeUserSelect);

    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(user);
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ message: "Duplicate field already exists" });
    return res.status(400).json({ message: "Invalid request", error: err.message });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;

    if (!role || !["admin", "user"].includes(role)) {
      return res.status(400).json({ message: 'role must be "admin" or "user"' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    ).select(safeUserSelect);

    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(user);
  } catch (err) {
    return res.status(400).json({ message: "Invalid request", error: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id).select(safeUserSelect);
    if (!deleted) return res.status(404).json({ message: "User not found" });
    return res.json({ ok: true, message: "User deleted", user: deleted });
  } catch (err) {
    return res.status(400).json({ message: "Invalid user id", error: err.message });
  }
};
