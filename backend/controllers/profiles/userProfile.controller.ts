// controllers/profiles/userProfile.controller.ts
import { Response, NextFunction } from "express";
import { UserProfileService } from "../../services/profiles/userProfile.service";
import { CreateProfileRequestBody } from "../../types/profiles/user.profile.types";
import {
  handleError,
  validateObjectId,
  AuthenticatedRequest,
} from "../../utils/controller-utils/controller.utils";

/**
 * User Profile Controller
 *
 * Handles HTTP layer concerns:
 * - Request validation and sanitization
 * - Authentication/Authorization checks
 * - Response formatting
 * - HTTP status codes
 *
 * Business logic is delegated to UserProfileService
 */
export class UserProfileController {
  private profileService: UserProfileService;

  constructor() {
    this.profileService = new UserProfileService();
  }

  /**
   * Extract userId from request with validation
   */
  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.userId;
    if (!userId) {
      throw new Error("UNAUTHORIZED");
    }
    return userId;
  }

  /**
   * Validate and sanitize profile update data
   */
  private sanitizeProfileUpdates(
    updates: any
  ): Partial<CreateProfileRequestBody> {
    // Remove sensitive fields that shouldn't be updated
    const { userId, _id, createdAt, updatedAt, ...sanitized } = updates;
    return sanitized;
  }

  /**
   * Format success response
   */
  private success(
    res: Response,
    data: any,
    message: string,
    status = 200
  ): void {
    res.status(status).json({
      success: true,
      message,
      data,
    });
  }

  /**
   * Format error response
   */
  private error(
    res: Response,
    message: string,
    status = 400,
    data?: any
  ): void {
    res.status(status).json({
      success: false,
      message,
      ...(data && { data }),
    });
  }

  /**
   * Create a new user profile
   * POST /api/profiles
   */
  createProfile = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const profileData: CreateProfileRequestBody = req.body;

      // Validate mobile number if provided
      if (
        profileData.mobileNumber &&
        !this.profileService.validateMobileNumber(profileData.mobileNumber)
      ) {
        this.error(res, "Invalid mobile number format", 400);
        return;
      }

      const profile = await this.profileService.createProfile(
        userId,
        profileData
      );
      this.success(res, profile, "Profile created successfully", 201);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "UNAUTHORIZED") {
          this.error(res, "Unauthorized: User ID not found", 401);
          return;
        }
        if (error.message === "Profile already exists for this user") {
          this.error(res, error.message, 409);
          return;
        }
      }
      handleError(res, error, "Failed to create profile");
    }
  };

  /**
   * Get current user's profile
   * GET /api/profiles/me
   */
  getMyProfile = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const includeDetails = req.query.includeDetails === "true";

      const profile = await this.profileService.getProfileByUserId(
        userId,
        includeDetails
      );

      if (!profile) {
        this.error(res, "Profile not found", 404);
        return;
      }

      this.success(res, profile, "Profile retrieved successfully");
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        this.error(res, "Unauthorized: User ID not found", 401);
        return;
      }
      handleError(res, error, "Failed to retrieve profile");
    }
  };

  /**
   * Get complete profile with picture details
   * GET /api/profiles/me/complete
   */
  getCompleteProfile = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const result = await this.profileService.getCompleteProfile(userId);

      if (!result.profile) {
        this.error(res, "Profile not found", 404);
        return;
      }

      this.success(res, result, "Complete profile retrieved successfully");
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        this.error(res, "Unauthorized: User ID not found", 401);
        return;
      }
      handleError(res, error, "Failed to retrieve complete profile");
    }
  };

  /**
   * Get profile by user ID
   * GET /api/profiles/user/:userId
   */
  getProfileByUserId = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId } = req.params;

      if (!validateObjectId(userId)) {
        this.error(res, "Invalid user ID format", 400);
        return;
      }

      const includeDetails = req.query.includeDetails === "true";
      const profile = await this.profileService.getProfileByUserId(
        userId,
        includeDetails
      );

      if (!profile) {
        this.error(res, "Profile not found", 404);
        return;
      }

      this.success(res, profile, "Profile retrieved successfully");
    } catch (error) {
      handleError(res, error, "Failed to retrieve profile");
    }
  };

  /**
   * Get profile by profile ID
   * GET /api/profiles/:profileId
   */
  getProfileById = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { profileId } = req.params;

      if (!validateObjectId(profileId)) {
        this.error(res, "Invalid profile ID format", 400);
        return;
      }

      const includeDetails = req.query.includeDetails === "true";
      const profile = await this.profileService.getProfileById(
        profileId,
        includeDetails
      );

      if (!profile) {
        this.error(res, "Profile not found", 404);
        return;
      }

      this.success(res, profile, "Profile retrieved successfully");
    } catch (error) {
      handleError(res, error, "Failed to retrieve profile");
    }
  };

  /**
   * Update current user's profile
   * PATCH /api/profiles/me
   */
  updateMyProfile = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const updates = this.sanitizeProfileUpdates(req.body);

      // Validate mobile number if being updated
      if (
        updates.mobileNumber &&
        !this.profileService.validateMobileNumber(updates.mobileNumber)
      ) {
        this.error(res, "Invalid mobile number format", 400);
        return;
      }

      const profile = await this.profileService.updateProfile(userId, updates);

      if (!profile) {
        this.error(res, "Profile not found", 404);
        return;
      }

      this.success(res, profile, "Profile updated successfully");
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        this.error(res, "Unauthorized: User ID not found", 401);
        return;
      }
      handleError(res, error, "Failed to update profile");
    }
  };

  /**
   * Update profile by profile ID (admin)
   * PATCH /api/profiles/:profileId
   */
  updateProfileById = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { profileId } = req.params;

      if (!validateObjectId(profileId)) {
        this.error(res, "Invalid profile ID format", 400);
        return;
      }

      const updates = this.sanitizeProfileUpdates(req.body);

      // Validate mobile number if being updated
      if (
        updates.mobileNumber &&
        !this.profileService.validateMobileNumber(updates.mobileNumber)
      ) {
        this.error(res, "Invalid mobile number format", 400);
        return;
      }

      const profile = await this.profileService.updateProfileById(
        profileId,
        updates
      );

      if (!profile) {
        this.error(res, "Profile not found", 404);
        return;
      }

      this.success(res, profile, "Profile updated successfully");
    } catch (error) {
      handleError(res, error, "Failed to update profile");
    }
  };

  /**
   * Soft delete current user's profile
   * DELETE /api/profiles/me
   */
  deleteMyProfile = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      await this.profileService.deleteProfile(userId);
      this.success(res, null, "Profile deleted successfully");
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        this.error(res, "Unauthorized: User ID not found", 401);
        return;
      }
      handleError(res, error, "Failed to delete profile");
    }
  };

  /**
   * Restore soft deleted profile
   * POST /api/profiles/me/restore
   */
  restoreMyProfile = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const profile = await this.profileService.restoreProfile(userId);

      if (!profile) {
        this.error(res, "Deleted profile not found", 404);
        return;
      }

      this.success(res, profile, "Profile restored successfully");
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        this.error(res, "Unauthorized: User ID not found", 401);
        return;
      }
      handleError(res, error, "Failed to restore profile");
    }
  };

  /**
   * Permanently delete profile (admin)
   * DELETE /api/profiles/:userId/permanent
   */
  permanentlyDeleteProfile = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId } = req.params;

      if (!validateObjectId(userId)) {
        this.error(res, "Invalid user ID format", 400);
        return;
      }

      await this.profileService.permanentlyDeleteProfile(userId);
      this.success(res, null, "Profile permanently deleted");
    } catch (error) {
      handleError(res, error, "Failed to permanently delete profile");
    }
  };

  /**
   * Check if profile exists
   * GET /api/profiles/exists
   */
  checkProfileExists = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const exists = await this.profileService.profileExists(userId);
      this.success(res, { exists }, "Profile existence checked");
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        this.error(res, "Unauthorized: User ID not found", 401);
        return;
      }
      handleError(res, error, "Failed to check profile existence");
    }
  };

  /**
   * Get profile statistics
   * GET /api/profiles/me/stats
   */
  getMyProfileStats = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const stats = await this.profileService.getProfileStats(userId);
      this.success(res, stats, "Profile statistics retrieved successfully");
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        this.error(res, "Unauthorized: User ID not found", 401);
        return;
      }
      handleError(res, error, "Failed to retrieve profile statistics");
    }
  };

  /**
   * Search profiles by bio
   * GET /api/profiles/search
   */
  searchProfiles = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { q, limit = "20", skip = "0" } = req.query;

      if (!q || typeof q !== "string") {
        this.error(res, "Search query is required", 400);
        return;
      }

      const limitNum = parseInt(limit as string, 10);
      const skipNum = parseInt(skip as string, 10);

      if (isNaN(limitNum) || isNaN(skipNum) || limitNum < 1 || skipNum < 0) {
        this.error(res, "Invalid limit or skip value", 400);
        return;
      }

      const profiles = await this.profileService.searchProfilesByBio(
        q,
        limitNum,
        skipNum
      );

      this.success(
        res,
        {
          profiles,
          count: profiles.length,
          limit: limitNum,
          skip: skipNum,
        },
        "Search completed successfully"
      );
    } catch (error) {
      handleError(res, error, "Failed to search profiles");
    }
  };

  /**
   * Get multiple profiles by user IDs
   * POST /api/profiles/batch
   */
  getProfilesByUserIds = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userIds, includeDetails = false } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        this.error(res, "userIds must be a non-empty array", 400);
        return;
      }

      // Validate all user IDs
      const invalidIds = userIds.filter((id) => !validateObjectId(id));

      if (invalidIds.length > 0) {
        this.error(res, "Invalid user ID format", 400, { invalidIds });
        return;
      }

      const profiles = await this.profileService.getProfilesByUserIds(
        userIds,
        includeDetails
      );

      this.success(
        res,
        {
          profiles,
          count: profiles.length,
        },
        "Profiles retrieved successfully"
      );
    } catch (error) {
      handleError(res, error, "Failed to retrieve profiles");
    }
  };

  /**
   * Get all profiles with pagination (admin)
   * GET /api/profiles
   */
  getAllProfiles = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { limit = "20", skip = "0", includeDeleted = "false" } = req.query;

      const limitNum = parseInt(limit as string, 10);
      const skipNum = parseInt(skip as string, 10);
      const includeDeletedBool = includeDeleted === "true";

      if (isNaN(limitNum) || isNaN(skipNum) || limitNum < 1 || skipNum < 0) {
        this.error(res, "Invalid limit or skip value", 400);
        return;
      }

      const result = await this.profileService.getAllProfiles(
        limitNum,
        skipNum,
        includeDeletedBool
      );

      this.success(res, result, "Profiles retrieved successfully");
    } catch (error) {
      handleError(res, error, "Failed to retrieve all profiles");
    }
  };

  /**
   * Bulk update profiles (admin)
   * PATCH /api/profiles/bulk
   */
  bulkUpdateProfiles = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userIds, updates } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        this.error(res, "userIds must be a non-empty array", 400);
        return;
      }

      if (!updates || typeof updates !== "object") {
        this.error(res, "updates object is required", 400);
        return;
      }

      // Validate all user IDs
      const invalidIds = userIds.filter((id) => !validateObjectId(id));

      if (invalidIds.length > 0) {
        this.error(res, "Invalid user ID format", 400, { invalidIds });
        return;
      }

      const sanitizedUpdates = this.sanitizeProfileUpdates(updates);
      const result = await this.profileService.bulkUpdateProfiles(
        userIds,
        sanitizedUpdates
      );

      this.success(
        res,
        result,
        `${result.modifiedCount} profiles updated successfully`
      );
    } catch (error) {
      handleError(res, error, "Failed to bulk update profiles");
    }
  };
}

export default UserProfileController;
