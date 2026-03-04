/**
 * Permission Routes
 *
 * All routes require:
 * 1. A valid JWT (enforced by `protect` middleware)
 * 2. The "manage_permissions" permission in the user's role (enforced by `checkPermission`)
 *
 * RBAC Flow:
 *   Request → protect (verify JWT) → checkPermission("manage_permissions") → controller
 *
 * Routes:
 *   GET    /permissions       → Get all permissions
 *   POST   /permissions       → Create a new permission
 *   DELETE /permissions/:id   → Delete a permission (blocked if used by roles)
 */

const express = require("express");
const router = express.Router();

const {
  getAllPermissions,
  createPermission,
  deletePermission,
} = require("../controllers/permissionController");

const { protect } = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/permissionMiddleware");

// All permission management routes require authentication + "manage_permissions" permission
router.get("/", protect, checkPermission("manage_permissions"), getAllPermissions);
router.post("/", protect, checkPermission("manage_permissions"), createPermission);
router.delete("/:id", protect, checkPermission("manage_permissions"), deletePermission);

module.exports = router;
