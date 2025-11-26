// models/user.model.ts
import mongoose, { Schema, Model } from "mongoose";
import { AuthProvider, SystemRole } from "../types/base.types";
import { IUserDocument, IUser } from "../types/user.types";

const userSecuritySchema = new Schema(
  {
    lastLogin: { type: Date },
    lastLoggedOut: { type: Date },
    passwordChangedAt: { type: Date },
  },
  { _id: false }
);

const userSchema = new Schema<IUserDocument>(
  {
    // Basic info
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters long"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
    },
    password: {
      type: String,
      required: function (this: IUser) {
        return this.authProvider === AuthProvider.CREDENTIALS;
      },
      minlength: [6, "Password must be at least 6 characters long"],
      select: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    // System roles
    systemRole: {
      type: String,
      enum: {
        values: Object.values(SystemRole),
        message: "Role must be user, admin, or super_admin",
      },
      default: SystemRole.USER,
    },

    // Auth provider info
    authProvider: {
      type: String,
      enum: {
        values: Object.values(AuthProvider),
        message: "Provider must be credentials, google, or apple",
      },
      default: AuthProvider.CREDENTIALS,
    },
    authProviderId: {
      type: String,
      sparse: true,
    },
    profileId: {
      type: Schema.Types.ObjectId,
      ref: "UserProfile",
    },

    // Admin fields
    systemAdminName: {
      type: String,
      default: null,
      trim: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    isSuperAdmin: {
      type: Boolean,
      default: false,
    },

    // Security tokens
    verificationToken: {
      type: String,
      select: false,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    verificationExpires: {
      type: Date,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
    refreshToken: {
      type: String,
      select: false,
    },

    // Enhanced security
    security: {
      type: userSecuritySchema,
      required: true,
      default: () => ({}),
    },

    // Soft delete fields
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ verificationToken: 1 });
userSchema.index({ resetPasswordToken: 1 });
userSchema.index({ authProvider: 1, authProviderId: 1 }, { sparse: true });
userSchema.index({ systemRole: 1 });
userSchema.index({ isDeleted: 1 });
userSchema.index({ createdAt: 1 });
userSchema.index({ "security.lastLogin": 1 });

// Compound indexes
userSchema.index({ authProvider: 1, email: 1 });
userSchema.index({ systemRole: 1, isDeleted: 1 });
userSchema.index({ isDeleted: 1, isEmailVerified: 1 });

// Pre-save middleware
userSchema.pre("save", function (next) {
  // Handle role consistency
  if (this.systemRole === SystemRole.ADMIN) {
    this.isAdmin = true;
    this.isSuperAdmin = false;
  } else if (this.systemRole === SystemRole.SUPER_ADMIN) {
    this.isAdmin = true;
    this.isSuperAdmin = true;
  } else {
    this.isAdmin = false;
    this.isSuperAdmin = false;
  }

  // Auto-verify OAuth users
  if (this.authProvider !== AuthProvider.CREDENTIALS) {
    this.isEmailVerified = true;
  }

  // Update security tracking
  if (this.isModified("password")) {
    this.security.passwordChangedAt = new Date();
  }

  // Handle soft delete
  if (this.isDeleted && !this.deletedAt) {
    this.deletedAt = new Date();
  }

  next();
});

// Query middleware to exclude soft-deleted documents by default
userSchema.pre(/^find/, function (this: mongoose.Query<any, any>, next) {
  // Only exclude soft-deleted if not explicitly including them
  const options = this.getOptions();
  if (!options.includeSoftDeleted) {
    this.find({ isDeleted: { $ne: true } });
  }
  next();
});

// Instance methods
userSchema.methods.softDelete = function (
  this: IUserDocument,
  deletedBy?: string
): Promise<IUserDocument> {
  this.isDeleted = true;
  this.deletedAt = new Date();
  if (deletedBy) {
    this.deletedBy = new mongoose.Types.ObjectId(deletedBy);
  }
  return this.save();
};

userSchema.methods.restore = function (
  this: IUserDocument
): Promise<IUserDocument> {
  this.isDeleted = false;
  this.deletedAt = undefined;
  this.deletedBy = undefined;
  return this.save();
};

// Create the model with proper typing
interface UserModel extends Model<IUserDocument> {}

export const User: UserModel = mongoose.model<IUserDocument>(
  "User",
  userSchema
);
