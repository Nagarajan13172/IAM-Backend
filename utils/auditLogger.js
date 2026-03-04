/**
 * Audit Logger Utility
 *
 * Provides a single reusable function to write audit log entries.
 * Automatically extracts IP address and User-Agent from the request object.
 *
 * Usage:
 *   await logAudit({
 *     userId: req.user.userId,   // null for unauthenticated actions
 *     action: "USER_CREATED",
 *     resource: "User",
 *     resourceId: newUser._id,
 *     req,                       // Express request object
 *     metadata: { email }        // Optional extra context
 *   });
 *
 * This function never throws — audit failures are logged to console
 * but must never break the main request flow.
 */

const AuditLog = require("../models/AuditLog");

/**
 * Extract the real client IP address from the request.
 * Handles proxies (X-Forwarded-For) and direct connections.
 *
 * @param {import("express").Request} req
 * @returns {string}
 */
const getIpAddress = (req) => {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    "unknown"
  );
};

/**
 * Write an audit log entry to the database.
 *
 * @param {Object} params
 * @param {string|null}  params.userId     - MongoDB ObjectId of the acting user (null if unauthenticated)
 * @param {string}       params.action     - Uppercase action constant (e.g. "USER_CREATED")
 * @param {string}       [params.resource] - Resource type affected (e.g. "User", "Role")
 * @param {*}            [params.resourceId] - ID of the affected resource
 * @param {import("express").Request} params.req - Express request (for IP + UA extraction)
 * @param {Object}       [params.metadata] - Optional extra info (e.g. changed fields)
 */
const logAudit = async ({
  userId = null,
  action,
  resource = null,
  resourceId = null,
  req,
  metadata = null,
}) => {
  try {
    await AuditLog.create({
      user: userId,
      action,
      resource,
      resourceId,
      ipAddress: req ? getIpAddress(req) : null,
      userAgent: req ? req.headers["user-agent"] || null : null,
      metadata,
      timestamp: new Date(),
    });
  } catch (err) {
    // Audit failures must NEVER crash the main request
    console.error(`⚠️  Audit log failed [${action}]:`, err.message);
  }
};

module.exports = { logAudit };
