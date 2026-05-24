import { Schema, model, Document, Types } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  phone: string;
  email?: string;
  password: string;
  role: "rider" | "driver";
  profilePicture?: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;

  vehicleInfo?: {
    make: string;
    model: string;
    plate: string;
    color: string;
    year: number;
  };
  licenseNumber?: string;
  rating: number;
  totalRatings: number;
  totalTrips: number;
  isAvailable?: boolean;
  currentLocation?: {
    lat: number;
    lng: number;
    updatedAt: Date;
  };

  comparePassword(plain: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["rider", "driver"], required: true },
    profilePicture: String,
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },

    vehicleInfo: {
      make: String,
      model: String,
      plate: String,
      color: String,
      year: Number,
    },
    licenseNumber: String,
    isAvailable: { type: Boolean, default: false },

    currentLocation: {
      lat: Number,
      lng: Number,
      updatedAt: Date,
    },

    rating: { type: Number, default: 5.0, min: 1, max: 5 },
    totalRatings: { type: Number, default: 0 },
    totalTrips: { type: Number, default: 0 },
  },
  { timestamps: true },
);

UserSchema.index({ phone: 1 });
UserSchema.index({ role: 1, isAvailable: 1 }); // find available drivers quickly

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = async function (
  plain: string,
): Promise<boolean> {
  return bcrypt.compare(plain, this.password as string);
};

UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export const User = model<IUser>("User", UserSchema);
