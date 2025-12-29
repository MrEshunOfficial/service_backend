// handlers/profiles/client/base.handler.ts
import { Response } from "express";
import { clientProfileService } from "../../../../services/profiles/client.profile.service";
import { AuthenticatedRequest } from "../../../../types/user.types";
import { handleError } from "../../../../utils/controller-utils/controller.utils";

/**
 * Base Client Handlers
 * Handles utility and statistics endpoints for client profiles
 */
export class BaseClientHandlers {
  /**
   * GET /api/clients/health
   * Health check endpoint
   */
  async healthCheck(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        message: "Client profile service is healthy",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      handleError(res, error, "Health check failed");
    }
  }

  /**
   * GET /api/clients/statistics
   * Get platform-wide client statistics
   */
  async getStatistics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const stats = await clientProfileService.getPlatformClientStats();

      res.status(200).json({
        success: true,
        message: "Platform statistics retrieved successfully",
        data: { stats },
      });
    } catch (error) {
      handleError(res, error, "Failed to retrieve platform statistics");
    }
  }

  /**
   * GET /api/clients/regions
   * Get list of available regions with client counts
   */
  async getAvailableRegions(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const stats = await clientProfileService.getPlatformClientStats();
      const regions = stats.clientsByRegion;

      res.status(200).json({
        success: true,
        message: "Available regions retrieved successfully",
        data: { regions, total: regions.length },
      });
    } catch (error) {
      handleError(res, error, "Failed to retrieve available regions");
    }
  }

  /**
   * GET /api/clients/verified
   * Get all verified clients with pagination
   */
  async getAllVerifiedClients(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const {
        limit = "20",
        skip = "0",
        populationLevel = "minimal",
      } = req.query;

      const result = await clientProfileService.getAllVerifiedClients({
        limit: parseInt(limit as string),
        skip: parseInt(skip as string),
        populationLevel: populationLevel as any,
      });

      res.status(200).json({
        success: true,
        message: "Verified clients retrieved successfully",
        data: {
          clients: result.clients,
          total: result.total,
          limit: parseInt(limit as string),
          skip: parseInt(skip as string),
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to retrieve verified clients");
    }
  }
}

export default new BaseClientHandlers();
