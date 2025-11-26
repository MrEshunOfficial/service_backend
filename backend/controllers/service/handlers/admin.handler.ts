// controllers/service/handlers/admin.handler.ts

import { Response } from "express";
import {
  handleError,
  validateObjectId,
  AuthenticatedRequest,
} from "../../../utils/controller-utils/controller.utils";
import {
  serviceService,
  ServiceSearchFilters,
  PaginationOptions,
} from "../../../services/service.service";
import { BaseServiceHandler } from "./base.handler";

export class ServiceAdminHandler extends BaseServiceHandler {
  /**
   * Approve service (Admin only)
   * POST /api/services/:id/approve
   */
  public approveService = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!this.isAdmin(req, res)) return;

      const { id } = req.params;

      if (!this.validateServiceId(id, res)) return;

      const service = await serviceService.approveService(id, req.user!.id);

      if (!service) {
        res.status(404).json({
          success: false,
          message: "Service not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Service approved successfully",
        data: service,
      });
    } catch (error) {
      handleError(res, error, "Error approving service");
    }
  };

  /**
   * Reject service (Admin only)
   * POST /api/services/:id/reject
   */
  public rejectService = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!this.isAdmin(req, res)) return;

      const { id } = req.params;
      const { reason } = req.body;

      if (!this.validateServiceId(id, res)) return;

      if (!reason) {
        res.status(400).json({
          success: false,
          message: "Rejection reason is required",
        });
        return;
      }

      const service = await serviceService.rejectService(
        id,
        req.user!.id,
        reason
      );

      if (!service) {
        res.status(404).json({
          success: false,
          message: "Service not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Service rejected successfully",
        data: service,
      });
    } catch (error) {
      handleError(res, error, "Error rejecting service");
    }
  };

  /**
   * Restore service (Admin only)
   * POST /api/services/:id/restore
   */
  public restoreService = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!this.isAdmin(req, res)) return;

      const { id } = req.params;

      if (!this.validateServiceId(id, res)) return;

      const service = await serviceService.restoreService(id);

      if (!service) {
        res.status(404).json({
          success: false,
          message: "Service not found or not deleted",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Service restored successfully",
        data: service,
      });
    } catch (error) {
      handleError(res, error, "Error restoring service");
    }
  };

  /**
   * Get pending services (Admin only)
   * GET /api/services/pending
   */
  public getPendingServices = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!this.isAdmin(req, res)) return;

      const pagination: PaginationOptions = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        sortBy: (req.query.sortBy as string) || "createdAt",
        sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc",
      };

      const result = await serviceService.getPendingServices(pagination);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleError(res, error, "Error fetching pending services");
    }
  };

  /**
   * Get all services (Admin only)
   * GET /api/services/admin/all
   */
  public getAllServices = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!this.isAdmin(req, res)) return;

      const filters: ServiceSearchFilters = {
        categoryId: req.query.categoryId as string,
        providerId: req.query.providerId as string,
        isActive: req.query.isActive
          ? req.query.isActive === "true"
          : undefined,
        isPrivate: req.query.isPrivate
          ? req.query.isPrivate === "true"
          : undefined,
      };

      const pagination: PaginationOptions = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        sortBy: (req.query.sortBy as string) || "createdAt",
        sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc",
      };

      const result = await serviceService.getAllServices(filters, pagination);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleError(res, error, "Error fetching all services");
    }
  };

  /**
   * Get service statistics (Admin only)
   * GET /api/services/stats
   */
  public getServiceStats = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!this.isAdmin(req, res)) return;

      const stats = await serviceService.getServiceStats();

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      handleError(res, error, "Error fetching service statistics");
    }
  };

  /**
   * Get service image status (Admin/Debug)
   * GET /api/services/:id/image-status
   */
  public getServiceImageStatus = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!this.isAdmin(req, res)) return;

      const { id } = req.params;

      if (!this.validateServiceId(id, res)) return;

      const status = await serviceService.getServiceImageStatus(id);

      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      handleError(res, error, "Error fetching image status");
    }
  };

  /**
   * Repair service cover links (Admin only)
   * POST /api/services/repair-cover-links
   */
  public repairServiceCoverLinks = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!this.isAdmin(req, res)) return;

      const { serviceId } = req.body;

      if (serviceId && !validateObjectId(serviceId)) {
        res.status(400).json({
          success: false,
          message: "Invalid service ID",
        });
        return;
      }

      const result = await serviceService.repairServiceCoverLinks(serviceId);

      res.status(200).json({
        success: true,
        message: "Cover links repair completed",
        data: result,
      });
    } catch (error) {
      handleError(res, error, "Error repairing cover links");
    }
  };

  /**
   * Bulk update services (Admin only)
   * POST /api/services/bulk-update
   */
  public bulkUpdateServices = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!this.isAdmin(req, res)) return;

      const { serviceIds, update } = req.body;

      if (
        !serviceIds ||
        !Array.isArray(serviceIds) ||
        serviceIds.length === 0
      ) {
        res.status(400).json({
          success: false,
          message: "Service IDs array is required",
        });
        return;
      }

      if (!update || typeof update !== "object") {
        res.status(400).json({
          success: false,
          message: "Update object is required",
        });
        return;
      }

      // Validate all IDs
      for (const id of serviceIds) {
        if (!validateObjectId(id)) {
          res.status(400).json({
            success: false,
            message: `Invalid service ID: ${id}`,
          });
          return;
        }
      }

      const modifiedCount = await serviceService.bulkUpdateServices(
        serviceIds,
        update
      );

      res.status(200).json({
        success: true,
        message: `${modifiedCount} services updated successfully`,
        data: { modifiedCount },
      });
    } catch (error) {
      handleError(res, error, "Error performing bulk update");
    }
  };
}
