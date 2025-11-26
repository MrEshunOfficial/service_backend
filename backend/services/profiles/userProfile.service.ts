// services/profiles/userProfile.service.ts
import { Types } from "mongoose";
import { ProfileModel } from "../../models/profiles/userProfile.model";
import { MongoDBFileService } from "../files/mongodb.files.service";
import {
  CreateProfileRequestBody,
  IUserProfile,
} from "../../types/profiles/user.profile.types";
import { ImageLinkingService } from "../../utils/controller-utils/ImageLinkingService";

/**
 * User Profile Service
 *
 * Handles all business logic for user profile management including:
 * - Profile creation with automatic profile picture linking
 * - Profile updates and retrieval
 * - Profile picture management
 * - Soft deletion and restoration
 *
 * Integrates with ImageLinkingService for seamless picture management
 */
export class UserProfileService {
  private imageLinkingService: ImageLinkingService;
  private fileService: MongoDBFileService;

  constructor() {
    this.imageLinkingService = new ImageLinkingService();
    this.fileService = new MongoDBFileService();
  }

  /**
   * Create a new user profile
   * Automatically links any orphaned profile picture uploaded before profile creation
   */
  async createProfile(
    userId: string,
    profileData: CreateProfileRequestBody
  ): Promise<IUserProfile> {
    try {
      // Check if profile already exists
      const existingProfile = await ProfileModel.findOne({
        userId: new Types.ObjectId(userId),
        isDeleted: false,
      });

      if (existingProfile) {
        throw new Error("Profile already exists for this user");
      }

      // Create the profile
      const profile = await ProfileModel.create({
        userId: new Types.ObjectId(userId),
        ...profileData,
        lastModified: new Date(),
      });

      // Try to link any orphaned profile picture
      const linkResult = await this.imageLinkingService.linkOrphanedImage(
        "user",
        userId,
        "profile_picture",
        "profilePictureId"
      );

      if (linkResult.linked) {
        // Refresh profile to get the updated profilePictureId
        const updatedProfile = await ProfileModel.findById(profile._id);
        return updatedProfile!;
      }

      return profile;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user profile by userId
   */
  async getProfileByUserId(
    userId: string,
    includeDetails: boolean = false
  ): Promise<IUserProfile | null> {
    try {
      if (includeDetails) {
        return await ProfileModel.findWithDetails(userId);
      }

      return await ProfileModel.findActiveByUserId(userId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user profile by profile ID
   */
  async getProfileById(
    profileId: string,
    includeDetails: boolean = false
  ): Promise<IUserProfile | null> {
    try {
      if (!Types.ObjectId.isValid(profileId)) {
        throw new Error("Invalid profile ID");
      }

      const query = ProfileModel.findOne({
        _id: new Types.ObjectId(profileId),
        isDeleted: false,
      });

      if (includeDetails) {
        query
          .populate("userId", "email firstName lastName")
          .populate("profilePictureId", "url thumbnailUrl uploadedAt");
      }

      return await query;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update user profile
   * Automatically updates lastModified timestamp
   */
  async updateProfile(
    userId: string,
    updates: Partial<CreateProfileRequestBody>
  ): Promise<IUserProfile | null> {
    try {
      const profile = await ProfileModel.findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          isDeleted: false,
        },
        {
          ...updates,
          lastModified: new Date(),
        },
        { new: true, runValidators: true }
      );

      if (!profile) {
        throw new Error("Profile not found");
      }

      return profile;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update profile by profile ID
   */
  async updateProfileById(
    profileId: string,
    updates: Partial<CreateProfileRequestBody>
  ): Promise<IUserProfile | null> {
    try {
      if (!Types.ObjectId.isValid(profileId)) {
        throw new Error("Invalid profile ID");
      }

      const profile = await ProfileModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(profileId),
          isDeleted: false,
        },
        {
          ...updates,
          lastModified: new Date(),
        },
        { new: true, runValidators: true }
      );

      if (!profile) {
        throw new Error("Profile not found");
      }

      return profile;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Soft delete user profile
   * Also unlinks profile picture if present
   */
  async deleteProfile(userId: string): Promise<boolean> {
    try {
      const profile = await ProfileModel.findOne({
        userId: new Types.ObjectId(userId),
        isDeleted: false,
      });

      if (!profile) {
        throw new Error("Profile not found");
      }

      // Unlink profile picture if exists
      if (profile.profilePictureId) {
        await this.imageLinkingService.unlinkImage(
          "user",
          userId,
          "profilePictureId",
          profile.profilePictureId
        );
      }

      // Soft delete the profile
      await profile.softDelete();

      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Restore soft deleted profile
   * Attempts to re-link profile picture if available
   */
  async restoreProfile(userId: string): Promise<IUserProfile | null> {
    try {
      const profile = await ProfileModel.findOne({
        userId: new Types.ObjectId(userId),
        isDeleted: true,
      });

      if (!profile) {
        throw new Error("Deleted profile not found");
      }

      // Restore the profile
      await profile.restore();

      // Try to re-link profile picture
      const linkResult = await this.imageLinkingService.linkOrphanedImage(
        "user",
        userId,
        "profile_picture",
        "profilePictureId"
      );

      if (linkResult.linked) {
        // Refresh profile to get updated profilePictureId
        return await ProfileModel.findById(profile._id);
      }

      return profile;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Permanently delete profile (hard delete)
   * WARNING: This action cannot be undone
   */
  async permanentlyDeleteProfile(userId: string): Promise<boolean> {
    try {
      const profile = await ProfileModel.findOne({
        userId: new Types.ObjectId(userId),
      });

      if (!profile) {
        throw new Error("Profile not found");
      }

      // Unlink and delete profile picture if exists
      if (profile.profilePictureId) {
        await this.imageLinkingService.unlinkImage(
          "user",
          userId,
          "profilePictureId",
          profile.profilePictureId
        );
      }

      // Permanently delete
      await ProfileModel.deleteOne({ _id: profile._id });

      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update profile picture ID
   * Used by file upload services to link pictures to profiles
   */
  async updateProfilePictureId(
    userId: string,
    profilePictureId: Types.ObjectId | null
  ): Promise<IUserProfile | null> {
    try {
      const updateData: any = {
        lastModified: new Date(),
      };

      if (profilePictureId === null) {
        updateData.$unset = { profilePictureId: 1 };
      } else {
        updateData.profilePictureId = profilePictureId;
      }

      const profile = await ProfileModel.findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          isDeleted: false,
        },
        updateData,
        { new: true }
      );

      return profile;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get profile with complete details including picture URL
   */
  async getCompleteProfile(userId: string): Promise<{
    profile: IUserProfile | null;
    profilePicture?: {
      url: string;
      thumbnailUrl?: string;
      uploadedAt: Date;
    };
  }> {
    try {
      const profile = await ProfileModel.findActiveByUserId(userId);

      if (!profile) {
        return { profile: null };
      }

      // Get profile picture details if exists
      if (profile.profilePictureId) {
        const file = await this.fileService.getFileById(
          profile.profilePictureId.toString()
        );

        if (file && file.status === "active") {
          return {
            profile,
            profilePicture: {
              url: file.url,
              thumbnailUrl: file.thumbnailUrl,
              uploadedAt: file.uploadedAt,
            },
          };
        }
      }

      return { profile };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if profile exists for user
   */
  async profileExists(userId: string): Promise<boolean> {
    try {
      const count = await ProfileModel.countDocuments({
        userId: new Types.ObjectId(userId),
        isDeleted: false,
      });

      return count > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get multiple profiles by user IDs
   */
  async getProfilesByUserIds(
    userIds: string[],
    includeDetails: boolean = false
  ): Promise<IUserProfile[]> {
    try {
      const objectIds = userIds.map((id) => new Types.ObjectId(id));

      const query = ProfileModel.find({
        userId: { $in: objectIds },
        isDeleted: false,
      });

      if (includeDetails) {
        query
          .populate("userId", "email firstName lastName")
          .populate("profilePictureId", "url thumbnailUrl uploadedAt");
      }

      return await query;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search profiles by bio content
   */
  async searchProfilesByBio(
    searchTerm: string,
    limit: number = 20,
    skip: number = 0
  ): Promise<IUserProfile[]> {
    try {
      return await ProfileModel.find({
        bio: { $regex: searchTerm, $options: "i" },
        isDeleted: false,
      })
        .limit(limit)
        .skip(skip)
        .populate("userId", "email firstName lastName")
        .populate("profilePictureId", "url thumbnailUrl");
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get profile statistics
   */
  async getProfileStats(userId: string): Promise<{
    hasProfile: boolean;
    hasProfilePicture: boolean;
    profileCreatedAt?: Date;
    lastModified?: Date;
    bioLength?: number;
  }> {
    try {
      const profile = await ProfileModel.findActiveByUserId(userId);

      if (!profile) {
        return {
          hasProfile: false,
          hasProfilePicture: false,
        };
      }

      return {
        hasProfile: true,
        hasProfilePicture: !!profile.profilePictureId,
        profileCreatedAt: profile.createdAt,
        lastModified: profile.lastModified,
        bioLength: profile.bio?.length || 0,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validate mobile number format
   */
  validateMobileNumber(mobileNumber: string): boolean {
    const phoneRegex =
      /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
    return phoneRegex.test(mobileNumber);
  }

  /**
   * Get all profiles with pagination
   * Admin function
   */
  async getAllProfiles(
    limit: number = 20,
    skip: number = 0,
    includeDeleted: boolean = false
  ): Promise<{
    profiles: IUserProfile[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const query: any = includeDeleted ? {} : { isDeleted: false };

      const [profiles, total] = await Promise.all([
        ProfileModel.find(query)
          .limit(limit)
          .skip(skip)
          .populate("userId", "email firstName lastName")
          .populate("profilePictureId", "url thumbnailUrl"),
        ProfileModel.countDocuments(query),
      ]);

      return {
        profiles,
        total,
        hasMore: skip + profiles.length < total,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Bulk update profiles
   * Admin function
   */
  async bulkUpdateProfiles(
    userIds: string[],
    updates: Partial<CreateProfileRequestBody>
  ): Promise<{ modifiedCount: number }> {
    try {
      const objectIds = userIds.map((id) => new Types.ObjectId(id));

      const result = await ProfileModel.updateMany(
        {
          userId: { $in: objectIds },
          isDeleted: false,
        },
        {
          ...updates,
          lastModified: new Date(),
        }
      );

      return { modifiedCount: result.modifiedCount };
    } catch (error) {
      throw error;
    }
  }
}
