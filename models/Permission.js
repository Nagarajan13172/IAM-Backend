/**
 * Permission Model
 *
 * Represents a single granular action that can be granted or denied.
 * Examples: "manage_users", "view_dashboard", "create_users"
 *
 * Permissions are assigned to Roles, and Roles are assigned to Users.
 * This forms the foundation of the RBAC (Role-Based Access Control) system.
 */

const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema(
  {
    // Unique identifier name for the permission (e.g., "manage_users")
    name: {
      type: String,
      required: [true, "Permission name is required"],
      unique: true,
      trim: true,
      lowercase: true,
    },

    // Human-readable description of what this permission allows
    description: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields automatically
  }
);

module.exports = mongoose.model("Permission", permissionSchema);
