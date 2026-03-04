/**
 * Role Controller
 *
 * Handles CRUD operations for roles in the IAM system.
 *
 * Roles are the core of RBAC:
 * - Each role holds an array of Permission ObjectIds.
 * - Users are assigned a single role, which determines their permissions.
 *
 * When creating or updating a role, you can pass an array of permission IDs
 * to assign multiple permissions at once.
 */

const Role = require("../models/Role");
const Permission = require("../models/Permission");
const User = require("../models/User");
const { logAudit } = require("../utils/auditLogger");

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all roles with their permissions
// @route   GET /roles
// @access  Private — requires "manage_roles" or "view_roles" permission
// ─────────────────────────────────────────────────────────────────────────────
const getAllRoles = async (req, res) => {
  try {
    const roles = await Role.find()
      .populate("permissions", "name description") // Populate full permission docs
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: roles.length,
      roles,
    });
  } catch (error) {
    console.error("GetAllRoles Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching roles.",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Create a new role
// @route   POST /roles
// @access  Private — requires "manage_roles" permission
// ─────────────────────────────────────────────────────────────────────────────
const createRole = async (req, res) => {
  try {
    const { name, permissionIds, permissionNames } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Role name is required.",
      });
    }

    // Check for duplicate role name
    const existing = await Role.findOne({ name });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A role with the name "${name}" already exists.`,
      });
    }

    let resolvedIds = [];

    // Option A: permissionNames provided — resolve names → ObjectIds
    if (permissionNames && permissionNames.length > 0) {
      const normalized = permissionNames.map((n) => n.toLowerCase().trim());
      const permissions = await Permission.find({ name: { $in: normalized } });
      const foundNames = permissions.map((p) => p.name);
      const missing = normalized.filter((n) => !foundNames.includes(n));
      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          message: `The following permission names were not found: ${missing.join(", ")}`,
        });
      }
      resolvedIds = permissions.map((p) => p._id);
    }
    // Option B: permissionIds provided — validate they exist
    else if (permissionIds && permissionIds.length > 0) {
      const permissions = await Permission.find({ _id: { $in: permissionIds } });
      if (permissions.length !== permissionIds.length) {
        return res.status(400).json({
          success: false,
          message: "One or more permission IDs are invalid.",
        });
      }
      resolvedIds = permissionIds;
    }

    const role = await Role.create({
      name,
      permissions: resolvedIds,
    });

    const populatedRole = await Role.findById(role._id).populate(
      "permissions",
      "name description"
    );

    return res.status(201).json({
      success: true,
      message: "Role created successfully.",
      role: populatedRole,
    });
  } catch (error) {
    console.error("CreateRole Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error creating role.",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update a role (rename or change permissions)
// @route   PUT /roles/:id
// @access  Private — requires "manage_roles" permission
// ─────────────────────────────────────────────────────────────────────────────
const updateRole = async (req, res) => {
  try {
    const { name, permissionIds, permissionNames } = req.body;

    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found.",
      });
    }

    // Check for duplicate name (against other roles)
    if (name && name !== role.name) {
      const nameTaken = await Role.findOne({ name });
      if (nameTaken) {
        return res.status(409).json({
          success: false,
          message: `A role with the name "${name}" already exists.`,
        });
      }
    }

    // Resolve permissionNames → ObjectIds if provided
    if (permissionNames && permissionNames.length > 0) {
      const normalized = permissionNames.map((n) => n.toLowerCase().trim());
      const permissions = await Permission.find({ name: { $in: normalized } });
      const foundNames = permissions.map((p) => p.name);
      const missing = normalized.filter((n) => !foundNames.includes(n));
      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          message: `The following permission names were not found: ${missing.join(", ")}`,
        });
      }
      role.permissions = permissions.map((p) => p._id);
    }
    // Validate permissionIds if provided
    else if (permissionIds !== undefined) {
      if (permissionIds.length > 0) {
        const permissions = await Permission.find({ _id: { $in: permissionIds } });
        if (permissions.length !== permissionIds.length) {
          return res.status(400).json({
            success: false,
            message: "One or more permission IDs are invalid.",
          });
        }
      }
      role.permissions = permissionIds;
    }

    // Apply updates
    if (name) role.name = name;

    await role.save();

    const updatedRole = await Role.findById(role._id).populate(
      "permissions",
      "name description"
    );

    return res.status(200).json({
      success: true,
      message: "Role updated successfully.",
      role: updatedRole,
    });
  } catch (error) {
    console.error("UpdateRole Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error updating role.",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete a role by ID
// @route   DELETE /roles/:id
// @access  Private — requires "manage_roles" permission
// ─────────────────────────────────────────────────────────────────────────────
const deleteRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found.",
      });
    }

    // Prevent deletion if users are still assigned this role
    const usersWithRole = await User.countDocuments({ role: req.params.id });
    if (usersWithRole > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete role "${role.name}". It is assigned to ${usersWithRole} user(s). Reassign users first.`,
      });
    }

    await role.deleteOne();

    await logAudit({
      userId: req.user.userId,
      action: "ROLE_DELETED",
      resource: "Role",
      resourceId: role._id,
      req,
      metadata: { roleName: role.name },
    });

    return res.status(200).json({
      success: true,
      message: `Role "${role.name}" deleted successfully.`,
    });
  } catch (error) {
    console.error("DeleteRole Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error deleting role.",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update a role by name (e.g. "Admin", "Manager") — no ID needed
// @route   PUT /roles/name/:roleName
// @access  Private — requires "manage_roles" permission
// ─────────────────────────────────────────────────────────────────────────────
const updateRoleByName = async (req, res) => {
  try {
    const { permissionNames, permissionIds, name: newName } = req.body;
    const roleName = req.params.roleName;

    const role = await Role.findOne({ name: roleName });
    if (!role) {
      return res.status(404).json({
        success: false,
        message: `Role "${roleName}" not found.`,
      });
    }

    // Rename check
    if (newName && newName !== role.name) {
      const nameTaken = await Role.findOne({ name: newName });
      if (nameTaken) {
        return res.status(409).json({
          success: false,
          message: `A role with the name "${newName}" already exists.`,
        });
      }
      role.name = newName;
    }

    // Resolve permissionNames → ObjectIds
    if (permissionNames && permissionNames.length > 0) {
      const normalized = permissionNames.map((n) => n.toLowerCase().trim());
      const permissions = await Permission.find({ name: { $in: normalized } });
      const foundNames = permissions.map((p) => p.name);
      const missing = normalized.filter((n) => !foundNames.includes(n));
      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Permission names not found: ${missing.join(", ")}`,
        });
      }
      role.permissions = permissions.map((p) => p._id);
    } else if (permissionIds !== undefined) {
      role.permissions = permissionIds;
    }

    await role.save();

    const updatedRole = await Role.findById(role._id).populate(
      "permissions",
      "name description"
    );

    await logAudit({
      userId: req.user.userId,
      action: "ROLE_UPDATED",
      resource: "Role",
      resourceId: updatedRole._id,
      req,
      metadata: { roleName: updatedRole.name, permissions: updatedRole.permissions.map((p) => p.name) },
    });

    return res.status(200).json({
      success: true,
      message: `Role "${updatedRole.name}" updated successfully.`,
      role: updatedRole,
    });
  } catch (error) {
    console.error("UpdateRoleByName Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error updating role.",
    });
  }
};

module.exports = { getAllRoles, createRole, updateRole, updateRoleByName, deleteRole };
