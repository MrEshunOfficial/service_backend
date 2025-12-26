// controllers/profiles/handlers/base.handler.ts
import { Response } from "express";
import { UserProfileService } from "../../../services/profiles/userProfile.service";
import { CreateProfileRequestBody } from "../../../types/profiles/user.profile.types";
import { AuthenticatedRequest } from "../../../utils/controller-utils/controller.utils";

/**
 * Base handler with common utilities for all profile handlers
 */
export abstract class BaseProfileHandler {
  protected profileService: UserProfileService;

  constructor() {
    this.profileService = new UserProfileService();
  }

  /**
   * Extract userId from request with validation
   */
  protected getUserId(req: AuthenticatedRequest): string {
    const userId = req.userId;
    if (!userId) {
      throw new Error("UNAUTHORIZED");
    }
    return userId;
  }

  /**
   * Validate and sanitize profile update data
   */
  protected sanitizeProfileUpdates(
    updates: any
  ): Partial<CreateProfileRequestBody> {
    const { userId, _id, createdAt, updatedAt, ...sanitized } = updates;
    return sanitized;
  }

  /**
   * Validate mobile number
   */
  protected validateMobileNumber(mobileNumber?: string): boolean {
    if (!mobileNumber) return true;
    return this.profileService.validateMobileNumber(mobileNumber);
  }

  /**
   * Format success response
   */
  protected success(
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
  protected error(
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
   * Handle unauthorized errors
   */
  protected handleUnauthorized(res: Response): void {
    this.error(res, "Unauthorized: User ID not found", 401);
  }
}