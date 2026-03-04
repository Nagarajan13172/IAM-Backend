/**
 * UserSession Model
 *
 * Tracks every active login session per user.
 * Enables:
 * - Multi-device session visibility ("You are logged in on 3 devices")
 * - Session revocation ("Log out all other devices")
 * - Admin session monitoring
 * - Forced logout when a user is disabled
 *
 * Each JWT issued on login has a corresponding session record.
 * Sessions can be deactivated without invalidating the JWT cryptographically
 * (the sessionMiddleware checks isActive on every request).
 */

const mongoose = require("mongoose");

const userSessionSchema = new mongoose.Schema(
  {
    // Reference to the authenticated user
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // The JWT token string issued at login
    // Used to look up and invalidate this specific session
    token: {
      type: String,
      required: true,
      unique: true,
    },

    // IP address of the client at login time
    ipAddress: {
      type: String,
      trim: true,
      default: null,
    },

    // User-Agent (browser/OS/device) at login time
    userAgent: {
      type: String,
      trim: true,
      default: null,
    },

    // When the session was created (login time)
    loginTime: {
      type: Date,
      default: Date.now,
    },

    // Updated on each authenticated request via sessionMiddleware
    lastActivity: {
      type: Date,
      default: Date.now,
    },

    // Set to false to revoke the session without deleting the record
    // Checked on every request by sessionMiddleware
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Compound index for fast lookup of active sessions per user
userSessionSchema.index({ user: 1, isActive: 1 });

module.exports = mongoose.model("UserSession", userSessionSchema);
