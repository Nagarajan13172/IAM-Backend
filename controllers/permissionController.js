/**
 * Permission Controller
 *
 * Handles CRUD operations for permissions in the IAM system.
 *
 * Permissions are the atomic units of access control.
 * They define WHAT actions can be performed (e.g., "manage_users", "view_dashboard").
 * Permissions are assigned to Roles, which are then assigned to Users.
 *
 * In a production system, permissions are typically created once during setup
 * and rarely modified — they reflect the application's feature set.
 */

const Permission = require("../models/Permission");
const Role = require("../models/Role");
const { logAudit } = require("../utils/auditLogger");

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all permissions
// @route   GET /permissions
// @access  Private — requires "manage_permissions" permission
// ─────────────────────────────────────────────────────────────────────────────
const getAllPermissions = async (req, res) => {
  try {
    const permissions = await Permission.find().sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: permissions.length,
      permissions,
    });
  } catch (error) {
    console.error("GetAllPermissions Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching permissions.",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Create a new permission
// @route   POST /permissions
// @access  Private — requires "manage_permissions" permission
// ─────────────────────────────────────────────────────────────────────────────
const createPermission = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Permission name is required.",
      });
    }

    // Permission names are stored lowercase for consistent comparison
    const normalizedName = name.toLowerCase().trim();

    const existing = await Permission.findOne({ name: normalizedName });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Permission "${normalizedName}" already exists.`,
      });
    }

    const permission = await Permission.create({
      name: normalizedName,
      description: description || "",
    });

    await logAudit({
      userId: req.user.userId,
      action: "PERMISSION_CREATED",
      resource: "Permission",
      resourceId: permission._id,
      req,
      metadata: { name: normalizedName },
    });

    return res.status(201).json({
      success: true,
      message: "Permission created successfully.",
      permission,
    });
  } catch (error) {
    console.error("CreatePermission Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error creating permission.",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete a permission by ID
// @route   DELETE /permissions/:id
// @access  Private — requires "manage_permissions" permission
// ─────────────────────────────────────────────────────────────────────────────
const deletePermission = async (req, res) => {
  try {
    const permission = await Permission.findById(req.params.id);

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Permission not found.",
      });
    }

    // Check if any roles currently use this permission before deleting
    const rolesUsingPermission = await Role.countDocuments({
      permissions: req.params.id,
    });

    if (rolesUsingPermission > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete permission "${permission.name}". It is used by ${rolesUsingPermission} role(s). Remove it from those roles first.`,
      });
    }

    await permission.deleteOne();

    await logAudit({
      userId: req.user.userId,
      action: "PERMISSION_DELETED",
      resource: "Permission",
      resourceId: permission._id,
      req,
      metadata: { name: permission.name },
    });

    return res.status(200).json({
      success: true,
      message: `Permission "${permission.name}" deleted successfully.`,
    });
  } catch (error) {
    console.error("DeletePermission Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error deleting permission.",
    });
  }
};

module.exports = { getAllPermissions, createPermission, deletePermission };
