// controllers/profiles/handlers/crud.handler.ts
import { Response, NextFunction } from "express";
import { BaseProfileHandler } from "./base.handler";
import { CreateProfileRequestBody } from "../../../../types/profiles/user.profile.types";
import {
  handleError,
  validateObjectId,
  AuthenticatedRequest,
} from "../../../../utils/controller-utils/controller.utils";

/**
 * Handler for CRUD operations on user profiles
 */
export class ProfileCRUDHandler extends BaseProfileHandler {
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

      if (!this.validateMobileNumber(profileData.mobileNumber)) {
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
          this.handleUnauthorized(res);
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

      if (!this.validateMobileNumber(updates.mobileNumber)) {
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
        this.handleUnauthorized(res);
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

      if (!this.validateMobileNumber(updates.mobileNumber)) {
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
        this.handleUnauthorized(res);
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
        this.handleUnauthorized(res);
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
}
