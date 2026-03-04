/**
 * User Model
 *
 * Represents an authenticated user in the IAM system.
 * Each user is assigned a single Role which determines their permissions.
 *
 * Password is stored as a bcrypt hash — never in plain text.
 * The role reference is populated at query time to fetch permissions.
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    // Full name of the user
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },

    // Email is used as the unique login identifier
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },

    // Password stored as bcrypt hash — never stored in plain text
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Excluded from query results by default for security
    },

    // Reference to the Role assigned to this user
    // The role determines what permissions the user has (RBAC)
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role", // Reference to the Role collection
      default: null,
    },

    // Allows soft-disabling users without deleting their records
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

/**
 * Pre-save middleware: Hash password before saving to the database.
 * Only hashes if the password field has been modified (avoids re-hashing on other updates).
 */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
  this.password = await bcrypt.hash(this.password, saltRounds);
  next();
});

/**
 * Instance method: Compare a plain-text password against the stored hash.
 * Used during login to verify credentials.
 *
 * @param {string} candidatePassword - The plain-text password from the login request
 * @returns {Promise<boolean>} - True if passwords match, false otherwise
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
