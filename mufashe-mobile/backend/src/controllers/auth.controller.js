// src/controllers/auth.controller.js

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const signToken = (user) =>
  jwt.sign(
    { id: user._id.toString(), role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

const isEmail = (value) => /\S+@\S+\.\S+/.test(value);
const normalizePhone = (p) => (p || "").trim().replace(/[\s-]/g, "");
const normalizeName = (n) => (n || "").trim();

/** POST /api/auth/register */
async function register(req, res) {
  try {
    let { name, email, phone, password } = req.body;

    name = normalizeName(name);
    email = email ? email.trim().toLowerCase() : undefined;
    phone = phone ? normalizePhone(phone) : undefined;

    if (!name || !password) {
      return res.status(400).json({ message: "name and password are required" });
    }

    if (!email && !phone) {
      return res.status(400).json({ message: "Provide at least one: email or phone" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    if (email) {
      const existsEmail = await User.findOne({ email });
      if (existsEmail) return res.status(409).json({ message: "Email already exists" });
    }

    if (phone) {
      const existsPhone = await User.findOne({ phone });
      if (existsPhone) return res.status(409).json({ message: "Phone already exists" });
    }

    const existsName = await User.findOne({ name });
    if (existsName) return res.status(409).json({ message: "Name already exists" });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({ name, email, phone, passwordHash });

    // optional auto-admin on register
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
    if (adminEmail && user.email && user.email === adminEmail) {
      user.role = "admin";
      await user.save();
    }

    const token = signToken(user);

    return res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email || null,
        phone: user.phone || null,
        role: user.role,
      },
    });
  } catch (err) {
    if (err?.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || "field";
      return res.status(409).json({ message: `${field} already exists` });
    }
    return res.status(500).json({ message: "Server error", error: err.message });
  }
}

/** POST /api/auth/login */
async function login(req, res) {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        message: "identifier (email, phone, or name) and password are required",
      });
    }

    const idRaw = String(identifier).trim();
    const idEmail = idRaw.toLowerCase();
    const idPhone = normalizePhone(idRaw);

    let query;
    if (isEmail(idRaw)) query = { email: idEmail };
    else if (/^\+?\d+$/.test(idPhone)) query = { phone: idPhone };
    else query = { name: idRaw };

    const user = await User.findOne(query);
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = signToken(user);

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email || null,
        phone: user.phone || null,
        role: user.role,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
}

/** GET /api/auth/me */
async function me(req, res) {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
}

/** POST /api/auth/bootstrap-admin */
async function bootstrapAdmin(req, res) {
  try {
    const { setupKey } = req.body;

    if (!setupKey || setupKey !== process.env.ADMIN_SETUP_KEY) {
      return res.status(403).json({ message: "Invalid setup key" });
    }

    const adminExists = await User.exists({ role: "admin" });
    if (adminExists) {
      return res.status(409).json({ message: "Admin already exists. Bootstrap disabled." });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.role = "admin";
    await user.save();

    return res.json({
      ok: true,
      message: "Bootstrap successful. You are now admin.",
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
}

module.exports = { register, login, me, bootstrapAdmin };
