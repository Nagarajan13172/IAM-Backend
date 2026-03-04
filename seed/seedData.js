/**
 * Seed Script — Default Permissions, Roles, and Admin User
 *
 * Run with: npm run seed
 *
 * This script bootstraps the IAM database with:
 * 1. Default Permissions — atomic actions (manage_users, view_dashboard, etc.)
 * 2. Default Roles     — Admin, Manager, User (each with different permission sets)
 * 3. Default Admin     — admin@iam.com / admin123 (assigned the Admin role)
 *
 * RBAC Permission Matrix:
 * ┌─────────────────────┬───────┬─────────┬──────┐
 * │ Permission          │ Admin │ Manager │ User │
 * ├─────────────────────┼───────┼─────────┼──────┤
 * │ manage_users        │  ✅   │   ❌    │  ❌  │
 * │ view_users          │  ✅   │   ✅    │  ❌  │
 * │ create_users        │  ✅   │   ❌    │  ❌  │
 * │ delete_users        │  ✅   │   ❌    │  ❌  │
 * │ manage_roles        │  ✅   │   ❌    │  ❌  │
 * │ view_roles          │  ✅   │   ❌    │  ❌  │
 * │ manage_permissions  │  ✅   │   ❌    │  ❌  │
 * │ view_dashboard      │  ✅   │   ✅    │  ✅  │
 * └─────────────────────┴───────┴─────────┴──────┘
 *
 * IMPORTANT: This script is idempotent — running it multiple times will not
 * create duplicates. It uses findOneAndUpdate with upsert:true.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Permission = require("../models/Permission");
const Role = require("../models/Role");
const User = require("../models/User");

// ── Default Permissions ───────────────────────────────────────────────────────
const defaultPermissions = [
  { name: "manage_users",        description: "Full CRUD access to user management" },
  { name: "view_users",          description: "Read-only access to user list" },
  { name: "create_users",        description: "Ability to create new users" },
  { name: "delete_users",        description: "Ability to delete users" },
  { name: "manage_roles",        description: "Full CRUD access to role management" },
  { name: "view_roles",          description: "Read-only access to role list" },
  { name: "manage_permissions",  description: "Full CRUD access to permission management" },
  { name: "view_dashboard",      description: "Access to the main dashboard" },
];

// ── Role → Permission Mapping ─────────────────────────────────────────────────
const rolePermissionMap = {
  Admin: [
    "manage_users",
    "view_users",
    "create_users",
    "delete_users",
    "manage_roles",
    "view_roles",
    "manage_permissions",
    "view_dashboard",
  ],
  Manager: ["view_users", "view_dashboard"],
  User: ["view_dashboard"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Seed Function
// ─────────────────────────────────────────────────────────────────────────────
const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB for seeding...\n");

    // ── Step 1: Seed Permissions ──────────────────────────────────────────────
    console.log("📋 Seeding permissions...");
    const permissionDocs = {};

    for (const perm of defaultPermissions) {
      const doc = await Permission.findOneAndUpdate(
        { name: perm.name },
        { $set: { description: perm.description } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      permissionDocs[perm.name] = doc;
      console.log(`   ✓ Permission: "${perm.name}"`);
    }

    // ── Step 2: Seed Roles ────────────────────────────────────────────────────
    console.log("\n🎭 Seeding roles...");
    const roleDocs = {};

    for (const [roleName, permNames] of Object.entries(rolePermissionMap)) {
      // Map permission names to their ObjectIds
      const permissionIds = permNames.map((name) => permissionDocs[name]._id);

      const role = await Role.findOneAndUpdate(
        { name: roleName },
        { $set: { permissions: permissionIds } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      roleDocs[roleName] = role;
      console.log(`   ✓ Role: "${roleName}" → [${permNames.join(", ")}]`);
    }

    // ── Step 3: Seed Default Admin User ───────────────────────────────────────
    console.log("\n👤 Seeding default admin user...");

    const adminEmail = "admin@iam.com";
    const adminPlainPassword = "admin123";

    const existingAdmin = await User.findOne({ email: adminEmail });

    if (!existingAdmin) {
      // Hash the password manually here since we're using User.create
      // (the pre-save hook will handle hashing automatically)
      await User.create({
        name: "Super Admin",
        email: adminEmail,
        password: adminPlainPassword, // Will be hashed by User model pre-save hook
        role: roleDocs["Admin"]._id,
        isActive: true,
      });
      console.log(`   ✓ Admin user created: ${adminEmail} / ${adminPlainPassword}`);
    } else {
      console.log(`   ℹ️  Admin user already exists: ${adminEmail} (skipped)`);
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log("\n🎉 Database seeding completed successfully!");
    console.log("─────────────────────────────────────────");
    console.log(`   Permissions : ${Object.keys(permissionDocs).length}`);
    console.log(`   Roles       : ${Object.keys(roleDocs).length}`);
    console.log(`   Admin Email : admin@iam.com`);
    console.log(`   Admin Pass  : admin123`);
    console.log("─────────────────────────────────────────\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error.message);
    process.exit(1);
  }
};

seedDatabase();
