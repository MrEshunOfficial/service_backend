// types/profile.types.ts
import { Types } from "mongoose";
import { BaseEntity, SoftDeletable, UserRole } from "../base.types";
import { IUser } from "../user.types";

// Updated IUserProfile interface with warnings field
export interface IUserProfile extends BaseEntity, SoftDeletable {
  userId: Types.ObjectId;
  role?: UserRole;
  bio?: string;
  mobileNumber?: string;
  profilePictureId?: Types.ObjectId;
  lastModified?: Date;
}

export interface DomainProfile extends BaseEntity {
  userId: Types.ObjectId;
  profileId: Types.ObjectId;
  isActive: boolean;
}

export interface CreateProfileRequestBody
  extends Omit<IUserProfile, "userId" | "_id" | "createdAt" | "updatedAt"> {}

export interface ProfileResponse {
  message: string;
  user?: Partial<IUser>;
  profile?: Partial<IUserProfile>;
  error?: string;
}
