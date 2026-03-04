/**
 * Auth Routes
 *
 * Handles authentication-related endpoints.
 *
 * Public routes (no token required):
 *   POST /auth/register  → Register a new user
 *   POST /auth/login     → Login and receive a JWT
 *
 * Protected routes (valid JWT required):
 *   POST /auth/logout    → Logout (client-side token discard)
 *   GET  /auth/me        → Get current user's profile + permissions
 */

const express = require("express");
const router = express.Router();

const { register, login, logout, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

// ── Public Routes ─────────────────────────────────────────────────────────────
router.post("/register", register); // Create a new user account
router.post("/login", login);       // Authenticate and receive JWT token

// ── Protected Routes ─────────────────────────────────────────────────────────
router.post("/logout", protect, logout); // Logout — requires valid token
router.get("/me", protect, getMe);       // Get current user profile and permissions

module.exports = router;
