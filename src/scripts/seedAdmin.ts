/**
 * Seed script — creates the first admin user.
 * Run once:  npx ts-node src/scripts/seedAdmin.ts
 */
import mongoose from "mongoose";
import { User } from "../models/User";
import { UserRole } from "../types";
import { env } from "../config/env";

const ADMIN_EMAIL = "admin@za2zoo2a.com";
const ADMIN_PASSWORD = "Admin@123456"; // change after first login
const ADMIN_NAME = "System Admin";
const ADMIN_PHONE = "+201000000000";

async function seed() {
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log("✅  Connected to MongoDB");

    const existing = await User.findOne({ email: ADMIN_EMAIL });
    if (existing) {
      console.log("⚠️  Admin user already exists:", existing.email);
      process.exit(0);
    }

    const admin = await User.create({
      fullName: ADMIN_NAME,
      email: ADMIN_EMAIL,
      phone: ADMIN_PHONE,
      password: ADMIN_PASSWORD,
      role: UserRole.ADMIN,
      isVerified: true,
      isActive: true,
    });

    console.log("✅  Admin user created successfully!");
    console.log(`   Email:    ${admin.email}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`   Role:     ${admin.role}`);
    console.log("\n   ⚠️  Change the password immediately after first login!\n");
  } catch (error) {
    console.error("❌  Seed failed:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
