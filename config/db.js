/**
 * Database Configuration
 * Establishes connection to MongoDB using Mongoose.
 * Uses the MONGO_URI from environment variables.
 */

const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Mongoose 8+ no longer needs useNewUrlParser / useUnifiedTopology
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1); // Exit process on connection failure
  }
};

module.exports = connectDB;
