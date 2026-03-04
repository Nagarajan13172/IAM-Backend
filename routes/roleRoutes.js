/**
 * Role Routes
 *
 * All routes require:
 * 1. A valid JWT (enforced by `protect` middleware)
 * 2. The "manage_roles" permission in the user's role (enforced by `checkPermission`)
 *
 * RBAC Flow:
 *   Request → protect (verify JWT) → checkPermission("manage_roles") → controller
 *
 * Routes:
 *   GET    /roles       → Get all roles (with populated permissions)
 *   POST   /roles       → Create a new role with multiple permissions
 *   PUT    /roles/:id   → Update a role's name or permissions
 *   DELETE /roles/:id   → Delete a role (blocked if users are assigned to it)
 */

const express = require("express");
const router = express.Router();

const {
  getAllRoles,
  createRole,
  updateRole,
  updateRoleByName,
  deleteRole,
} = require("../controllers/roleController");

const { protect } = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/permissionMiddleware");

// All role management routes require authentication + "manage_roles" permission
router.get("/", protect, checkPermission("manage_roles"), getAllRoles);
router.post("/", protect, checkPermission("manage_roles"), createRole);
// Update by name — must be declared before /:id to avoid route conflict
router.put("/name/:roleName", protect, checkPermission("manage_roles"), updateRoleByName);
router.put("/:id", protect, checkPermission("manage_roles"), updateRole);
router.delete("/:id", protect, checkPermission("manage_roles"), deleteRole);

module.exports = router;
