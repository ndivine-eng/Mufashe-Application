// backend/src/middleware/requireRole.js
module.exports = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });

  const userRole = String(req.user.role || "").toLowerCase();
  const allowed = roles.map((r) => String(r).toLowerCase());

  if (!allowed.includes(userRole)) {
    return res.status(403).json({ message: "Access denied" });
  }

  next();
};