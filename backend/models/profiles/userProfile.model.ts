// models/profiles/userProfile.model.ts
import { Schema, model, Model, Document } from "mongoose";
import { IUserProfile } from "../../types/profiles/user.profile.types";
import { UserRole } from "../../types/base.types";

/**
 * Instance methods interface
 */
interface IUserProfileMethods {
  softDelete(): Promise<this>;
  restore(): Promise<this>;
}

/**
 * Static methods interface
 */
interface IUserProfileModel
  extends Model<IUserProfile, {}, IUserProfileMethods> {
  findActiveByUserId(
    userId: string
  ): Promise<
    | (Document<unknown, {}, IUserProfile> &
        IUserProfile &
        IUserProfileMethods & { _id: any })
    | null
  >;
  findWithDetails(
    userId: string
  ): Promise<
    | (Document<unknown, {}, IUserProfile> &
        IUserProfile &
        IUserProfileMethods & { _id: any })
    | null
  >;
}

/**
 * User Profile Schema
 *
 * Stores user profile information including bio, mobile number, and profile picture.
 * Supports soft deletion and tracks modifications.
 *
 * Key Features:
 * - Links to User via userId
 * - Optional profile picture via profilePictureId
 * - Soft deletion support (isDeleted flag)
 * - Last modified tracking
 * - Role-based access control
 */
const userProfileSchema = new Schema<
  IUserProfile,
  IUserProfileModel,
  IUserProfileMethods
>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    role: {
      type: String,
      enum: UserRole,
      default: UserRole.CUSTOMER,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [500, "Bio cannot exceed 500 characters"],
    },
    mobileNumber: {
      type: String,
      trim: true,
      validate: {
        validator: function (v: string) {
          // Basic phone number validation (supports international format)
          return (
            !v ||
            /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/.test(
              v
            )
          );
        },
        message: (props) => `${props.value} is not a valid phone number`,
      },
    },
    profilePictureId: {
      type: Schema.Types.ObjectId,
      ref: "File",
      index: true,
    },
    lastModified: {
      type: Date,
      default: Date.now,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "userProfiles",
  }
);

// Indexes for efficient querying
userProfileSchema.index({ userId: 1, isDeleted: 1 });
userProfileSchema.index({ profilePictureId: 1 }, { sparse: true });

// Pre-save middleware to update lastModified
userProfileSchema.pre("save", function (next) {
  if (this.isModified() && !this.isNew) {
    this.lastModified = new Date();
  }
  // next();
});

// Pre-update middleware to update lastModified
userProfileSchema.pre("findOneAndUpdate", function (next) {
  this.set({ lastModified: new Date() });
  // next();
});

// Instance method to soft delete profile
userProfileSchema.method("softDelete", async function () {
  this.isDeleted = true;
  this.lastModified = new Date();
  return await this.save();
});

// Instance method to restore soft deleted profile
userProfileSchema.method("restore", async function () {
  this.isDeleted = false;
  this.lastModified = new Date();
  return await this.save();
});

// Static method to find active profile by userId
userProfileSchema.static("findActiveByUserId", function (userId: string) {
  return this.findOne({ userId, isDeleted: false });
});

// Static method to find profile with populated fields
userProfileSchema.static("findWithDetails", function (userId: string) {
  return this.findOne({ userId, isDeleted: false })
    .populate("userId", "email firstName lastName")
    .populate("profilePictureId", "url thumbnailUrl uploadedAt");
});

// Virtual for full name (if user is populated)
userProfileSchema.virtual("fullName").get(function () {
  if (this.populated("userId")) {
    const user = this.userId as any;
    return `${user.firstName || ""} ${user.lastName || ""}`.trim();
  }
  return undefined;
});

// Ensure virtuals are included in JSON
userProfileSchema.set("toJSON", {
  virtuals: true,
  transform: function (_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

userProfileSchema.set("toObject", {
  virtuals: true,
});

// Create and export the model
export const ProfileModel = model<IUserProfile, IUserProfileModel>(
  "UserProfile",
  userProfileSchema
);

export default ProfileModel;
