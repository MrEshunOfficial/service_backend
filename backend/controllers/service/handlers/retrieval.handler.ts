// controllers/service/handlers/retrieval.handler.ts
import { Response } from "express";
import {
  handleError,
  AuthenticatedRequest,
} from "../../../utils/controller-utils/controller.utils";
import {
  serviceService,
  ServiceSearchFilters,
  PaginationOptions,
  PopulationLevel,
} from "../../../services/service.service";
import { BaseServiceHandler } from "./base.handler";

export class ServiceRetrievalHandler extends BaseServiceHandler {
  /**
   * Get service by ID with detailed population
   * GET /api/services/:id
   */
  public getServiceById = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;

      if (!this.validateServiceId(id, res)) return;

      // Use DETAILED population for single service view
      const service = await serviceService.getServiceById(id, {
        populationLevel: PopulationLevel.DETAILED,
      });

      if (!service) {
        res.status(404).json({
          success: false,
          message: "Service not found",
        });
        return;
      }

      if (!this.checkPrivateAccess(service, req, res)) return;

      res.status(200).json({
        success: true,
        data: service,
      });
    } catch (error) {
      handleError(res, error, "Error fetching service");
    }
  };

  /**
   * Get service by slug with detailed population
   * GET /api/services/slug/:slug
   */
  public getServiceBySlug = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { slug } = req.params;

      // Use DETAILED population for single service view
      const service = await serviceService.getServiceBySlug(slug, {
        populationLevel: PopulationLevel.DETAILED,
      });

      if (!service) {
        res.status(404).json({
          success: false,
          message: "Service not found",
        });
        return;
      }

      if (!this.checkPrivateAccess(service, req, res)) return;

      res.status(200).json({
        success: true,
        data: service,
      });
    } catch (error) {
      handleError(res, error, "Error fetching service");
    }
  };

  /**
   * Get complete service with full details including file URLs
   * GET /api/services/:id/complete
   */
  public getCompleteService = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;

      if (!this.validateServiceId(id, res)) return;

      // getCompleteService already uses COMPLETE population internally
      const result = await serviceService.getCompleteService(id);

      if (!result.service) {
        res.status(404).json({
          success: false,
          message: "Service not found",
        });
        return;
      }

      if (!this.checkPrivateAccess(result.service, req, res)) return;

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleError(res, error, "Error fetching complete service");
    }
  };

  /**
   * Get public services with minimal population (for lists/dropdowns)
   * GET /api/services/public
   */
  public getPublicServices = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const filters: ServiceSearchFilters = {
        categoryId: req.query.categoryId as string,
        providerId: req.query.providerId as string,
        minPrice: req.query.minPrice
          ? parseFloat(req.query.minPrice as string)
          : undefined,
        maxPrice: req.query.maxPrice
          ? parseFloat(req.query.maxPrice as string)
          : undefined,
        tags: req.query.tags
          ? (req.query.tags as string).split(",")
          : undefined,
      };

      const pagination: PaginationOptions = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        sortBy: (req.query.sortBy as string) || "createdAt",
        sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc",
      };

      // Use MINIMAL population for list views (best performance)
      const result = await serviceService.getPublicServices(
        filters,
        pagination,
        PopulationLevel.STANDARD
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleError(res, error, "Error fetching public services");
    }
  };

  /**
   * Get accessible services based on user access level
   * GET /api/services
   */
  public getAccessibleServices = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userAccessLevel = this.getUserAccessLevel(req.user?.role);

      const filters: ServiceSearchFilters = {
        categoryId: req.query.categoryId as string,
        providerId: req.query.providerId as string,
        minPrice: req.query.minPrice
          ? parseFloat(req.query.minPrice as string)
          : undefined,
        maxPrice: req.query.maxPrice
          ? parseFloat(req.query.maxPrice as string)
          : undefined,
        tags: req.query.tags
          ? (req.query.tags as string).split(",")
          : undefined,
        isActive: req.query.isActive === "true",
      };

      const pagination: PaginationOptions = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        sortBy: (req.query.sortBy as string) || "createdAt",
        sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc",
      };

      // Determine population level based on query parameter or default to STANDARD
      const populationLevel = this.getPopulationLevelFromQuery(req);

      const result = await serviceService.getAccessibleServices(
        userAccessLevel,
        filters,
        pagination,
        populationLevel
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleError(res, error, "Error fetching services");
    }
  };

  /**
   * Get services by category
   * GET /api/services/category/:categoryId
   */
  public getServicesByCategory = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { categoryId } = req.params;

      if (!this.validateServiceId(categoryId, res)) return;

      const userAccessLevel = this.getUserAccessLevel(req.user?.role);

      const pagination: PaginationOptions = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        sortBy: (req.query.sortBy as string) || "createdAt",
        sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc",
      };

      // Use STANDARD population for category browsing
      const populationLevel = this.getPopulationLevelFromQuery(req);

      const result = await serviceService.getServicesByCategory(
        categoryId,
        userAccessLevel,
        pagination,
        populationLevel
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleError(res, error, "Error fetching services by category");
    }
  };

  /**
   * Get services by provider
   * GET /api/services/provider/:providerId
   */
  public getServicesByProvider = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { providerId } = req.params;

      if (!this.validateServiceId(providerId, res)) return;

      const includeInactive =
        req.query.includeInactive === "true" && req.user?.role === "admin";

      const pagination: PaginationOptions = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        sortBy: (req.query.sortBy as string) || "createdAt",
        sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc",
      };

      // Use MINIMAL population for provider service lists
      const populationLevel = this.getPopulationLevelFromQuery(req);

      const result = await serviceService.getServicesByProvider(providerId, {
        includeInactive,
        pagination,
        populationLevel,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleError(res, error, "Error fetching services by provider");
    }
  };

  /**
   * Search services with standard population
   * GET /api/services/search
   */
  public searchServices = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const searchTerm = req.query.q as string;

      if (!searchTerm) {
        res.status(400).json({
          success: false,
          message: "Search term is required",
        });
        return;
      }

      const userAccessLevel = this.getUserAccessLevel(req.user?.role);

      const filters: ServiceSearchFilters = {
        categoryId: req.query.categoryId as string,
        providerId: req.query.providerId as string,
        minPrice: req.query.minPrice
          ? parseFloat(req.query.minPrice as string)
          : undefined,
        maxPrice: req.query.maxPrice
          ? parseFloat(req.query.maxPrice as string)
          : undefined,
        tags: req.query.tags
          ? (req.query.tags as string).split(",")
          : undefined,
      };

      const pagination: PaginationOptions = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      };

      // Use STANDARD population for search results
      const populationLevel = this.getPopulationLevelFromQuery(req);

      const result = await serviceService.searchServices(
        searchTerm,
        userAccessLevel,
        filters,
        pagination,
        populationLevel
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleError(res, error, "Error searching services");
    }
  };

  /**
   * Check service accessibility (minimal query)
   * GET /api/services/:id/accessible
   */
  public checkServiceAccessibility = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;

      if (!this.validateServiceId(id, res)) return;

      const userAccessLevel = this.getUserAccessLevel(req.user?.role);
      const isAccessible = await serviceService.isServiceAccessible(
        id,
        userAccessLevel
      );

      res.status(200).json({
        success: true,
        data: { accessible: isAccessible },
      });
    } catch (error) {
      handleError(res, error, "Error checking service accessibility");
    }
  };

  /**
   * Helper: Get population level from query parameter
   * Allows frontend to control population depth
   * Query param: ?populate=none|minimal|standard|detailed|complete
   */
  private getPopulationLevelFromQuery(
    req: AuthenticatedRequest
  ): PopulationLevel {
    const populate = req.query.populate as string;

    switch (populate?.toLowerCase()) {
      case "none":
        return PopulationLevel.NONE;
      case "minimal":
        return PopulationLevel.MINIMAL;
      case "standard":
        return PopulationLevel.STANDARD;
      case "detailed":
        return PopulationLevel.DETAILED;
      case "complete":
        return PopulationLevel.COMPLETE;
      default:
        // Default based on endpoint type
        // For list endpoints, default to MINIMAL
        // For search/browse, default to STANDARD
        return PopulationLevel.STANDARD;
    }
  }
}
