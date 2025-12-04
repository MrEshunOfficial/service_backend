// handlers/provider-profile.handlers.ts
import { Response } from "express";
import { ProviderProfileService, PopulationLevel } from "../../../../services/profiles/provider.profile.service";
import { Coordinates } from "../../../../types/base.types";
import { CreateProviderProfileRequestBody, UpdateProviderProfileRequestBody } from "../../../../types/providerProfile.types";
import { AuthenticatedRequest } from "../../../../types/user.types";
import { handleError, validateObjectId } from "../../../../utils/controller-utils/controller.utils";

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
 * Handler: Get Provider Profile by ID
 * GET /api/providers/:providerId
 * Query params: populationLevel (optional) - "none" | "minimal" | "standard" | "detailed"
 */
export const getProviderProfileHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { providerId } = req.params;
    const { populationLevel, includeDeleted } = req.query;

    if (!validateObjectId(providerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid provider ID",
      });
    }

    // Parse population level from query param
    let level: PopulationLevel = PopulationLevel.DETAILED;
    if (populationLevel && typeof populationLevel === 'string' && Object.values(PopulationLevel).includes(populationLevel as PopulationLevel)) {
      level = populationLevel as PopulationLevel;
    }

    const provider = await providerService.getProviderProfile(providerId, {
      includeDeleted: includeDeleted === "true",
      populationLevel: level,
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: provider,
    });
  } catch (error) {
    return handleError(res, error, "Failed to fetch provider profile");
  }
};

/**
 * Handler: Get Provider Profile by User Profile ID
 * GET /api/providers/by-profile/:profileId
 * Query params: populationLevel (optional) - "none" | "minimal" | "standard" | "detailed"
 */
export const getProviderByProfileHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { profileId } = req.params;
    const { populationLevel } = req.query;

    if (!validateObjectId(profileId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid profile ID",
      });
    }

    // Parse population level from query param
    let level: PopulationLevel = PopulationLevel.STANDARD;
    if (populationLevel && typeof populationLevel === 'string' && Object.values(PopulationLevel).includes(populationLevel as PopulationLevel)) {
      level = populationLevel as PopulationLevel;
    }

    const provider = await providerService.getProviderByProfile(profileId, level);

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider profile not found for this user",
      });
    }

    return res.status(200).json({
      success: true,
      data: provider,
    });
  } catch (error) {
    return handleError(res, error, "Failed to fetch provider profile");
  }
};

/**
 * Handler: Get Current User's Provider Profile
 * GET /api/providers/me
 * Query params: populationLevel (optional) - "none" | "minimal" | "standard" | "detailed"
 */
export const getMyProviderProfileHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.userId;
    const { populationLevel } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // Parse population level from query param
    let level: PopulationLevel = PopulationLevel.DETAILED;
    if (populationLevel && typeof populationLevel === 'string' && Object.values(PopulationLevel).includes(populationLevel as PopulationLevel)) {
      level = populationLevel as PopulationLevel;
    }

    const provider = await providerService.getProviderByProfile(userId, level);

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider profile not found. Please create one first.",
      });
    }

    return res.status(200).json({
      success: true,
      data: provider,
    });
  } catch (error) {
    return handleError(res, error, "Failed to fetch provider profile");
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
 * Handler: Find Nearest Providers
 * POST /api/providers/nearest
 * Body: { latitude, longitude, maxDistance?, limit?, serviceId?, categoryId?, populationLevel? }
 */
export const findNearestProvidersHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { 
      latitude, 
      longitude, 
      maxDistance, 
      limit, 
      serviceId, 
      categoryId,
      populationLevel 
    } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude must be numbers",
      });
    }

    const userLocation: Coordinates = { latitude, longitude };

    // Parse population level
    let level: PopulationLevel = PopulationLevel.STANDARD;
    if (populationLevel && typeof populationLevel === 'string' && Object.values(PopulationLevel).includes(populationLevel as PopulationLevel)) {
      level = populationLevel as PopulationLevel;
    }

    const providers = await providerService.findNearestProviders(userLocation, {
      maxDistance,
      limit,
      serviceId,
      categoryId,
      populationLevel: level,
    });

    return res.status(200).json({
      success: true,
      data: providers,
      count: providers.length,
    });
  } catch (error) {
    return handleError(res, error, "Failed to find nearest providers");
  }
};

/**
 * Handler: Find Providers by Location
 * GET /api/providers/by-location?region=...&city=...&serviceId=...&limit=...&populationLevel=...
 */
export const findProvidersByLocationHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { region, city, serviceId, limit, populationLevel } = req.query;

    if (!region) {
      return res.status(400).json({
        success: false,
        message: "Region is required",
      });
    }

    // Parse population level
    let level: PopulationLevel = PopulationLevel.MINIMAL;
    if (populationLevel && typeof populationLevel === 'string' && Object.values(PopulationLevel).includes(populationLevel as PopulationLevel)) {
      level = populationLevel as PopulationLevel;
    }

    const providers = await providerService.findProvidersByLocation(
      region as string,
      city as string | undefined,
      {
        serviceId: serviceId as string | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        populationLevel: level,
      }
    );

    return res.status(200).json({
      success: true,
      data: providers,
      count: providers.length,
    });
  } catch (error) {
    return handleError(res, error, "Failed to find providers by location");
  }
};

/**
 * Handler: Get Distance to Provider
 * POST /api/providers/:providerId/distance
 * Body: { latitude, longitude }
 */
export const getDistanceToProviderHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { providerId } = req.params;
    const { latitude, longitude } = req.body;

    if (!validateObjectId(providerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid provider ID",
      });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    const customerLocation: Coordinates = { latitude, longitude };

    const distance = await providerService.getDistanceToProvider(
      customerLocation,
      providerId
    );

    if (!distance) {
      return res.status(404).json({
        success: false,
        message: "Provider not found or has no location data",
      });
    }

    return res.status(200).json({
      success: true,
      data: distance,
    });
  } catch (error) {
    return handleError(res, error, "Failed to calculate distance");
  }
};

/**
 * Handler: Search Providers with Advanced Filters
 * POST /api/providers/search
 * Body: { searchTerm?, region?, city?, serviceIds?, categoryId?, isCompanyTrained?, 
 *         requireInitialDeposit?, userLocation?, maxDistance?, limit?, skip?, populationLevel? }
 */
export const searchProvidersHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const {
      searchTerm,
      region,
      city,
      serviceIds,
      categoryId,
      isCompanyTrained,
      requireInitialDeposit,
      userLocation,
      maxDistance,
      limit,
      skip,
      populationLevel,
    } = req.body;

    // Validate userLocation if provided
    if (userLocation) {
      if (!userLocation.latitude || !userLocation.longitude) {
        return res.status(400).json({
          success: false,
          message: "User location must include latitude and longitude",
        });
      }
    }

    // Parse population level
    let level: PopulationLevel = PopulationLevel.STANDARD;
    if (populationLevel && typeof populationLevel === 'string' && Object.values(PopulationLevel).includes(populationLevel as PopulationLevel)) {
      level = populationLevel as PopulationLevel;
    }

    const result = await providerService.searchProviders({
      searchTerm,
      region,
      city,
      serviceIds,
      categoryId,
      isCompanyTrained,
      requireInitialDeposit,
      userLocation,
      maxDistance,
      limit,
      skip,
      populationLevel: level,
    });

    return res.status(200).json({
      success: true,
      data: result.providers,
      total: result.total,
      count: result.providers.length,
    });
  } catch (error) {
    return handleError(res, error, "Failed to search providers");
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

/**
 * Handler: Get Available Private Services for Company-Trained Providers
 * GET /api/providers/:providerId/available-private-services
 */
export const getAvailablePrivateServicesHandler = async (
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

    const services = await providerService.getAvailablePrivateServices(providerId);

    if (services.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No private services available. Provider may not be company-trained.",
        data: [],
      });
    }

    return res.status(200).json({
      success: true,
      data: services,
      count: services.length,
    });
  } catch (error) {
    return handleError(res, error, "Failed to fetch available private services");
  }
};

/**
 * Handler: Enrich Location Data
 * POST /api/providers/enrich-location
 * Body: { ghanaPostGPS, coordinates?, nearbyLandmark? }
 */
export const enrichLocationDataHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { ghanaPostGPS, coordinates, nearbyLandmark } = req.body;

    if (!ghanaPostGPS) {
      return res.status(400).json({
        success: false,
        message: "Ghana Post GPS is required",
      });
    }

    const result = await providerService.enrichLocationData(
      ghanaPostGPS,
      coordinates,
      nearbyLandmark
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || "Failed to enrich location data",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.location,
    });
  } catch (error) {
    return handleError(res, error, "Failed to enrich location data");
  }
};

/**
 * Handler: Verify Location
 * POST /api/providers/verify-location
 * Body: { ghanaPostGPS, coordinates }
 */
export const verifyLocationHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { ghanaPostGPS, coordinates } = req.body;

    if (!ghanaPostGPS) {
      return res.status(400).json({
        success: false,
        message: "Ghana Post GPS is required",
      });
    }

    if (!coordinates || !coordinates.latitude || !coordinates.longitude) {
      return res.status(400).json({
        success: false,
        message: "Valid coordinates are required",
      });
    }

    const result = await providerService.verifyLocation(ghanaPostGPS, coordinates);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return handleError(res, error, "Failed to verify location");
  }
};

/**
 * Handler: Geocode Address
 * POST /api/providers/geocode
 * Body: { address }
 */
export const geocodeAddressHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        success: false,
        message: "Address is required",
      });
    }

    const result = await providerService.geocodeAddress(address);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || "Failed to geocode address",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        coordinates: result.coordinates,
        displayName: result.displayName,
      },
    });
  } catch (error) {
    return handleError(res, error, "Failed to geocode address");
  }
};