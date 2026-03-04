/**
 * User Routes
 *
 * All routes require:
 * 1. A valid JWT (enforced by `protect` middleware)
 * 2. Session validity check (enforced by `trackSession` middleware)
 * 3. The "manage_users" permission in the user's role (enforced by `checkPermission`)
 *
 * Routes:
 *   GET    /users              → Get all users
 *   GET    /users/:id          → Get a user by ID
 *   POST   /users              → Create a new user
 *   PUT    /users/:id          → Update a user
 *   PUT    /users/:id/disable  → Disable account + revoke all sessions
 *   PUT    /users/:id/enable   → Re-enable a disabled account
 *   DELETE /users/:id          → Delete a user
 */

const express = require("express");
const router = express.Router();

const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  disableUser,
  enableUser,
} = require("../controllers/userController");

const { protect } = require("../middleware/authMiddleware");
const { trackSession } = require("../middleware/sessionMiddleware");
const { checkPermission, checkAnyPermission } = require("../middleware/permissionMiddleware");

// Read routes — accessible by Manager (view_users) AND Admin (manage_users)
const readAuth = [protect, trackSession, checkAnyPermission("view_users", "manage_users")];

// Write routes — Admin only (manage_users)
const writeAuth = [protect, trackSession, checkPermission("manage_users")];

router.get("/", ...readAuth, getAllUsers);
router.get("/:id", ...readAuth, getUserById);
router.post("/", ...writeAuth, createUser);
router.put("/:id/disable", ...writeAuth, disableUser);
router.put("/:id/enable", ...writeAuth, enableUser);
router.put("/:id", ...writeAuth, updateUser);
router.delete("/:id", ...writeAuth, deleteUser);

module.exports = router;
