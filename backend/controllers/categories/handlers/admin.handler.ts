// controllers/handlers/admin.handler.ts
import { Request, Response } from "express";
import { CategoryService } from "../../../services/category.service";
import {
  handleError,
  validateObjectId,
  AuthenticatedRequest,
} from "../../../utils/controller-utils/controller.utils";

/**
 * Category Admin Handler
 *
 * Handles administrative operations for categories
 */
export class CategoryAdminHandler {
  private categoryService: CategoryService;

  constructor() {
    this.categoryService = new CategoryService();
  }

  /**
   * Get all categories (admin function)
   * GET /api/categories/admin/all
   */
  getAllCategories = async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = parseInt(req.query.skip as string) || 0;
      const includeDeleted = req.query.includeDeleted === "true";

      const result = await this.categoryService.getAllCategories(
        limit,
        skip,
        includeDeleted
      );

      return res.status(200).json({
        success: true,
        data: result.categories,
        pagination: {
          total: result.total,
          limit,
          skip,
          hasMore: result.hasMore,
        },
      });
    } catch (error) {
      return handleError(res, error, "Failed to get all categories");
    }
  };

  /**
   * Get category statistics
   * GET /api/categories/stats
   */
  getCategoryStats = async (req: Request, res: Response) => {
    try {
      const { categoryId } = req.query;

      const stats = await this.categoryService.getCategoryStats(
        categoryId as string
      );

      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      return handleError(res, error, "Failed to get category statistics");
    }
  };

  /**
   * Check if category exists
   * GET /api/categories/:id/exists
   */
  checkCategoryExists = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!validateObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }

      const exists = await this.categoryService.categoryExists(id);

      return res.status(200).json({
        success: true,
        data: { exists },
      });
    } catch (error) {
      return handleError(res, error, "Failed to check category existence");
    }
  };

  /**
   * Check if slug is available
   * GET /api/categories/slug/:slug/available
   */
  checkSlugAvailability = async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const { excludeCategoryId } = req.query;

      if (!slug) {
        return res.status(400).json({
          success: false,
          message: "Slug is required",
        });
      }

      const isAvailable = await this.categoryService.isSlugAvailable(
        slug,
        excludeCategoryId as string
      );

      return res.status(200).json({
        success: true,
        data: { available: isAvailable },
      });
    } catch (error) {
      return handleError(res, error, "Failed to check slug availability");
    }
  };

  /**
   * Get category image status (debugging tool)
   * GET /api/categories/:id/image-status
   */
  getCategoryImageStatus = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!validateObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }

      const status = await this.categoryService.getCategoryImageStatus(id);

      return res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      return handleError(res, error, "Failed to get image status");
    }
  };

  /**
   * Repair broken category cover image links
   * POST /api/categories/repair-cover-links
   */
  repairCoverLinks = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { categoryId } = req.body;

      if (categoryId && !validateObjectId(categoryId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }

      const result = await this.categoryService.repairCategoryCoverLinks(
        categoryId
      );

      return res.status(200).json({
        success: true,
        message: "Cover image links repaired successfully",
        data: result,
      });
    } catch (error) {
      return handleError(res, error, "Failed to repair cover links");
    }
  };

  /**
   * Bulk update categories
   * PUT /api/categories/bulk-update
   */
  bulkUpdateCategories = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { categoryIds, updates } = req.body;
      const userId = req.user?.userId;

      if (!categoryIds || !Array.isArray(categoryIds)) {
        return res.status(400).json({
          success: false,
          message: "Category IDs array is required",
        });
      }

      if (!updates || typeof updates !== "object") {
        return res.status(400).json({
          success: false,
          message: "Updates object is required",
        });
      }

      const invalidIds = categoryIds.filter((id) => !validateObjectId(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid category IDs found",
          data: { invalidIds },
        });
      }

      const result = await this.categoryService.bulkUpdateCategories(
        categoryIds,
        updates,
        userId
      );

      return res.status(200).json({
        success: true,
        message: `${result.modifiedCount} categories updated successfully`,
        data: result,
      });
    } catch (error) {
      return handleError(res, error, "Failed to bulk update categories");
    }
  };

  /**
   * Toggle category active status
   * PATCH /api/categories/:id/toggle-active
   */
  toggleActiveStatus = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      if (!validateObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }

      const category = await this.categoryService.toggleActiveStatus(
        id,
        userId
      );

      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: `Category ${
          category.isActive ? "activated" : "deactivated"
        } successfully`,
        data: category,
      });
    } catch (error) {
      return handleError(res, error, "Failed to toggle category status");
    }
  };
}
