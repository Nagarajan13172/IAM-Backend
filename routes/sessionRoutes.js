/**
 * Session Routes
 *
 * All routes require JWT authentication (protect middleware).
 * Session tracking (trackSession) is applied so each request
 * validates the session is still active.
 *
 * User routes:
 *   GET    /sessions             → List current user's active sessions
 *   DELETE /sessions/revoke-all  → Revoke all sessions except current
 *   DELETE /sessions/:id         → Revoke a specific session
 *
 * Admin routes (require manage_users permission):
 *   GET    /admin/sessions       → All active sessions across all users
 *   GET    /admin/audit-logs     → Paginated audit log with filters
 */

const express = require("express");
const router = express.Router();

const {
  getMySessions,
  revokeSession,
  revokeAllSessions,
  getAllActiveSessions,
  getAuditLogs,
} = require("../controllers/sessionController");

const { protect } = require("../middleware/authMiddleware");
const { trackSession } = require("../middleware/sessionMiddleware");
const { checkPermission } = require("../middleware/permissionMiddleware");

// ── User Session Routes ───────────────────────────────────────────────────────

// Get all active sessions for the logged-in user
router.get("/", protect, trackSession, getMySessions);

// Revoke all OTHER sessions (keep current) — must be before /:id to avoid conflict
router.delete("/revoke-all", protect, trackSession, revokeAllSessions);

// Revoke a specific session by ID
router.delete("/:id", protect, trackSession, revokeSession);

module.exports = router;
