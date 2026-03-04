/**
 * User Controller
 *
 * Handles CRUD operations for user management.
 * All routes in this controller require the "manage_users" permission
 * (enforced at the route level via permissionMiddleware).
 *
 * RBAC logic:
 * - Only users whose role contains "manage_users" can access these endpoints.
 * - Passwords are always excluded from responses.
 * - Role references are populated to return role names instead of raw ObjectIds.
 */

const User = require("../models/User");
const Role = require("../models/Role");
const bcrypt = require("bcryptjs");
const UserSession = require("../models/UserSession");
const { logAudit } = require("../utils/auditLogger");

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all users
// @route   GET /users
// @access  Private — requires "manage_users" permission
// ─────────────────────────────────────────────────────────────────────────────
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password") // Never return password hashes
      .populate("role", "name") // Return role name, not raw ObjectId
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("GetAllUsers Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching users.",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get a single user by ID
// @route   GET /users/:id
// @access  Private — requires "manage_users" permission
// ─────────────────────────────────────────────────────────────────────────────
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate({
        path: "role",
        populate: { path: "permissions", select: "name description" },
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("GetUserById Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching user.",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Create a new user
// @route   POST /users
// @access  Private — requires "manage_users" permission
// ─────────────────────────────────────────────────────────────────────────────
const createUser = async (req, res) => {
  try {
    const { name, email, password, roleId, roleName, isActive } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required.",
      });
    }

    // Check for duplicate email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists.",
      });
    }

    // Resolve role: accept roleName (e.g. "Manager") or roleId
    // Falls back to the default "User" role if neither is provided
    let resolvedRoleId = null;
    if (roleName) {
      const roleByName = await Role.findOne({ name: roleName });
      if (!roleByName) {
        return res.status(400).json({
          success: false,
          message: `Role "${roleName}" not found.`,
        });
      }
      resolvedRoleId = roleByName._id;
    } else if (roleId) {
      const roleExists = await Role.findById(roleId);
      if (!roleExists) {
        return res.status(400).json({
          success: false,
          message: "Invalid role ID provided.",
        });
      }
      resolvedRoleId = roleId;
    } else {
      // Default to "User" role when no role is specified
      const defaultRole = await Role.findOne({ name: "User" });
      if (defaultRole) resolvedRoleId = defaultRole._id;
    }

    const user = await User.create({
      name,
      email,
      password, // Hashed by User model pre-save hook
      role: resolvedRoleId,
      isActive: isActive !== undefined ? isActive : true,
    });

    const populatedUser = await User.findById(user._id)
      .select("-password")
      .populate("role", "name");

    await logAudit({
      userId: req.user.userId,
      action: "USER_CREATED",
      resource: "User",
      resourceId: user._id,
      req,
      metadata: { email, roleName: populatedUser.role?.name },
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully.",
      user: populatedUser,
    });
  } catch (error) {
    console.error("CreateUser Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error creating user.",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update a user by ID
// @route   PUT /users/:id
// @access  Private — requires "manage_users" permission
// ─────────────────────────────────────────────────────────────────────────────
const updateUser = async (req, res) => {
  try {
    const { name, email, password, roleId, isActive } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Check for email conflict with another user
    if (email && email !== user.email) {
      const emailTaken = await User.findOne({ email });
      if (emailTaken) {
        return res.status(409).json({
          success: false,
          message: "Email is already in use by another user.",
        });
      }
    }

    // Validate role if being updated
    if (roleId) {
      const roleExists = await Role.findById(roleId);
      if (!roleExists) {
        return res.status(400).json({
          success: false,
          message: "Invalid role ID provided.",
        });
      }
    }

    // Apply field updates
    if (name) user.name = name;
    if (email) user.email = email;
    if (roleId !== undefined) user.role = roleId;
    if (isActive !== undefined) user.isActive = isActive;

    // If a new password is provided, update it — pre-save hook will re-hash it
    if (password) {
      user.password = password;
    }

    await user.save();

    const updatedUser = await User.findById(user._id)
      .select("-password")
      .populate("role", "name");

    await logAudit({
      userId: req.user.userId,
      action: "USER_UPDATED",
      resource: "User",
      resourceId: user._id,
      req,
      metadata: { updatedFields: Object.keys(req.body) },
    });

    return res.status(200).json({
      success: true,
      message: "User updated successfully.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("UpdateUser Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error updating user.",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete a user by ID
// @route   DELETE /users/:id
// @access  Private — requires "manage_users" permission
// ─────────────────────────────────────────────────────────────────────────────
const deleteUser = async (req, res) => {
  try {
    // Prevent admins from deleting themselves
    if (req.params.id === req.user.userId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account.",
      });
    }

    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    await logAudit({
      userId: req.user.userId,
      action: "USER_DELETED",
      resource: "User",
      resourceId: user._id,
      req,
      metadata: { deletedEmail: user.email },
    });

    return res.status(200).json({
      success: true,
      message: `User "${user.name}" deleted successfully.`,
    });
  } catch (error) {
    console.error("DeleteUser Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error deleting user.",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Disable a user account (sets isActive: false + revokes all sessions)
// @route   PUT /users/:id/disable
// @access  Private — requires "manage_users" permission
// ─────────────────────────────────────────────────────────────────────────────
const disableUser = async (req, res) => {
  try {
    if (req.params.id === req.user.userId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot disable your own account.",
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (!user.isActive) {
      return res.status(400).json({
        success: false,
        message: "User is already disabled.",
      });
    }

    // Disable the account
    user.isActive = false;
    await user.save();

    // Revoke ALL sessions for this user — forces immediate logout on all devices
    const result = await UserSession.updateMany(
      { user: user._id, isActive: true },
      { isActive: false }
    );

    await logAudit({
      userId: req.user.userId,
      action: "USER_DISABLED",
      resource: "User",
      resourceId: user._id,
      req,
      metadata: { targetEmail: user.email, sessionsRevoked: result.modifiedCount },
    });

    return res.status(200).json({
      success: true,
      message: `User "${user.name}" has been disabled. ${result.modifiedCount} session(s) revoked.`,
    });
  } catch (error) {
    console.error("DisableUser Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error disabling user.",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Enable a disabled user account (sets isActive: true)
// @route   PUT /users/:id/enable
// @access  Private — requires "manage_users" permission
// ─────────────────────────────────────────────────────────────────────────────
const enableUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (user.isActive) {
      return res.status(400).json({
        success: false,
        message: "User is already active.",
      });
    }

    user.isActive = true;
    await user.save();

    await logAudit({
      userId: req.user.userId,
      action: "USER_ENABLED",
      resource: "User",
      resourceId: user._id,
      req,
      metadata: { targetEmail: user.email },
    });

    return res.status(200).json({
      success: true,
      message: `User "${user.name}" has been enabled. They can now log in.`,
    });
  } catch (error) {
    console.error("EnableUser Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error enabling user.",
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  disableUser,
  enableUser,
};
