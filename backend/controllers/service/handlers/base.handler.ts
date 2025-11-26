//controllers/service/handlers/base.handler.ts

import { Response } from "express";
import {
  validateObjectId,
  AuthenticatedRequest,
} from "../../../utils/controller-utils/controller.utils";
import {
  serviceService,
  ProviderAccessLevel,
} from "../../../services/service.service";

export class BaseServiceHandler {
  /**
   * Get user access level from role
   */
  protected getUserAccessLevel(role?: string): ProviderAccessLevel {
    switch (role) {
      case "admin":
        return ProviderAccessLevel.ADMIN;
      case "company_trained":
        return ProviderAccessLevel.COMPANY_TRAINED;
      case "verified":
        return ProviderAccessLevel.VERIFIED;
      default:
        return ProviderAccessLevel.STANDARD;
    }
  }

  /**
   * Check if user is admin
   */
  protected isAdmin(req: AuthenticatedRequest, res: Response): boolean {
    if (req.user?.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Only admins can perform this action",
      });
      return false;
    }
    return true;
  }

  /**
   * Validate service ID
   */
  protected validateServiceId(id: string, res: Response): boolean {
    if (!validateObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid service ID",
      });
      return false;
    }
    return true;
  }

  /**
   * Check if user can modify service
   */
  protected async canModifyService(
    serviceId: string,
    req: AuthenticatedRequest,
    res: Response
  ): Promise<boolean> {
    const service = await serviceService.getServiceById(serviceId);

    if (!service) {
      res.status(404).json({
        success: false,
        message: "Service not found",
      });
      return false;
    }

    if (
      req.user?.role !== "admin" &&
      service.submittedBy?.toString() !== req.user?.id
    ) {
      res.status(403).json({
        success: false,
        message: "Not authorized to modify this service",
      });
      return false;
    }

    return true;
  }

  /**
   * Check access for private services
   */
  protected checkPrivateAccess(
    service: any,
    req: AuthenticatedRequest,
    res: Response
  ): boolean {
    if (service.isPrivate) {
      const userAccessLevel = this.getUserAccessLevel(req.user?.role);
      if (userAccessLevel === ProviderAccessLevel.STANDARD) {
        res.status(403).json({
          success: false,
          message: "Access denied to private service",
        });
        return false;
      }
    }
    return true;
  }
}
