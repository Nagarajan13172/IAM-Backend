/**
 * Authentication Middleware
 *
 * Verifies the JWT token sent in the Authorization header.
 * If the token is valid, it decodes the payload and attaches
 * the user's basic info (userId, role) to req.user for downstream use.
 *
 * Usage: Apply this middleware to any protected route.
 * Example: router.get("/profile", protect, handler)
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * protect middleware
 *
 * Steps:
 * 1. Extract the Bearer token from the Authorization header
 * 2. Verify the token using JWT_SECRET
 * 3. Fetch the user from DB to confirm they still exist and are active
 * 4. Attach user info to req.user
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Extract token from "Authorization: Bearer <token>" header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    // Verify token signature and expiry using JWT_SECRET
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user from DB to ensure they still exist and are active
    // Password is excluded by default (select: false in schema)
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Token is invalid. User no longer exists.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Contact an administrator.",
      });
    }

    // Attach decoded user data to request object for use in downstream middleware/controllers
    req.user = {
      userId: decoded.userId,
      role: decoded.role,      // Role ID from JWT payload
      name: user.name,
      email: user.email,
    };

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token. Please log in again.",
      });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired. Please log in again.",
      });
    }

    console.error("Auth Middleware Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during authentication.",
    });
  }
};

module.exports = { protect };
