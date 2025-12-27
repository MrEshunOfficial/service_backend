// handlers/profiles/provider/provider-search.handlers.ts
import { Response } from "express";
import { ProviderProfileService } from "../../../../services/profiles/provider.profile.service";
import { Coordinates } from "../../../../types/base.types";
import { AuthenticatedRequest } from "../../../../types/user.types";
import {
  validateObjectId,
  handleError,
} from "../../../../utils/controller-utils/controller.utils";
import { PopulationLevel } from "../../../../types/profiles/providerProfile.types";

/**
 * Provider Search Handlers
 * Discovery and search operations for finding providers
 * Integrates with location services and filtering capabilities
 */
export class ProviderSearchHandlers {
  private providerService: ProviderProfileService;

  constructor() {
    this.providerService = new ProviderProfileService();
  }

  /**
   * POST /api/providers/search/nearest
   * Find nearest providers to user location using GPS coordinates
   * Returns providers sorted by distance with calculated distances
   */
  async findNearestProviders(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const {
        latitude,
        longitude,
        maxDistance = 50,
        limit = 10,
        serviceId,
        categoryId,
        populationLevel = "standard",
      } = req.body;

      // Validate coordinates
      if (
        !latitude ||
        !longitude ||
        typeof latitude !== "number" ||
        typeof longitude !== "number"
      ) {
        res.status(400).json({
          success: false,
          message: "Valid latitude and longitude are required",
        });
        return;
      }

      // Validate coordinate ranges
      if (
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        res.status(400).json({
          success: false,
          message:
            "Invalid coordinate values. Latitude must be between -90 and 90, longitude between -180 and 180",
        });
        return;
      }

      const userLocation: Coordinates = { latitude, longitude };

      // Validate optional IDs
      if (serviceId && !validateObjectId(serviceId)) {
        res.status(400).json({
          success: false,
          message: "Invalid service ID format",
        });
        return;
      }

      if (categoryId && !validateObjectId(categoryId)) {
        res.status(400).json({
          success: false,
          message: "Invalid category ID format",
        });
        return;
      }

      const results = await this.providerService.findNearestProviders(
        userLocation,
        {
          maxDistance,
          limit,
          serviceId,
          categoryId,
          populationLevel: populationLevel as PopulationLevel,
        }
      );

      res.status(200).json({
        success: true,
        message: `Found ${results.length} nearby provider${
          results.length !== 1 ? "s" : ""
        }`,
        data: {
          providers: results,
          searchCenter: userLocation,
          maxDistanceKm: maxDistance,
          count: results.length,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to find nearest providers");
    }
  }

  /**
   * GET /api/providers/search/location
   * Find providers by region and/or city
   * Used for location-based browsing without GPS coordinates
   */
  async findProvidersByLocation(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const {
        region,
        city,
        serviceId,
        limit = "20",
        populationLevel = "minimal",
      } = req.query;

      if (!region) {
        res.status(400).json({
          success: false,
          message: "Region is required",
        });
        return;
      }

      if (serviceId && !validateObjectId(serviceId as string)) {
        res.status(400).json({
          success: false,
          message: "Invalid service ID format",
        });
        return;
      }

      const providers = await this.providerService.findProvidersByLocation(
        region as string,
        city as string | undefined,
        {
          serviceId: serviceId as string | undefined,
          limit: parseInt(limit as string),
          populationLevel: populationLevel as PopulationLevel,
        }
      );

      res.status(200).json({
        success: true,
        message: `Found ${providers.length} provider${
          providers.length !== 1 ? "s" : ""
        } in ${region}${city ? `, ${city}` : ""}`,
        data: {
          providers,
          count: providers.length,
          filters: {
            region,
            city: city || null,
            serviceId: serviceId || null,
          },
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to find providers by location");
    }
  }

  /**
   * POST /api/providers/search
   * Advanced provider search with multiple filters
   * Combines location, service, and attribute-based filtering
   */
  async searchProviders(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
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
        limit = 20,
        skip = 0,
        populationLevel = "standard",
      } = req.body;

      // Validate serviceIds array if provided
      if (serviceIds) {
        if (!Array.isArray(serviceIds)) {
          res.status(400).json({
            success: false,
            message: "serviceIds must be an array",
          });
          return;
        }

        for (const id of serviceIds) {
          if (!validateObjectId(id)) {
            res.status(400).json({
              success: false,
              message: `Invalid service ID: ${id}`,
            });
            return;
          }
        }
      }

      // Validate categoryId if provided
      if (categoryId && !validateObjectId(categoryId)) {
        res.status(400).json({
          success: false,
          message: "Invalid category ID format",
        });
        return;
      }

      // Validate userLocation if provided
      if (userLocation) {
        if (
          typeof userLocation.latitude !== "number" ||
          typeof userLocation.longitude !== "number"
        ) {
          res.status(400).json({
            success: false,
            message:
              "Invalid user location format. Both latitude and longitude must be numbers",
          });
          return;
        }

        if (
          userLocation.latitude < -90 ||
          userLocation.latitude > 90 ||
          userLocation.longitude < -180 ||
          userLocation.longitude > 180
        ) {
          res.status(400).json({
            success: false,
            message: "Invalid coordinate values",
          });
          return;
        }
      }

      const results = await this.providerService.searchProviders({
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
        populationLevel: populationLevel as PopulationLevel,
      });

      res.status(200).json({
        success: true,
        message: `Found ${results.providers.length} provider${
          results.providers.length !== 1 ? "s" : ""
        }`,
        data: {
          providers: results.providers,
          total: results.total,
          limit,
          skip,
          hasMore: results.total > skip + results.providers.length,
          filters: {
            searchTerm: searchTerm || null,
            region: region || null,
            city: city || null,
            serviceIds: serviceIds || null,
            categoryId: categoryId || null,
            isCompanyTrained: isCompanyTrained ?? null,
            requireInitialDeposit: requireInitialDeposit ?? null,
            maxDistance: maxDistance || null,
          },
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to search providers");
    }
  }

  /**
   * POST /api/providers/:providerId/distance
   * Calculate distance from customer location to specific provider
   */
  async getDistanceToProvider(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { providerId } = req.params;
      const { latitude, longitude } = req.body;

      if (!validateObjectId(providerId)) {
        res.status(400).json({
          success: false,
          message: "Invalid provider ID format",
        });
        return;
      }

      if (
        !latitude ||
        !longitude ||
        typeof latitude !== "number" ||
        typeof longitude !== "number"
      ) {
        res.status(400).json({
          success: false,
          message: "Valid customer latitude and longitude are required",
        });
        return;
      }

      const customerLocation: Coordinates = { latitude, longitude };

      const result = await this.providerService.getDistanceToProvider(
        customerLocation,
        providerId
      );

      if (!result) {
        res.status(404).json({
          success: false,
          message:
            "Provider not found or does not have location coordinates set",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Distance calculated successfully",
        data: {
          providerId,
          distance: {
            kilometers: result.distanceKm,
            formatted: result.distanceFormatted,
          },
          customerLocation,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to calculate distance to provider");
    }
  }

  /**
   * GET /api/providers/search/by-service/:serviceId
   * Find all providers offering a specific service
   */
  async findProvidersByService(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { serviceId } = req.params;
      const {
        limit = "20",
        skip = "0",
        populationLevel = "minimal",
      } = req.query;

      if (!validateObjectId(serviceId)) {
        res.status(400).json({
          success: false,
          message: "Invalid service ID format",
        });
        return;
      }

      const results = await this.providerService.searchProviders({
        serviceIds: [serviceId],
        limit: parseInt(limit as string),
        skip: parseInt(skip as string),
        populationLevel: populationLevel as PopulationLevel,
      });

      res.status(200).json({
        success: true,
        message: `Found ${results.providers.length} provider${
          results.providers.length !== 1 ? "s" : ""
        } offering this service`,
        data: {
          serviceId,
          providers: results.providers,
          total: results.total,
          limit: parseInt(limit as string),
          skip: parseInt(skip as string),
          hasMore:
            results.total > parseInt(skip as string) + results.providers.length,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to find providers by service");
    }
  }

  /**
   * POST /api/providers/search/nearby-services
   * Find providers offering specific services near user location
   * Combines service filtering with proximity search
   */
  async findNearbyServiceProviders(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const {
        latitude,
        longitude,
        serviceIds,
        maxDistance = 30,
        limit = 10,
        populationLevel = "standard",
      } = req.body;

      // Validate coordinates
      if (
        !latitude ||
        !longitude ||
        typeof latitude !== "number" ||
        typeof longitude !== "number"
      ) {
        res.status(400).json({
          success: false,
          message: "Valid latitude and longitude are required",
        });
        return;
      }

      // Validate serviceIds
      if (
        !serviceIds ||
        !Array.isArray(serviceIds) ||
        serviceIds.length === 0
      ) {
        res.status(400).json({
          success: false,
          message: "At least one service ID is required",
        });
        return;
      }

      // Validate each service ID
      for (const id of serviceIds) {
        if (!validateObjectId(id)) {
          res.status(400).json({
            success: false,
            message: `Invalid service ID: ${id}`,
          });
          return;
        }
      }

      const userLocation: Coordinates = { latitude, longitude };

      const results = await this.providerService.searchProviders({
        serviceIds,
        userLocation,
        maxDistance,
        limit,
        populationLevel: populationLevel as PopulationLevel,
      });

      // Filter to only include providers with distance info (those with GPS coordinates)
      const providersWithDistance = results.providers.filter(
        (p) => p.distance !== undefined
      );

      res.status(200).json({
        success: true,
        message: `Found ${
          providersWithDistance.length
        } nearby service provider${
          providersWithDistance.length !== 1 ? "s" : ""
        }`,
        data: {
          providers: providersWithDistance,
          searchCenter: userLocation,
          maxDistanceKm: maxDistance,
          serviceIds,
          count: providersWithDistance.length,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to find nearby service providers");
    }
  }

  /**
   * GET /api/providers/search/company-trained
   * Find company-trained providers with optional location filtering
   */
  async findCompanyTrainedProviders(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const {
        region,
        city,
        limit = "20",
        skip = "0",
        populationLevel = "minimal",
      } = req.query;

      const results = await this.providerService.searchProviders({
        isCompanyTrained: true,
        region: region as string | undefined,
        city: city as string | undefined,
        limit: parseInt(limit as string),
        skip: parseInt(skip as string),
        populationLevel: populationLevel as PopulationLevel,
      });

      res.status(200).json({
        success: true,
        message: `Found ${results.providers.length} company-trained provider${
          results.providers.length !== 1 ? "s" : ""
        }`,
        data: {
          providers: results.providers,
          total: results.total,
          limit: parseInt(limit as string),
          skip: parseInt(skip as string),
          hasMore:
            results.total > parseInt(skip as string) + results.providers.length,
          filters: {
            isCompanyTrained: true,
            region: region || null,
            city: city || null,
          },
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to find company-trained providers");
    }
  }
}

export default new ProviderSearchHandlers();
