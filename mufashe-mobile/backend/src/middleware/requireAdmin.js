// middleware/requireAdmin.js

module.exports = function requireAdmin(req, res, next) {
  try {
    // Make sure auth middleware already ran
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    // Check role from JWT (set in auth middleware)
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Access denied. Admins only.",
      });
    }

    return next();
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
    });
  }
};
