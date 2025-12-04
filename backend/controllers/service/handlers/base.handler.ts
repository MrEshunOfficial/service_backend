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
   * Get user access level based on user properties
   */
  protected getUserAccessLevel(user?: any): ProviderAccessLevel {
    if (!user) return ProviderAccessLevel.STANDARD;
    
    // Admin and Super Admin get full access
    if (user.isAdmin || user.isSuperAdmin) {
      return ProviderAccessLevel.ADMIN;
    }
    
    // Add other access levels based on your user model properties
    // Uncomment and modify these based on your actual user schema:
    // if (user.isCompanyTrained) {
    //   return ProviderAccessLevel.COMPANY_TRAINED;
    // }
    // if (user.isVerified || user.isEmailVerified) {
    //   return ProviderAccessLevel.VERIFIED;
    // }
    
    return ProviderAccessLevel.STANDARD;
  }

  /**
   * Check if user is admin or super admin
   */
  protected isAdmin(req: AuthenticatedRequest, res: Response): boolean {
    if (!req.user?.isAdmin && !req.user?.isSuperAdmin) {
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

    // Admins can modify any service, otherwise check ownership
    if (
      !req.user?.isAdmin &&
      !req.user?.isSuperAdmin &&
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
      const userAccessLevel = this.getUserAccessLevel(req.user);
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