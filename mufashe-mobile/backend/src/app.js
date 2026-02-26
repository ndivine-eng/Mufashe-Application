const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const consultRoutes = require("./routes/consultRoutes");
const resourcesRoutes = require("./routes/resources.routes");
const documentRoutes = require("./routes/document.routes");
const usersRoutes = require("./routes/users.routes");


const app = express();

app.use(cors());
app.use(express.json());

// routes
app.use("/api/auth", authRoutes);
app.use("/api/consult", consultRoutes);
app.use("/api/resources", resourcesRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/users", usersRoutes);


// ping (keep BEFORE export)
app.get("/api/ping", (req, res) => res.json({ ok: true, msg: "app.js is running" }));

module.exports = app;
