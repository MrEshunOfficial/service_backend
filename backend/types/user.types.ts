// types/user.types.ts
import { Types, Document } from "mongoose";
import { Request } from "express";
import {
  BaseEntity,
  SoftDeletable,
  SystemRole,
  AuthProvider,
} from "./base.types";
import { IUserProfile } from "./profiles/user.profile.types";

// User security and tracking
export interface UserSecurity {
  lastLogin?: Date;
  lastLoggedOut?: Date;
  passwordChangedAt?: Date;
}

export interface IUser extends BaseEntity, SoftDeletable {
  name: string;
  email: string;
  password?: string;
  isEmailVerified: boolean;

  authProvider: AuthProvider;
  authProviderId?: string;
  profileId?: Types.ObjectId;

  systemRole: SystemRole;

  // Admin fields
  systemAdminName?: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;

  // Security and tokens
  verificationToken?: string;
  resetPasswordToken?: string;
  verificationExpires?: Date;
  resetPasswordExpires?: Date;
  refreshToken?: string;

  // Enhanced security
  security: UserSecurity;
}

// Instance methods interface
export interface IUserMethods {
  softDelete(deletedBy?: string): Promise<IUserDocument>;
  restore(): Promise<IUserDocument>;
}

// Combined document interface
export interface IUserDocument extends IUser, IUserMethods, Document {
  _id: Types.ObjectId;
}

// Auth-related interfaces
export interface GoogleAuthRequestBody {
  idToken: string;
}

export interface AppleAuthRequestBody {
  idToken: string;
  user?: {
    name?: {
      firstName: string;
      lastName: string;
    };
  };
}

export interface OAuthUserData {
  email: string;
  name: string;
  avatar?: string;
  providerId: string;
  provider: "google" | "apple" | "github" | "facebook";
}

export interface SignupRequestBody {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequestBody {
  email: string;
  password: string;
}

export interface ResetPasswordRequestBody {
  email: string;
}

export interface VerifyEmailRequestBody {
  token: string;
}

export interface UpdatePasswordRequestBody {
  token: string;
  password: string;
}

export interface ResendVerificationRequestBody {
  email: string;
}

export interface UpdateProfileRequestBody {
  name?: string;
  profile?: Partial<IUserProfile>;
}

export interface UpdateProfilePreferencesRequestBody {}

export interface LinkProviderRequestBody {
  provider: "google" | "apple";
  idToken: string;
}

export interface AuthenticatedRequest extends Request {
  userId?: string;
  profile?: IUserProfile | null;
  user?: IUser;
}

export interface AuthResponse {
  message: string;
  user?: Partial<IUser>;
  profile?: Partial<IUserProfile> | null;
  hasProfile?: boolean;
  token?: string;
  requiresVerification?: boolean;
  email?: string;
  error?: string;
}

