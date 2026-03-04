/**
 * Session Controller
 *
 * Manages user sessions for the IAM system.
 *
 * Provides:
 * - Current user's active sessions list (multi-device visibility)
 * - Terminate a specific session by ID
 * - Revoke all sessions except the current one ("log out other devices")
 * - Admin endpoint to view ALL active sessions across all users
 *
 * Session revocation works by setting isActive: false on the session record.
 * The sessionMiddleware checks this flag on every request, effectively
 * blocking the user even though their JWT may still be cryptographically valid.
 */

const UserSession = require("../models/UserSession");
const AuditLog = require("../models/AuditLog");
const { logAudit } = require("../utils/auditLogger");

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all active sessions for the currently logged-in user
// @route   GET /sessions
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getMySessions = async (req, res) => {
  try {
    const sessions = await UserSession.find({
      user: req.user.userId,
      isActive: true,
    })
      .select("-token") // Never expose raw JWT tokens in responses
      .sort({ loginTime: -1 });

    // Mark which session is the current one
    const sessionsWithCurrent = sessions.map((s) => ({
      ...s.toObject(),
      isCurrent: req.session && s._id.equals(req.session._id),
    }));

    return res.status(200).json({
      success: true,
      count: sessions.length,
      sessions: sessionsWithCurrent,
    });
  } catch (error) {
    console.error("GetMySessions Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching sessions.",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Terminate a specific session by session ID
// @route   DELETE /sessions/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const revokeSession = async (req, res) => {
  try {
    const session = await UserSession.findById(req.params.id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found.",
      });
    }

    // Users can only revoke their own sessions
    if (!session.user.equals(req.user.userId)) {
      return res.status(403).json({
        success: false,
        message: "You can only revoke your own sessions.",
      });
    }

    // Prevent revoking the current session through this endpoint
    // (use logout for that)
    if (req.session && session._id.equals(req.session._id)) {
      return res.status(400).json({
        success: false,
        message: "Cannot revoke your current session. Use /auth/logout instead.",
      });
    }

    // Deactivate the session
    session.isActive = false;
    await session.save();

    await logAudit({
      userId: req.user.userId,
      action: "SESSION_REVOKED",
      resource: "UserSession",
      resourceId: session._id,
      req,
      metadata: { revokedSessionIp: session.ipAddress },
    });

    return res.status(200).json({
      success: true,
      message: "Session revoked successfully.",
    });
  } catch (error) {
    console.error("RevokeSession Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error revoking session.",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Revoke all sessions except the current one
// @route   DELETE /sessions/revoke-all
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const revokeAllSessions = async (req, res) => {
  try {
    // Exclude the current session so the user stays logged in
    const currentSessionId = req.session ? req.session._id : null;

    const filter = {
      user: req.user.userId,
      isActive: true,
      ...(currentSessionId && { _id: { $ne: currentSessionId } }),
    };

    const result = await UserSession.updateMany(filter, { isActive: false });

    await logAudit({
      userId: req.user.userId,
      action: "SESSION_REVOKE_ALL",
      resource: "UserSession",
      resourceId: null,
      req,
      metadata: { revokedCount: result.modifiedCount },
    });

    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount} session(s) revoked. You remain logged in on the current device.`,
      revokedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("RevokeAllSessions Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error revoking sessions.",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    [ADMIN] Get all active sessions across all users
// @route   GET /admin/sessions
// @access  Private — requires "manage_users" permission
// ─────────────────────────────────────────────────────────────────────────────
const getAllActiveSessions = async (req, res) => {
  try {
    const sessions = await UserSession.find({ isActive: true })
      .select("-token") // Never expose raw JWT tokens
      .populate("user", "name email role")
      .sort({ lastActivity: -1 });

    return res.status(200).json({
      success: true,
      count: sessions.length,
      sessions,
    });
  } catch (error) {
    console.error("GetAllActiveSessions Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching all sessions.",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    [ADMIN] Get all audit logs with optional filters
// @route   GET /admin/audit-logs
// @access  Private — requires "manage_users" permission
// ─────────────────────────────────────────────────────────────────────────────
const getAuditLogs = async (req, res) => {
  try {
    const {
      userId,
      action,
      resource,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    // Build dynamic filter from query params
    const filter = {};
    if (userId) filter.user = userId;
    if (action) filter.action = action.toUpperCase();
    if (resource) filter.resource = resource;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate("user", "name email")
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AuditLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      logs,
    });
  } catch (error) {
    console.error("GetAuditLogs Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching audit logs.",
    });
  }
};

module.exports = {
  getMySessions,
  revokeSession,
  revokeAllSessions,
  getAllActiveSessions,
  getAuditLogs,
};
