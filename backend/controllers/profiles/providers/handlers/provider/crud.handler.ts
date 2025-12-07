// handlers/provider-profile/crud-provider.handlers.ts
import { Response } from "express";
import { ProviderProfileService } from "../../../../../services/profiles/provider.profile.service";
import { CreateProviderProfileRequestBody, UpdateProviderProfileRequestBody } from "../../../../../types/providerProfile.types";
import { AuthenticatedRequest } from "../../../../../types/user.types";
import { handleError, validateObjectId } from "../../../../../utils/controller-utils/controller.utils";

const providerService = new ProviderProfileService();

/**
 * Handler: Create Provider Profile
 * POST /api/providers
 */
export const createProviderProfileHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const profileData: CreateProviderProfileRequestBody = req.body;

    // Validate required fields
    if (!profileData.businessName) {
      return res.status(400).json({
        success: false,
        message: "Business name is required",
      });
    }

    if (!profileData.locationData?.ghanaPostGPS) {
      return res.status(400).json({
        success: false,
        message: "Ghana Post GPS address is required",
      });
    }

    // Create provider profile
    const provider = await providerService.createProviderProfile(
      userId,
      profileData
    );

    return res.status(201).json({
      success: true,
      message: "Provider profile created successfully",
      data: provider,
    });
  } catch (error: any) {
    if (error.message === "User profile not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    if (error.message === "User must have provider role") {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }
    if (error.message === "Provider profile already exists") {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }
    return handleError(res, error, "Failed to create provider profile");
  }
};

/**
 * Handler: Update Provider Profile
 * PUT /api/providers/:providerId
 */
export const updateProviderProfileHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { providerId } = req.params;
    const userId = req.userId;

    if (!validateObjectId(providerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid provider ID",
      });
    }

    const updateData: UpdateProviderProfileRequestBody = req.body;

    const provider = await providerService.updateProviderProfile(
      providerId,
      updateData,
      userId
    );

    return res.status(200).json({
      success: true,
      message: "Provider profile updated successfully",
      data: provider,
    });
  } catch (error: any) {
    if (error.message === "Provider profile not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    return handleError(res, error, "Failed to update provider profile");
  }
};

/**
 * Handler: Delete Provider Profile (Soft Delete)
 * DELETE /api/providers/:providerId
 */
export const deleteProviderProfileHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { providerId } = req.params;
    const userId = req.userId;

    if (!validateObjectId(providerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid provider ID",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    await providerService.deleteProviderProfile(providerId, userId);

    return res.status(200).json({
      success: true,
      message: "Provider profile deleted successfully",
    });
  } catch (error: any) {
    if (error.message === "Provider profile not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    return handleError(res, error, "Failed to delete provider profile");
  }
};

/**
 * Handler: Restore Provider Profile
 * POST /api/providers/:providerId/restore
 */
export const restoreProviderProfileHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { providerId } = req.params;

    if (!validateObjectId(providerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid provider ID",
      });
    }

    await providerService.restoreProviderProfile(providerId);

    return res.status(200).json({
      success: true,
      message: "Provider profile restored successfully",
    });
  } catch (error: any) {
    if (error.message === "Provider profile not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    return handleError(res, error, "Failed to restore provider profile");
  }
};

/**
 * Handler: Add Service to Provider
 * POST /api/providers/:providerId/services
 * Body: { serviceId }
 */
export const addServiceToProviderHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { providerId } = req.params;
    const { serviceId } = req.body;

    if (!validateObjectId(providerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid provider ID",
      });
    }

    if (!validateObjectId(serviceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID",
      });
    }

    const provider = await providerService.addService(providerId, serviceId);

    return res.status(200).json({
      success: true,
      message: "Service added successfully",
      data: provider,
    });
  } catch (error: any) {
    if (error.message === "Provider profile not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    if (error.message === "Service not found or inactive") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    if (error.message === "Only company-trained providers can offer private services") {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }
    if (error.message === "Service already added to provider") {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }
    return handleError(res, error, "Failed to add service to provider");
  }
};

/**
 * Handler: Remove Service from Provider
 * DELETE /api/providers/:providerId/services/:serviceId
 */
export const removeServiceFromProviderHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { providerId, serviceId } = req.params;

    if (!validateObjectId(providerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid provider ID",
      });
    }

    if (!validateObjectId(serviceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID",
      });
    }

    const provider = await providerService.removeService(providerId, serviceId);

    return res.status(200).json({
      success: true,
      message: "Service removed successfully",
      data: provider,
    });
  } catch (error: any) {
    if (error.message === "Provider profile not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    return handleError(res, error, "Failed to remove service from provider");
  }
};