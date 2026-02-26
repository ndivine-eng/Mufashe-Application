const jwt = require("jsonwebtoken");

module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || "";

  // Accept: "Bearer <token>"
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = header.slice(7).trim();
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // decoded now contains: { id, role, name, iat, exp }
    req.user = decoded;

    return next();
  } catch (err) {
    // helpful errors (optional)
    const msg =
      err.name === "TokenExpiredError"
        ? "Token expired"
        : "Invalid token";

    return res.status(401).json({ message: msg });
  }
};
