/**
 * AuditLog Model
 *
 * Records every significant IAM action for security auditing and compliance.
 * Audit logs are immutable — they are only ever created, never updated or deleted.
 *
 * Each log entry captures:
 * - WHO performed the action (user)
 * - WHAT action was performed (action)
 * - WHICH resource was affected (resource, resourceId)
 * - WHERE the request came from (ipAddress, userAgent)
 * - WHEN it happened (timestamp)
 *
 * Example actions:
 *   LOGIN_SUCCESS, LOGIN_FAILED, USER_CREATED, USER_UPDATED,
 *   USER_DELETED, USER_DISABLED, USER_ENABLED,
 *   ROLE_CREATED, ROLE_UPDATED, ROLE_DELETED,
 *   PERMISSION_CREATED, PERMISSION_DELETED,
 *   SESSION_REVOKED, SESSION_REVOKE_ALL
 */

const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    // The user who performed the action (null for unauthenticated actions like LOGIN_FAILED)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // The action performed — use uppercase snake_case constants
    action: {
      type: String,
      required: [true, "Action is required"],
      trim: true,
      uppercase: true,
    },

    // The type of resource affected (e.g., "User", "Role", "Permission", "Session")
    resource: {
      type: String,
      trim: true,
      default: null,
    },

    // The ID of the specific resource affected (flexible type: ObjectId or string)
    resourceId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // IP address of the client that made the request
    ipAddress: {
      type: String,
      trim: true,
      default: null,
    },

    // User-Agent string from the request headers (browser/device info)
    userAgent: {
      type: String,
      trim: true,
      default: null,
    },

    // Optional extra metadata (e.g., changed fields, error messages)
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Timestamp of the action — defaults to now
    timestamp: {
      type: Date,
      default: Date.now,
      index: true, // Index for efficient time-range queries
    },
  },
  {
    // No updatedAt — audit logs are immutable by design
    timestamps: false,
    versionKey: false,
  }
);

// Compound index for efficient queries by user + action + time
auditLogSchema.index({ user: 1, action: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
