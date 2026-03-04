/**
 * Auth Controller
 *
 * Handles user registration, login, and logout.
 *
 * Enhanced with:
 * - Session creation on every login (UserSession record)
 * - Audit logging: LOGIN_SUCCESS, LOGIN_FAILED, USER_REGISTERED, LOGOUT
 * - Account disabled check (isActive: false → 403)
 * - Session revocation on logout
 *
 * JWT Flow:
 * 1. Register: Create user with hashed password → create session → return JWT
 * 2. Login:    Verify email + bcrypt password → create session → return JWT
 * 3. Logout:   Deactivate session record → client discards token
 *
 * JWT Payload contains: { userId, role }
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Role = require("../models/Role");
const UserSession = require("../models/UserSession");
const { logAudit } = require("../utils/auditLogger");

/**
 * Generate a signed JWT token for a given user.
 *
 * @param {string} userId  - MongoDB ObjectId of the user
 * @param {string} roleId  - MongoDB ObjectId of the user's role
 * @returns {string} Signed JWT token
 */
const generateToken = (userId, roleId) => {
  return jwt.sign(
    { userId, role: roleId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Register a new user
// @route   POST /auth/register
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required.",
      });
    }

    // Check if a user with this email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists.",
      });
    }

    // Self-registration always gets the "User" role — roleName is intentionally ignored
    const role = await Role.findOne({ name: "User" });

    if (!role) {
      return res.status(400).json({
        success: false,
        message: `Default "User" role not found. Please run the seed script first.`,
      });
    }

    // Create new user — password hashing is handled by the pre-save hook in User model
    const user = await User.create({
      name,
      email,
      password, // Will be hashed by User model's pre-save middleware
      role: role._id,
    });

    // Generate JWT with userId and roleId in payload
    const token = generateToken(user._id, user.role);

    // Create a session record for this registration
    await UserSession.create({
      user: user._id,
      token,
      ipAddress: req.headers["x-forwarded-for"]?.split(",")[0] || req.ip,
      userAgent: req.headers["user-agent"] || null,
    });

    // Audit log: new user registered
    await logAudit({
      userId: user._id,
      action: "USER_REGISTERED",
      resource: "User",
      resourceId: user._id,
      req,
      metadata: { email, role: role.name },
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: role.name,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during registration.",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Login user and return JWT
// @route   POST /auth/login
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    // Fetch user — explicitly select password since it's excluded by default (select: false)
    // Deeply populate role → permissions so we can return permission names in the response
    const user = await User.findOne({ email })
      .select("+password")
      .populate({ path: "role", populate: { path: "permissions", select: "name" } });

    if (!user) {
      // Audit: failed login — unknown email
      await logAudit({
        userId: null,
        action: "LOGIN_FAILED",
        resource: "User",
        resourceId: null,
        req,
        metadata: { email, reason: "User not found" },
      });
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Account disabled check — must happen before password verification
    if (!user.isActive) {
      await logAudit({
        userId: user._id,
        action: "LOGIN_FAILED",
        resource: "User",
        resourceId: user._id,
        req,
        metadata: { email, reason: "Account disabled" },
      });
      return res.status(403).json({
        success: false,
        message: "Your account has been disabled by an administrator.",
      });
    }

    // Compare provided password with stored bcrypt hash
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await logAudit({
        userId: user._id,
        action: "LOGIN_FAILED",
        resource: "User",
        resourceId: user._id,
        req,
        metadata: { email, reason: "Wrong password" },
      });
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Generate JWT with userId and roleId in payload
    // Guard: role may be null if not assigned or reference is broken
    if (!user.role) {
      return res.status(403).json({
        success: false,
        message: "Your account has no role assigned. Please contact an administrator.",
      });
    }

    const token = generateToken(user._id, user.role._id);

    // Create a new session record for this login
    await UserSession.create({
      user: user._id,
      token,
      ipAddress: req.headers["x-forwarded-for"]?.split(",")[0] || req.ip,
      userAgent: req.headers["user-agent"] || null,
    });

    // Audit log: successful login
    await logAudit({
      userId: user._id,
      action: "LOGIN_SUCCESS",
      resource: "User",
      resourceId: user._id,
      req,
      metadata: { email, role: user.role?.name },
    });

    const permissionNames = user.role?.permissions?.map((p) => p.name) ?? [];

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      permissions: permissionNames,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
          ? {
              _id: user.role._id,
              name: user.role.name,
              permissions: permissionNames,
            }
          : null,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during login.",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Logout — deactivate current session record
// @route   POST /auth/logout
// @access  Private (requires valid token)
// ─────────────────────────────────────────────────────────────────────────────
const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (token) {
      // Deactivate the session so future requests with this token are rejected
      await UserSession.findOneAndUpdate({ token }, { isActive: false });
    }

    await logAudit({
      userId: req.user?.userId,
      action: "LOGOUT",
      resource: "UserSession",
      resourceId: null,
      req,
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully. Session has been revoked.",
    });
  } catch (error) {
    console.error("Logout Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during logout.",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get currently authenticated user's profile
// @route   GET /auth/me
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate({
      path: "role",
      populate: { path: "permissions" }, // Nested populate to get permissions via role
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const permissionNames = user.role
      ? user.role.permissions.map((p) => p.name)
      : [];

    return res.status(200).json({
      success: true,
      permissions: permissionNames,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
          ? {
              _id: user.role._id,
              name: user.role.name,
              permissions: permissionNames,
            }
          : null,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("GetMe Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching user profile.",
    });
  }
};

module.exports = { register, login, logout, getMe };
