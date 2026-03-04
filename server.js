/**
 * IAM Backend — Entry Point
 *
 * Initializes the Express application for the Identity Access Management system.
 *
 * Startup sequence:
 * 1. Load environment variables from .env
 * 2. Connect to MongoDB via Mongoose
 * 3. Initialize Express with middleware (JSON parsing, CORS)
 * 4. Register all API routes
 * 5. Start HTTP server on PORT (default: 5000)
 *
 * API Route Map:
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │ Auth        │ POST   /auth/register                                    │
 * │             │ POST   /auth/login                                       │
 * │             │ POST   /auth/logout       (protected)                    │
 * │             │ GET    /auth/me           (protected)                    │
 * ├─────────────┼────────────────────────────────────────────────────────-─┤
 * │ Users       │ GET    /users             (manage_users permission)      │
 * │             │ GET    /users/:id         (manage_users permission)      │
 * │             │ POST   /users             (manage_users permission)      │
 * │             │ PUT    /users/:id         (manage_users permission)      │
 * │             │ DELETE /users/:id         (manage_users permission)      │
 * ├─────────────┼────────────────────────────────────────────────────────-─┤
 * │ Roles       │ GET    /roles             (manage_roles permission)      │
 * │             │ POST   /roles             (manage_roles permission)      │
 * │             │ PUT    /roles/:id         (manage_roles permission)      │
 * │             │ DELETE /roles/:id         (manage_roles permission)      │
 * ├─────────────┼────────────────────────────────────────────────────────-─┤
 * │ Permissions │ GET    /permissions       (manage_permissions permission) │
 * │             │ POST   /permissions       (manage_permissions permission) │
 * │             │ DELETE /permissions/:id   (manage_permissions permission) │
 * └─────────────┴────────────────────────────────────────────────────────-─┘
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

// ── Import Routes ─────────────────────────────────────────────────────────────
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const roleRoutes = require("./routes/roleRoutes");
const permissionRoutes = require("./routes/permissionRoutes");
const sessionRoutes = require("./routes/sessionRoutes");

// ── Connect to MongoDB ────────────────────────────────────────────────────────
connectDB();

// ── Initialize Express App ────────────────────────────────────────────────────
const app = express();

// ── Global Middleware ─────────────────────────────────────────────────────────

// Enable Cross-Origin Resource Sharing for frontend clients
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "*", // Restrict in production
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Parse incoming JSON request bodies
app.use(express.json());

// Parse URL-encoded request bodies (form submissions)
app.use(express.urlencoded({ extended: true }));

// ── Health Check Route ────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "IAM Backend API is running 🚀",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: "/auth",
      users: "/users",
      roles: "/roles",
      permissions: "/permissions",
      sessions: "/sessions",
      admin: "/admin",
    },
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/auth", authRoutes);              // Authentication (register, login, logout)
app.use("/users", userRoutes);             // User management (RBAC: manage_users)
app.use("/roles", roleRoutes);             // Role management (RBAC: manage_roles)
app.use("/permissions", permissionRoutes); // Permission management (RBAC: manage_permissions)
app.use("/sessions", sessionRoutes);       // Session management (list, revoke)

// ── Admin Routes (inline — require manage_users permission) ───────────────────
const { protect } = require("./middleware/authMiddleware");
const { trackSession } = require("./middleware/sessionMiddleware");
const { checkPermission } = require("./middleware/permissionMiddleware");
const { getAllActiveSessions, getAuditLogs } = require("./controllers/sessionController");

app.get(
  "/admin/sessions",
  protect,
  trackSession,
  checkPermission("manage_users"),
  getAllActiveSessions
);

app.get(
  "/admin/audit-logs",
  protect,
  trackSession,
  checkPermission("manage_users"),
  getAuditLogs
);

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error.",
  });
});

// ── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\n🚀 IAM Backend Server started`);
  console.log(`   Environment : ${process.env.NODE_ENV || "development"}`);
  console.log(`   Port        : ${PORT}`);
  console.log(`   URL         : http://localhost:${PORT}`);
  console.log(`\n   Available routes:`);
  console.log(`   POST   http://localhost:${PORT}/auth/register`);
  console.log(`   POST   http://localhost:${PORT}/auth/login`);
  console.log(`   GET    http://localhost:${PORT}/auth/me`);
  console.log(`   GET    http://localhost:${PORT}/users`);
  console.log(`   GET    http://localhost:${PORT}/roles`);
  console.log(`   GET    http://localhost:${PORT}/permissions`);
  console.log(`   GET    http://localhost:${PORT}/sessions`);
  console.log(`   GET    http://localhost:${PORT}/admin/sessions`);
  console.log(`   GET    http://localhost:${PORT}/admin/audit-logs\n`);
});

module.exports = app;
