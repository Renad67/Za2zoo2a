import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";
import { UserRole } from "../types";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  profilePhoto?: string;
  rating: number;
  totalRatings: number;
  isVerified: boolean;
  isActive: boolean;
  otp?: string;
  otpExpiry?: Date;
  refreshToken?: string;
  savedLocations: {
    label: string;
    address: string;
    coordinates: { lat: number; lng: number };
  }[];
  emergencyContacts: {
    name: string;
    relation: string;
    phone: string;
  }[];
  pushToken?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: Object.values(UserRole), required: true },
    profilePhoto: { type: String },
    rating: { type: Number, default: 5.0, min: 1, max: 5 },
    totalRatings: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    otp: { type: String, select: false },
    otpExpiry: { type: Date, select: false },
    refreshToken: { type: String, select: false },
    savedLocations: [
      {
        label: String,
        address: String,
        coordinates: { lat: Number, lng: Number },
      },
    ],
    emergencyContacts: [
      {
        name: String,
        relation: String,
        phone: String,
      },
    ],
    pushToken: { type: String },
  },
  { timestamps: true },
);

UserSchema.index({ phone: 1 });
UserSchema.index({ email: 1 });

// Hash password before save
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = async function (
  candidate: string,
): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

// Strip password from JSON output
UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.otp;
  delete obj.otpExpiry;
  delete obj.refreshToken;
  return obj;
};

export const User = mongoose.model<IUser>("User", UserSchema);
