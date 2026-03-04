/**
 * Permission Middleware (RBAC Enforcement)
 *
 * This middleware enforces Role-Based Access Control (RBAC).
 * It checks whether the currently authenticated user's role
 * contains the required permission before allowing access to a route.
 *
 * How it works:
 * 1. Retrieve the user's role from the database (using role ID from JWT)
 * 2. Populate the role's permissions array with full Permission documents
 * 3. Check if the required permission name exists in the role's permissions
 * 4. Grant or deny access accordingly
 *
 * Usage:
 *   router.get("/users", protect, checkPermission("manage_users"), handler)
 *
 * This middleware must always be used AFTER the `protect` middleware,
 * since it relies on req.user being set by authMiddleware.
 */

const Role = require("../models/Role");

/**
 * checkPermission factory function
 *
 * Returns an Express middleware that verifies the logged-in user
 * has a specific permission via their assigned role.
 *
 * @param {string} requiredPermission - The permission name to check (e.g., "manage_users")
 * @returns {Function} Express middleware function
 */
const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      // req.user is set by the protect (authMiddleware) middleware
      if (!req.user || !req.user.role) {
        return res.status(403).json({
          success: false,
          message: "Access denied. No role assigned to this user.",
        });
      }

      // Fetch the user's role from DB and populate its permissions
      // This gives us the full Permission documents (with `name` field)
      const role = await Role.findById(req.user.role).populate("permissions");

      if (!role) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Role not found.",
        });
      }

      // Check if the required permission exists in the role's permissions array
      // We compare the `name` field of each populated Permission document
      const hasPermission = role.permissions.some(
        (permission) => permission.name === requiredPermission
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required permission: "${requiredPermission}" not found in your role.`,
        });
      }

      // Permission verified — attach role info and proceed
      req.userRole = role;
      next();
    } catch (error) {
      console.error("Permission Middleware Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error during permission check.",
      });
    }
  };
};

/**
 * checkAnyPermission factory function
 *
 * Returns Express middleware that grants access if the user has AT LEAST ONE
 * of the supplied permissions (OR logic). Useful for read endpoints shared
 * between multiple roles (e.g. view_users OR manage_users).
 *
 * @param {...string} permissions - One or more permission names
 * @returns {Function} Express middleware
 */
const checkAnyPermission = (...permissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.role) {
        return res.status(403).json({
          success: false,
          message: "Access denied. No role assigned to this user.",
        });
      }

      const role = await Role.findById(req.user.role).populate("permissions");

      if (!role) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Role not found.",
        });
      }

      const rolePermNames = role.permissions.map((p) => p.name);
      const hasAny = permissions.some((p) => rolePermNames.includes(p));

      if (!hasAny) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Requires one of: ${permissions.join(", ")}.`,
        });
      }

      req.userRole = role;
      next();
    } catch (error) {
      console.error("Permission Middleware Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error during permission check.",
      });
    }
  };
};

module.exports = { checkPermission, checkAnyPermission };
