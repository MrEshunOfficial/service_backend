// handlers/provider-profile/retriever-provider.handlers.ts
import { Response } from "express";
import { 
  ProviderProfileService, 
  PopulationLevel 
} from "../../../../../services/profiles/provider.profile.service";
import { Coordinates } from "../../../../../types/base.types";
import { AuthenticatedRequest } from "../../../../../types/user.types";
import { validateObjectId, handleError } from "../../../../../utils/controller-utils/controller.utils";

const providerService = new ProviderProfileService();

/**
 * Helper: Parse Population Level from Query
 */
const parsePopulationLevel = (
  level: unknown,
  defaultLevel?: PopulationLevel
): PopulationLevel | undefined => {
  if (level && typeof level === 'string' && Object.values(PopulationLevel).includes(level as PopulationLevel)) {
    return level as PopulationLevel;
  }
  return defaultLevel;
};

/**
 * Handler: Get Provider Profile by ID
 * GET /api/providers/:providerId
 * Query params: populationLevel (optional), includeDeleted (optional)
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

    const level = parsePopulationLevel(populationLevel, PopulationLevel.DETAILED);

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
 * Query params: populationLevel (optional)
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

    const level = parsePopulationLevel(populationLevel, PopulationLevel.STANDARD);

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
 * Query params: populationLevel (optional)
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

    const level = parsePopulationLevel(populationLevel, PopulationLevel.DETAILED);

    // Use getProviderByUserId instead of getProviderByProfile
    const provider = await providerService.getProviderByUserId(userId, level);

    if (!provider) {
      // Provide more helpful error message with debugging info
      return res.status(404).json({
        success: false,
        message: "Provider profile not found. Please create one first.",
        debug: {
          userId: userId,
          hint: "Make sure you have created a provider profile and your user profile exists"
        }
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
    const level = parsePopulationLevel(populationLevel);

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

    const level = parsePopulationLevel(populationLevel, PopulationLevel.MINIMAL);

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

    const level = parsePopulationLevel(populationLevel);

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