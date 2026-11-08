const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: "128kb" }));

// Routes
const authRoutes = require("./routes/auth");
app.use("/", authRoutes);

// Health endpoint for deployment checks.
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Serve the production React build from the same origin as the API.
const buildDir = path.join(__dirname, "build");
app.use(express.static(buildDir));
app.get("/{*path}", (req, res, next) => {
  if (path.extname(req.path)) return res.status(404).send("Not found");
  res.sendFile(path.join(buildDir, "index.html"), err => { if (err) next(err); });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
