// handlers/profiles/provider/base.handlers.ts
import { Response } from "express";
import { ProviderModel } from "../../../../models/profiles/provider.model";
import { ProviderProfileService } from "../../../../services/profiles/provider.profile.service";
import { AuthenticatedRequest } from "../../../../types/user.types";
import { handleError } from "../../../../utils/controller-utils/controller.utils";

/**
 * Base Provider Handlers
 * Common operations like health checks, statistics, utility functions
 * Provides foundational endpoints used across the provider system
 */
export class BaseProviderHandlers {
  private providerService: ProviderProfileService;

  constructor() {
    this.providerService = new ProviderProfileService();
  }

  /**
   * GET /api/providers/health
   * Check service health and connectivity
   * Used for monitoring and diagnostics
   */
  async healthCheck(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Test database connectivity by attempting a simple query
      const providerCount = await ProviderModel.countDocuments({
        isDeleted: false,
      });

      res.status(200).json({
        success: true,
        message: "Provider service is healthy",
        data: {
          status: "operational",
          timestamp: new Date().toISOString(),
          services: {
            database: "connected",
            providerCount,
            locationService: "available",
            fileService: "available",
          },
        },
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        message: "Provider service is unhealthy",
        data: {
          status: "degraded",
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }

  /**
   * GET /api/providers/stats
   * Get provider statistics
   * Public endpoint for general statistics
   */
  async getStatistics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Aggregate statistics
      const [totalProviders, companyTrained, byRegion, withLocation] =
        await Promise.all([
          ProviderModel.countDocuments({ isDeleted: false }),
          ProviderModel.countDocuments({
            isCompanyTrained: true,
            isDeleted: false,
          }),
          ProviderModel.aggregate([
            { $match: { isDeleted: false } },
            {
              $group: {
                _id: "$locationData.region",
                count: { $sum: 1 },
              },
            },
          ]),
          ProviderModel.countDocuments({
            "locationData.gpsCoordinates": { $exists: true },
            isDeleted: false,
          }),
        ]);

      // Transform region data
      const regionStats: Record<string, number> = {};
      byRegion.forEach((item) => {
        if (item._id) {
          regionStats[item._id] = item.count;
        }
      });

      res.status(200).json({
        success: true,
        message: "Provider statistics retrieved successfully",
        data: {
          totalProviders,
          activeProviders: totalProviders,
          companyTrained,
          withLocation,
          byRegion: regionStats,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to retrieve statistics");
    }
  }

  /**
   * GET /api/providers/regions
   * Get list of regions where providers are available
   * NOTE: For general location operations, use the Location Controller
   * This endpoint is specific to provider distribution analysis
   */
  async getAvailableRegions(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      // Get distinct regions from active providers
      const regions = await ProviderModel.distinct("locationData.region", {
        isDeleted: false,
        "locationData.region": { $exists: true, $ne: null },
      });

      // Remove empty strings and sort
      const validRegions = regions
        .filter((region) => region && region.trim() !== "")
        .sort();

      res.status(200).json({
        success: true,
        message: "Available regions retrieved successfully",
        data: {
          regions: validRegions,
          count: validRegions.length,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to retrieve available regions");
    }
  }

  /**
   * GET /api/providers/cities
   * Get list of cities where providers are available
   * NOTE: For general location operations, use the Location Controller
   * This endpoint is specific to provider distribution analysis
   */
  async getAvailableCities(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { region } = req.query;

      const query: any = {
        isDeleted: false,
        "locationData.city": { $exists: true, $ne: null },
      };

      if (region) {
        query["locationData.region"] = region;
      }

      // Get distinct cities
      const cities = await ProviderModel.distinct("locationData.city", query);

      // Remove empty strings and sort
      const validCities = cities
        .filter((city) => city && city.trim() !== "")
        .sort();

      res.status(200).json({
        success: true,
        message: `Available cities retrieved successfully${
          region ? ` for ${region}` : ""
        }`,
        data: {
          cities: validCities,
          count: validCities.length,
          region: region || null,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to retrieve available cities");
    }
  }

  /**
   * GET /api/providers/service-coverage/:serviceId
   * Get service coverage statistics for a specific service
   * Shows which regions/cities have providers for that service
   */
  async getServiceCoverage(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { serviceId } = req.params;

      // Basic validation (full validation happens in search handlers)
      if (!serviceId) {
        res.status(400).json({
          success: false,
          message: "Service ID is required",
        });
        return;
      }

      // Get providers offering this service
      const providers = await ProviderModel.find({
        serviceOfferings: serviceId,
        isDeleted: false,
      }).select("locationData");

      // Aggregate by region
      const coverage: Record<string, Set<string>> = {};
      providers.forEach((provider) => {
        const region = provider.locationData?.region || "Unknown";
        const city = provider.locationData?.city || "Unknown";

        if (!coverage[region]) {
          coverage[region] = new Set();
        }
        coverage[region].add(city);
      });

      // Convert to serializable format
      const coverageData = Object.entries(coverage).map(([region, cities]) => ({
        region,
        cities: Array.from(cities),
        providerCount: providers.filter(
          (p) => (p.locationData?.region || "Unknown") === region
        ).length,
      }));

      res.status(200).json({
        success: true,
        message: "Service coverage retrieved successfully",
        data: {
          serviceId,
          totalProviders: providers.length,
          coverage: coverageData,
          regionsCount: coverageData.length,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to retrieve service coverage");
    }
  }
}

export default new BaseProviderHandlers();
