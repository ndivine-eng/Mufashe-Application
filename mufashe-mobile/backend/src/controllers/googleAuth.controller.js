// controllers/googleAuth.controller.js
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: "idToken is required" });

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    // payload: { sub, email, name, picture, ... }
    const googleId = payload.sub;
    const email = payload.email?.toLowerCase();
    const nameFromGoogle = payload.name || "User";

    let user = await User.findOne({ googleId });

    if (!user && email) {
      // If user already exists with this email, attach googleId
      user = await User.findOne({ email });
    }

    if (!user) {
      // name must be unique in your schema, so make a safe unique name
      const base = nameFromGoogle.replace(/\s+/g, "").slice(0, 18) || "User";
      const uniqueName = `${base}_${googleId.slice(0, 6)}`;

      user = await User.create({
        name: uniqueName,
        email,
        googleId,
        authProvider: "google",
        // passwordHash remains undefined
      });
    } else {
      // ensure google fields are set
      user.googleId = user.googleId || googleId;
      user.authProvider = "google";
      if (!user.email && email) user.email = email;
      await user.save();
    }

    const token = signToken(user._id);

    return res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email || null, phone: user.phone || null },
    });
  } catch (err) {
    return res.status(401).json({ message: "Google login failed", error: err.message });
  }
};
