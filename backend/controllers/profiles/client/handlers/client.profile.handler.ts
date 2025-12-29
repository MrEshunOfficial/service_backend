// handlers/profiles/client/client.profile.handler.ts
import { Response } from "express";
import {
  clientProfileService,
  PopulationLevel,
} from "../../../../services/profiles/client.profile.service";
import {
  CreateClientProfileRequestBody,
  UpdateClientProfileRequestBody,
} from "../../../../types/profiles/client.profile.types";
import { AuthenticatedRequest } from "../../../../types/user.types";
import {
  handleError,
  validateObjectId,
} from "../../../../utils/controller-utils/controller.utils";

/**
 * Client Profile Handlers
 * CRUD operations for client profiles
 * Handles the core lifecycle management of client profiles
 */
export class ClientProfileHandlers {
  /**
   * POST /api/clients
   * Create a new client profile
   * Flow: User uploads ID images -> Creates profile -> Service links orphaned images
   */
  async createClientProfile(
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

      const profileData: CreateClientProfileRequestBody = req.body;

      // Validate saved addresses if provided
      if (profileData.savedAddresses && profileData.savedAddresses.length > 0) {
        for (const address of profileData.savedAddresses) {
          if (!address.ghanaPostGPS) {
            res.status(400).json({
              success: false,
              message: "Ghana Post GPS is required for all saved addresses",
            });
            return;
          }
        }
      }

      // Create client profile
      const client = await clientProfileService.createClientProfile(
        userId.toString(),
        profileData
      );

      res.status(201).json({
        success: true,
        message: "Client profile created successfully",
        data: {
          clientId: client._id,
          client,
          linkedImages: {
            idImageCount: client.idDetails?.fileImage?.length || 0,
          },
        },
      });
    } catch (error: any) {
      if (error.message === "Client profile already exists") {
        res.status(409).json({
          success: false,
          message: error.message,
        });
        return;
      }

      if (error.message === "User must have customer role") {
        res.status(403).json({
          success: false,
          message: error.message,
        });
        return;
      }

      handleError(res, error, "Failed to create client profile");
    }
  }

  /**
   * GET /api/clients/:clientId
   * Get client profile by ID with configurable population
   */
  async getClientProfile(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { clientId } = req.params;
      const { includeDeleted = "false", populationLevel = "detailed" } =
        req.query;

      if (!validateObjectId(clientId)) {
        res.status(400).json({
          success: false,
          message: "Invalid client ID format",
        });
        return;
      }

      const client = await clientProfileService.getClientProfile(clientId, {
        includeDeleted: includeDeleted === "true",
        populationLevel: populationLevel as PopulationLevel,
      });

      if (!client) {
        res.status(404).json({
          success: false,
          message: "Client profile not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Client profile retrieved successfully",
        data: { client },
      });
    } catch (error) {
      handleError(res, error, "Failed to retrieve client profile");
    }
  }

  /**
   * GET /api/clients/user/:userId
   * Get client profile by user ID
   */
  async getClientByUserId(
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

      const client = await clientProfileService.getClientByUserId(
        userId,
        populationLevel as PopulationLevel
      );

      if (!client) {
        res.status(404).json({
          success: false,
          message: "Client profile not found for this user",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Client profile retrieved successfully",
        data: { client },
      });
    } catch (error) {
      handleError(res, error, "Failed to retrieve client profile");
    }
  }

  /**
   * GET /api/clients/me
   * Get current authenticated user's client profile
   */
  async getMyClientProfile(
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

      const client = await clientProfileService.getClientByUserId(
        userId.toString(),
        populationLevel as PopulationLevel
      );

      if (!client) {
        res.status(404).json({
          success: false,
          message: "You do not have a client profile",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Your client profile retrieved successfully",
        data: { client },
      });
    } catch (error) {
      handleError(res, error, "Failed to retrieve your client profile");
    }
  }

  /**
   * GET /api/clients/me/complete
   * Get complete client profile with stats and enriched data
   */
  async getMyCompleteProfile(
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

      const client = await clientProfileService.getClientByUserId(
        userId.toString(),
        PopulationLevel.MINIMAL
      );

      if (!client) {
        res.status(404).json({
          success: false,
          message: "You do not have a client profile",
        });
        return;
      }

      const completeProfile =
        await clientProfileService.getClientCompleteProfile(
          client._id.toString()
        );

      res.status(200).json({
        success: true,
        message: "Complete client profile retrieved successfully",
        data: completeProfile,
      });
    } catch (error) {
      handleError(res, error, "Failed to retrieve complete profile");
    }
  }

  /**
   * PATCH /api/clients/me
   * Update current authenticated user's client profile
   */
  async updateMyClientProfile(
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

      const updateData: UpdateClientProfileRequestBody = req.body;

      // Get client profile
      const clientProfile = await clientProfileService.getClientByUserId(
        userId.toString(),
        PopulationLevel.MINIMAL
      );

      if (!clientProfile) {
        res.status(404).json({
          success: false,
          message: "You do not have a client profile",
        });
        return;
      }

      // Update profile
      const updatedClient = await clientProfileService.updateClientProfile(
        clientProfile._id.toString(),
        updateData
      );

      res.status(200).json({
        success: true,
        message: "Your client profile updated successfully",
        data: { client: updatedClient },
      });
    } catch (error: any) {
      if (error.message === "Client profile not found") {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }

      handleError(res, error, "Failed to update your client profile");
    }
  }

  /**
   * PATCH /api/clients/:clientId
   * Update client profile (excluding images)
   */
  async updateClientProfile(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { clientId } = req.params;
      const userId = req.user?._id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      if (!validateObjectId(clientId)) {
        res.status(400).json({
          success: false,
          message: "Invalid client ID format",
        });
        return;
      }

      const updateData: UpdateClientProfileRequestBody = req.body;

      const updatedClient = await clientProfileService.updateClientProfile(
        clientId,
        updateData
      );

      res.status(200).json({
        success: true,
        message: "Client profile updated successfully",
        data: { client: updatedClient },
      });
    } catch (error: any) {
      if (error.message === "Client profile not found") {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }

      handleError(res, error, "Failed to update client profile");
    }
  }

  /**
   * DELETE /api/clients/:clientId
   * Soft delete client profile and archive associated images
   */
  async deleteClientProfile(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { clientId } = req.params;
      const userId = req.user?._id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      if (!validateObjectId(clientId)) {
        res.status(400).json({
          success: false,
          message: "Invalid client ID format",
        });
        return;
      }

      await clientProfileService.deleteClientProfile(
        clientId,
        userId.toString()
      );

      res.status(200).json({
        success: true,
        message: "Client profile deleted successfully",
      });
    } catch (error: any) {
      if (error.message === "Client profile not found") {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }

      handleError(res, error, "Failed to delete client profile");
    }
  }

  /**
   * POST /api/clients/:clientId/restore
   * Restore soft-deleted client profile and its images
   */
  async restoreClientProfile(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { clientId } = req.params;
      const userId = req.user?._id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      if (!validateObjectId(clientId)) {
        res.status(400).json({
          success: false,
          message: "Invalid client ID format",
        });
        return;
      }

      await clientProfileService.restoreClientProfile(clientId);

      res.status(200).json({
        success: true,
        message: "Client profile restored successfully",
      });
    } catch (error: any) {
      if (error.message === "Client profile not found") {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }

      handleError(res, error, "Failed to restore client profile");
    }
  }

  /**
   * PATCH /api/clients/:clientId/id-details
   * Update ID details (type and number)
   */
  async updateIdDetails(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { clientId } = req.params;
      const userId = req.user?._id;
      const { idType, idNumber, replaceImages } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      if (!validateObjectId(clientId)) {
        res.status(400).json({
          success: false,
          message: "Invalid client ID format",
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

      const client = await clientProfileService.updateIdDetails(
        clientId,
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
          clientId,
          idType: client.idDetails?.idType,
          idNumber: client.idDetails?.idNumber,
          imageCount: client.idDetails?.fileImage?.length || 0,
          note: replaceImages
            ? "ID images have been replaced with newly uploaded ones"
            : "ID details updated. Use the File/Image Controller to manage ID images",
        },
      });
    } catch (error: any) {
      if (error.message === "Client profile not found") {
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
   * PATCH /api/clients/me/id-details
   * Update ID details for current user's client profile
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

      // Get client profile
      const clientProfile = await clientProfileService.getClientByUserId(
        userId.toString(),
        PopulationLevel.MINIMAL
      );

      if (!clientProfile) {
        res.status(404).json({
          success: false,
          message: "Client profile not found",
        });
        return;
      }

      // Update ID details
      const client = await clientProfileService.updateIdDetails(
        clientProfile._id.toString(),
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
          clientId: client._id,
          idType: client.idDetails?.idType,
          idNumber: client.idDetails?.idNumber,
          imageCount: client.idDetails?.fileImage?.length || 0,
          note: replaceImages
            ? "ID images have been replaced with newly uploaded ones"
            : "ID details updated. Use the File/Image Controller to manage ID images",
        },
      });
    } catch (error: any) {
      if (error.message === "Client profile not found") {
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
   * GET /api/clients/:clientId/stats
   * Get client statistics
   */
  async getClientStats(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { clientId } = req.params;

      if (!validateObjectId(clientId)) {
        res.status(400).json({
          success: false,
          message: "Invalid client ID format",
        });
        return;
      }

      const stats = await clientProfileService.getClientStats(clientId);

      res.status(200).json({
        success: true,
        message: "Client statistics retrieved successfully",
        data: { stats },
      });
    } catch (error: any) {
      if (error.message === "Client profile not found") {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }

      handleError(res, error, "Failed to retrieve client statistics");
    }
  }
}

export default new ClientProfileHandlers();
