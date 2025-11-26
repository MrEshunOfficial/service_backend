// controllers/service/handlers/crud.handler.ts

import { Response } from "express";
import { Types } from "mongoose";
import {
  handleError,
  validateObjectId,
  AuthenticatedRequest,
} from "../../../utils/controller-utils/controller.utils";
import {
  serviceService,
  CreateServiceDTO,
  UpdateServiceDTO,
} from "../../../services/service.service";
import { BaseServiceHandler } from "./base.handler";

export class ServiceCRUDHandler extends BaseServiceHandler {
  /**
   * Create a new service
   * POST /api/services
   */
  public createService = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const {
        title,
        description,
        tags,
        categoryId,
        coverImage,
        providerId,
        servicePricing,
        isPrivate,
      } = req.body;

      // Validation
      if (!title || !description || !categoryId) {
        res.status(400).json({
          success: false,
          message: "Title, description, and category are required",
        });
        return;
      }

      if (!validateObjectId(categoryId)) {
        res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
        return;
      }

      if (providerId && !validateObjectId(providerId)) {
        res.status(400).json({
          success: false,
          message: "Invalid provider ID",
        });
        return;
      }

      if (coverImage && !validateObjectId(coverImage)) {
        res.status(400).json({
          success: false,
          message: "Invalid cover image ID",
        });
        return;
      }

      // Only admin can create private services
      if (isPrivate && req.user?.role !== "admin") {
        res.status(403).json({
          success: false,
          message: "Only admins can create private services",
        });
        return;
      }

      // Check for duplicate service
      const existingService = await serviceService.checkDuplicateService(
        title,
        categoryId,
        providerId
      );

      if (existingService) {
        res.status(409).json({
          success: false,
          message:
            "A service with this title already exists in the selected category",
          data: {
            // existingServiceId: existingService._id,
            existingServiceSlug: existingService.slug,
            existingServiceTitle: existingService.title,
          },
        });
        return;
      }

      const serviceData: CreateServiceDTO = {
        title,
        description,
        tags,
        categoryId,
        coverImage,
        providerId,
        servicePricing,
        isPrivate: isPrivate ?? false,
        submittedBy: req.user?.id,
      };

      const service = await serviceService.createService(serviceData);

      res.status(201).json({
        success: true,
        message: "Service created successfully",
        data: service,
      });
    } catch (error) {
      handleError(res, error, "Error creating service");
    }
  };

  /**
   * Update service
   * PUT /api/services/:id
   */
  public updateService = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;

      if (!this.validateServiceId(id, res)) return;
      if (!(await this.canModifyService(id, req, res))) return;

      const updateData: UpdateServiceDTO = req.body;

      // Only admin can update isPrivate
      if (updateData.isPrivate !== undefined && req.user?.role !== "admin") {
        res.status(403).json({
          success: false,
          message: "Only admins can change service privacy",
        });
        return;
      }

      // Validate ObjectIds if provided
      if (updateData.categoryId && !validateObjectId(updateData.categoryId)) {
        res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
        return;
      }

      if (updateData.coverImage && !validateObjectId(updateData.coverImage)) {
        res.status(400).json({
          success: false,
          message: "Invalid cover image ID",
        });
        return;
      }

      const service = await serviceService.updateService(id, updateData);

      res.status(200).json({
        success: true,
        message: "Service updated successfully",
        data: service,
      });
    } catch (error) {
      handleError(res, error, "Error updating service");
    }
  };

  /**
   * Update service cover image
   * PATCH /api/services/:id/cover-image
   */
  public updateCoverImage = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { coverImageId } = req.body;

      if (!this.validateServiceId(id, res)) return;

      if (coverImageId !== null && !validateObjectId(coverImageId)) {
        res.status(400).json({
          success: false,
          message: "Invalid cover image ID",
        });
        return;
      }

      if (!(await this.canModifyService(id, req, res))) return;

      const objectId = coverImageId ? new Types.ObjectId(coverImageId) : null;

      const service = await serviceService.updateCoverImage(
        id,
        objectId,
        req.user?.id
      );

      res.status(200).json({
        success: true,
        message: "Cover image updated successfully",
        data: service,
      });
    } catch (error) {
      handleError(res, error, "Error updating cover image");
    }
  };

  /**
   * Delete service (soft delete)
   * DELETE /api/services/:id
   */
  public deleteService = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;

      if (!this.validateServiceId(id, res)) return;
      if (!(await this.canModifyService(id, req, res))) return;

      const success = await serviceService.deleteService(id);

      if (!success) {
        res.status(404).json({
          success: false,
          message: "Service not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Service deleted successfully",
      });
    } catch (error) {
      handleError(res, error, "Error deleting service");
    }
  };
}
