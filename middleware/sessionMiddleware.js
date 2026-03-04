/**
 * Session Middleware
 *
 * Enforces server-side session validity on every authenticated request.
 *
 * Why this is needed:
 * JWTs are stateless — a valid JWT can't be "revoked" cryptographically.
 * This middleware bridges that gap by checking a session record in the DB.
 * If the session has been revoked (isActive: false), the request is rejected
 * even if the JWT signature is still valid.
 *
 * This enables:
 * - Forced logout when admin disables a user
 * - Session revocation ("log out all other devices")
 * - Per-session activity tracking (lastActivity timestamp)
 *
 * IMPORTANT: Must be used AFTER the `protect` (authMiddleware) middleware,
 * since it relies on the token already being verified and req.user being set.
 *
 * Usage:
 *   router.get("/profile", protect, trackSession, handler)
 *
 * Or apply globally in server.js after auth routes:
 *   app.use(protect, trackSession)
 */

const UserSession = require("../models/UserSession");

/**
 * trackSession middleware
 *
 * Steps:
 * 1. Extract the raw JWT token from the Authorization header
 * 2. Find the matching session record in UserSession collection
 * 3. Reject if session doesn't exist or isActive is false
 * 4. Update lastActivity timestamp (non-blocking)
 * 5. Attach session info to req.session for downstream use
 */
const trackSession = async (req, res, next) => {
  try {
    // Re-extract the token (authMiddleware already verified it, we just need the string)
    const token =
      req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided.",
      });
    }

    // Look up the session by token
    const session = await UserSession.findOne({ token });

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Session not found. Please log in again.",
      });
    }

    // Check if session has been revoked by admin or by the user themselves
    if (!session.isActive) {
      return res.status(401).json({
        success: false,
        message: "Session has been revoked. Please log in again.",
      });
    }

    // Update lastActivity asynchronously — don't block the request
    UserSession.findByIdAndUpdate(session._id, {
      lastActivity: new Date(),
    }).catch((err) =>
      console.error("Failed to update session lastActivity:", err.message)
    );

    // Attach session to request for use in controllers (e.g., self-exclusion in revoke-all)
    req.session = session;

    next();
  } catch (error) {
    console.error("Session Middleware Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during session verification.",
    });
  }
};

module.exports = { trackSession };
