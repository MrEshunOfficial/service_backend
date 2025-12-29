// handlers/profiles/provider/provider-profile.handlers.ts
import { Response } from "express";
import { ProviderProfileService } from "../../../../services/profiles/provider.profile.service";
import {
  CreateProviderProfileRequestBody,
  PopulationLevel,
  UpdateProviderProfileRequestBody,
} from "../../../../types/profiles/providerProfile.types";
import { AuthenticatedRequest } from "../../../../types/user.types";
import {
  handleError,
  validateObjectId,
} from "../../../../utils/controller-utils/controller.utils";

/**
 * Provider Profile Handlers
 * CRUD operations for provider profiles
 * Handles the core lifecycle management of provider profiles
 */
export class ProviderProfileHandlers {
  private providerService: ProviderProfileService;

  constructor() {
    this.providerService = new ProviderProfileService();
  }

  /**
   * POST /api/providers
   * Create a new provider profile
   * Flow: User uploads ID/gallery images -> Creates profile -> Service links orphaned images
   */
  async createProviderProfile(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?._id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const profileData: CreateProviderProfileRequestBody = req.body;

      // Validate required fields
      if (!profileData.providerContactInfo) {
        res.status(400).json({
          success: false,
          message: "Provider contact information is required",
        });
        return;
      }

      if (!profileData.locationData || !profileData.locationData.ghanaPostGPS) {
        res.status(400).json({
          success: false,
          message: "Location data with Ghana Post GPS is required",
        });
        return;
      }

      // Validate service offerings if provided
      if (
        profileData.serviceOfferings &&
        profileData.serviceOfferings.length > 0
      ) {
        for (const serviceId of profileData.serviceOfferings) {
          if (!validateObjectId(serviceId.toString())) {
            res.status(400).json({
              success: false,
              message: `Invalid service ID: ${serviceId}`,
            });
            return;
          }
        }
      }

      // Create provider profile
      // The service will automatically link any orphaned images uploaded before profile creation
      const provider = await this.providerService.createProviderProfile(
        userId.toString(),
        profileData
      );

      res.status(201).json({
        success: true,
        message: "Provider profile created successfully",
        data: {
          providerId: provider._id,
          provider,
          linkedImages: {
            galleryCount: provider.BusinessGalleryImages?.length || 0,
            idImageCount: provider.IdDetails?.fileImage?.length || 0,
          },
        },
      });
    } catch (error: any) {
      if (error.message === "Provider profile already exists") {
        res.status(409).json({
          success: false,
          message: error.message,
        });
        return;
      }

      if (error.message === "User must have provider role") {
        res.status(403).json({
          success: false,
          message: error.message,
        });
        return;
      }

      if (error.message.includes("Some services are invalid")) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }

      handleError(res, error, "Failed to create provider profile");
    }
  }

  /**
   * GET /api/providers/:providerId
   * Get provider profile by ID with configurable population
   */
  async getProviderProfile(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { providerId } = req.params;
      const { includeDeleted = "false", populationLevel = "detailed" } =
        req.query;

      if (!validateObjectId(providerId)) {
        res.status(400).json({
          success: false,
          message: "Invalid provider ID format",
        });
        return;
      }

      const provider = await this.providerService.getProviderProfile(
        providerId,
        {
          includeDeleted: includeDeleted === "true",
          populationLevel: populationLevel as PopulationLevel,
        }
      );

      if (!provider) {
        res.status(404).json({
          success: false,
          message: "Provider profile not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Provider profile retrieved successfully",
        data: { provider },
      });
    } catch (error) {
      handleError(res, error, "Failed to retrieve provider profile");
    }
  }

  /**
   * GET /api/providers/user/:userId
   * Get provider profile by user ID
   * Useful for checking if a user has a provider profile
   */
  async getProviderByUserId(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { userId } = req.params;
      const { populationLevel = "detailed" } = req.query;

      if (!validateObjectId(userId)) {
        res.status(400).json({
          success: false,
          message: "Invalid user ID format",
        });
        return;
      }

      const provider = await this.providerService.getProviderByUserId(
        userId,
        populationLevel as PopulationLevel
      );

      if (!provider) {
        res.status(404).json({
          success: false,
          message: "Provider profile not found for this user",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Provider profile retrieved successfully",
        data: { provider },
      });
    } catch (error) {
      handleError(res, error, "Failed to retrieve provider profile");
    }
  }

  /**
   * GET /api/providers/me
   * Get current authenticated user's provider profile
   */
  async getMyProviderProfile(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?._id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const { populationLevel = "detailed" } = req.query;

      const provider = await this.providerService.getProviderByUserId(
        userId.toString(),
        populationLevel as PopulationLevel
      );

      if (!provider) {
        res.status(404).json({
          success: false,
          message: "You do not have a provider profile",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Your provider profile retrieved successfully",
        data: { provider },
      });
    } catch (error) {
      handleError(res, error, "Failed to retrieve your provider profile");
    }
  }

  /**
   * PATCH /api/providers/me
   * Update current authenticated user's provider profile
   */
  async updateMyProviderProfile(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?._id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const updateData: UpdateProviderProfileRequestBody = req.body;

      // Validate service offerings if provided
      if (
        updateData.serviceOfferings &&
        updateData.serviceOfferings.length > 0
      ) {
        for (const serviceId of updateData.serviceOfferings) {
          if (!validateObjectId(serviceId.toString())) {
            res.status(400).json({
              success: false,
              message: `Invalid service ID: ${serviceId}`,
            });
            return;
          }
        }
      }

      // First, get the provider profile for this user
      const providerProfile = await this.providerService.getProviderByUserId(
        userId.toString(),
        PopulationLevel.MINIMAL
      );

      if (!providerProfile) {
        res.status(404).json({
          success: false,
          message: "You do not have a provider profile",
        });
        return;
      }

      // Now update the provider profile
      const updatedProvider = await this.providerService.updateProviderProfile(
        providerProfile._id.toString(),
        updateData,
        userId.toString()
      );

      res.status(200).json({
        success: true,
        message: "Your provider profile updated successfully",
        data: { provider: updatedProvider },
      });
    } catch (error: any) {
      if (error.message === "Provider profile not found") {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }

      if (error.message.includes("Some services are invalid")) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }

      handleError(res, error, "Failed to update your provider profile");
    }
  }

  /**
   * PATCH /api/providers/:providerId
   * Update provider profile (excluding images)
   * Images are managed through separate endpoints
   */
  async updateProviderProfile(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { providerId } = req.params;
      const userId = req.user?._id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      if (!validateObjectId(providerId)) {
        res.status(400).json({
          success: false,
          message: "Invalid provider ID format",
        });
        return;
      }

      const updateData: UpdateProviderProfileRequestBody = req.body;

      // Validate service offerings if provided
      if (
        updateData.serviceOfferings &&
        updateData.serviceOfferings.length > 0
      ) {
        for (const serviceId of updateData.serviceOfferings) {
          if (!validateObjectId(serviceId.toString())) {
            res.status(400).json({
              success: false,
              message: `Invalid service ID: ${serviceId}`,
            });
            return;
          }
        }
      }

      const updatedProvider = await this.providerService.updateProviderProfile(
        providerId,
        updateData,
        userId.toString()
      );

      res.status(200).json({
        success: true,
        message: "Provider profile updated successfully",
        data: { provider: updatedProvider },
      });
    } catch (error: any) {
      if (error.message === "Provider profile not found") {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }

      if (error.message.includes("Some services are invalid")) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }

      handleError(res, error, "Failed to update provider profile");
    }
  }

  /**
   * DELETE /api/providers/:providerId
   * Soft delete provider profile and archive associated images
   */
  async deleteProviderProfile(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { providerId } = req.params;
      const userId = req.user?._id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      if (!validateObjectId(providerId)) {
        res.status(400).json({
          success: false,
          message: "Invalid provider ID format",
        });
        return;
      }

      await this.providerService.deleteProviderProfile(
        providerId,
        userId.toString()
      );

      res.status(200).json({
        success: true,
        message: "Provider profile deleted successfully",
      });
    } catch (error: any) {
      if (error.message === "Provider profile not found") {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }

      handleError(res, error, "Failed to delete provider profile");
    }
  }

  /**
   * POST /api/providers/:providerId/restore
   * Restore soft-deleted provider profile and its images
   */
  async restoreProviderProfile(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { providerId } = req.params;
      const userId = req.user?._id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      if (!validateObjectId(providerId)) {
        res.status(400).json({
          success: false,
          message: "Invalid provider ID format",
        });
        return;
      }

      await this.providerService.restoreProviderProfile(providerId);

      res.status(200).json({
        success: true,
        message: "Provider profile restored successfully",
      });
    } catch (error: any) {
      if (error.message === "Provider profile not found") {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }

      handleError(res, error, "Failed to restore provider profile");
    }
  }

  /**
   * PATCH /api/providers/:providerId/id-details
   * Update ID details (type and number)
   * Note: Image operations are handled by the File/Image Controller
   * This endpoint only updates the IdDetails metadata (type and number)
   */
  async updateIdDetails(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { providerId } = req.params;
      const userId = req.user?._id;
      const { idType, idNumber, replaceImages } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      if (!validateObjectId(providerId)) {
        res.status(400).json({
          success: false,
          message: "Invalid provider ID format",
        });
        return;
      }

      if (!idType || !idNumber) {
        res.status(400).json({
          success: false,
          message: "ID type and ID number are required",
        });
        return;
      }

      // Call the correct service method
      const provider = await this.providerService.updateIdDetails(
        providerId,
        userId.toString(),
        {
          idType,
          idNumber,
          replaceImages: replaceImages || false,
        }
      );

      res.status(200).json({
        success: true,
        message: "ID details updated successfully",
        data: {
          providerId,
          idType: provider.IdDetails?.idType,
          idNumber: provider.IdDetails?.idNumber,
          imageCount: provider.IdDetails?.fileImage?.length || 0,
          note: replaceImages
            ? "ID images have been replaced with newly uploaded ones"
            : "ID details updated. Use the File/Image Controller to manage ID images",
        },
      });
    } catch (error: any) {
      if (error.message === "Provider profile not found") {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }

      handleError(res, error, "Failed to update ID details");
    }
  }

  /**
   * PATCH /api/providers/me/id-details
   * Update ID details for current user's provider profile
   */
  async updateMyIdDetails(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?._id;
      const { idType, idNumber, replaceImages } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      if (!idType || !idNumber) {
        res.status(400).json({
          success: false,
          message: "ID type and ID number are required",
        });
        return;
      }

      // First, get the provider profile for this user
      const providerProfile = await this.providerService.getProviderByUserId(
        userId.toString(),
        PopulationLevel.MINIMAL
      );

      if (!providerProfile) {
        res.status(404).json({
          success: false,
          message: "Provider profile not found",
        });
        return;
      }

      // Now update the ID details
      const provider = await this.providerService.updateIdDetails(
        providerProfile._id.toString(),
        userId.toString(),
        {
          idType,
          idNumber,
          replaceImages: replaceImages || false,
        }
      );

      res.status(200).json({
        success: true,
        message: "ID details updated successfully",
        data: {
          providerId: provider._id,
          idType: provider.IdDetails?.idType,
          idNumber: provider.IdDetails?.idNumber,
          imageCount: provider.IdDetails?.fileImage?.length || 0,
          note: replaceImages
            ? "ID images have been replaced with newly uploaded ones"
            : "ID details updated. Use the File/Image Controller to manage ID images",
        },
      });
    } catch (error: any) {
      if (error.message === "Provider profile not found") {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }

      handleError(res, error, "Failed to update ID details");
    }
  }
}

export default new ProviderProfileHandlers();
