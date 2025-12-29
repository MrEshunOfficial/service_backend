// handlers/profiles/client/search.handler.ts
import { Response } from "express";
import {
  clientProfileService,
  PopulationLevel,
} from "../../../../services/profiles/client.profile.service";
import { Coordinates } from "../../../../types/base.types";
import { AuthenticatedRequest } from "../../../../types/user.types";
import {
  handleError,
  validateObjectId,
} from "../../../../utils/controller-utils/controller.utils";

/**
 * Client Search Handlers
 * Handles search and discovery operations for client profiles
 */
export class ClientSearchHandlers {
  /**
   * POST /api/clients/search/nearest
   * Find nearest clients to a location
   */
  async findNearestClients(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const {
        latitude,
        longitude,
        maxDistance,
        limit,
        isVerified,
        hasDefaultAddress,
      } = req.body;

      if (!latitude || !longitude) {
        res.status(400).json({
          success: false,
          message: "Latitude and longitude are required",
        });
        return;
      }

      const targetLocation: Coordinates = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      };

      const options = {
        maxDistance: maxDistance ? parseFloat(maxDistance) : 50,
        limit: limit ? parseInt(limit) : 10,
        isVerified:
          isVerified !== undefined
            ? isVerified === "true" || isVerified === true
            : undefined,
        hasDefaultAddress:
          hasDefaultAddress !== undefined
            ? hasDefaultAddress === "true" || hasDefaultAddress === true
            : undefined,
      };

      const results = await clientProfileService.findNearestClients(
        targetLocation,
        options
      );

      res.status(200).json({
        success: true,
        message: `Found ${results.length} nearby clients`,
        data: {
          targetLocation,
          results,
          total: results.length,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to find nearest clients");
    }
  }

  /**
   * GET /api/clients/search/location
   * Find clients by region and city
   */
  async findClientsByLocation(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const {
        region,
        city,
        limit = "20",
        populationLevel = "minimal",
        isVerified,
      } = req.query;

      if (!region) {
        res.status(400).json({
          success: false,
          message: "Region is required",
        });
        return;
      }

      const options = {
        limit: parseInt(limit as string),
        populationLevel: populationLevel as PopulationLevel,
        isVerified:
          isVerified !== undefined ? isVerified === "true" : undefined,
      };

      const clients = await clientProfileService.findClientsByLocation(
        region as string,
        city as string,
        options
      );

      res.status(200).json({
        success: true,
        message: "Clients retrieved successfully",
        data: {
          clients,
          total: clients.length,
          filters: { region, city, isVerified },
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to find clients by location");
    }
  }

  /**
   * GET /api/clients/search
   * Advanced client search with multiple filters
   */
  async searchClients(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        searchTerm,
        region,
        city,
        isVerified,
        hasDefaultAddress,
        limit = "20",
        skip = "0",
        populationLevel = "standard",
      } = req.query;

      const params = {
        searchTerm: searchTerm as string,
        region: region as string,
        city: city as string,
        isVerified:
          isVerified !== undefined ? isVerified === "true" : undefined,
        hasDefaultAddress:
          hasDefaultAddress !== undefined
            ? hasDefaultAddress === "true"
            : undefined,
        limit: parseInt(limit as string),
        skip: parseInt(skip as string),
        populationLevel: populationLevel as PopulationLevel,
      };

      const result = await clientProfileService.searchClients(params);

      res.status(200).json({
        success: true,
        message: "Client search completed successfully",
        data: {
          clients: result.clients,
          total: result.total,
          limit: params.limit,
          skip: params.skip,
          filters: {
            searchTerm,
            region,
            city,
            isVerified,
            hasDefaultAddress,
          },
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to search clients");
    }
  }

  /**
   * GET /api/clients/favorites/service/:serviceId
   * Get clients who favorited a specific service
   */
  async getClientsByFavoriteService(
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

      const options = {
        limit: parseInt(limit as string),
        skip: parseInt(skip as string),
        populationLevel: populationLevel as PopulationLevel,
      };

      const result = await clientProfileService.getClientsByFavoriteService(
        serviceId,
        options
      );

      res.status(200).json({
        success: true,
        message: "Clients retrieved successfully",
        data: {
          clients: result.clients,
          total: result.total,
          serviceId,
          limit: options.limit,
          skip: options.skip,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to retrieve clients by favorite service");
    }
  }

  /**
   * GET /api/clients/favorites/provider/:providerId
   * Get clients who favorited a specific provider
   */
  async getClientsByFavoriteProvider(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { providerId } = req.params;
      const {
        limit = "20",
        skip = "0",
        populationLevel = "minimal",
      } = req.query;

      if (!validateObjectId(providerId)) {
        res.status(400).json({
          success: false,
          message: "Invalid provider ID format",
        });
        return;
      }

      const options = {
        limit: parseInt(limit as string),
        skip: parseInt(skip as string),
        populationLevel: populationLevel as PopulationLevel,
      };

      const result = await clientProfileService.getClientsByFavoriteProvider(
        providerId,
        options
      );

      res.status(200).json({
        success: true,
        message: "Clients retrieved successfully",
        data: {
          clients: result.clients,
          total: result.total,
          providerId,
          limit: options.limit,
          skip: options.skip,
        },
      });
    } catch (error) {
      handleError(
        res,
        error,
        "Failed to retrieve clients by favorite provider"
      );
    }
  }
}

export default new ClientSearchHandlers();
