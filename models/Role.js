/**
 * Role Model
 *
 * A Role groups multiple Permissions together and is assigned to Users.
 * This is the core of RBAC — instead of assigning permissions directly
 * to each user, permissions are bundled into a Role.
 *
 * Example:
 *   Role "Admin"   → [manage_users, manage_roles, manage_permissions, ...]
 *   Role "Manager" → [view_users, view_dashboard]
 *   Role "User"    → [view_dashboard]
 */

const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema(
  {
    // Role display name (e.g., "Admin", "Manager", "User")
    name: {
      type: String,
      required: [true, "Role name is required"],
      unique: true,
      trim: true,
    },

    // Array of Permission ObjectIds — supports multiple permissions per role
    // Populated via mongoose .populate("permissions") to get full permission docs
    permissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Permission", // Reference to the Permission collection
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Role", roleSchema);
