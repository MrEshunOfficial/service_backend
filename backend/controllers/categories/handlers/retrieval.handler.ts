// controllers/handlers/retrieval.handler.ts
import { Request, Response } from "express";
import { CategoryService } from "../../../services/category.service";
import {
  handleError,
  validateObjectId,
} from "../../../utils/controller-utils/controller.utils";

/**
 * Category Retrieval Handler
 *
 * Handles read operations and queries for categories
 */
export class CategoryRetrievalHandler {
  private categoryService: CategoryService;

  constructor() {
    this.categoryService = new CategoryService();
  }

  /**
   * Get category by ID
   * GET /api/categories/:id
   */
  getCategoryById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const includeDetails = req.query.includeDetails === "true";

      if (!validateObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }

      const category = await this.categoryService.getCategoryById(
        id,
        includeDetails
      );

      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: category,
      });
    } catch (error) {
      return handleError(res, error, "Failed to get category");
    }
  };

  /**
   * Get category by slug
   * GET /api/categories/slug/:slug
   */
  getCategoryBySlug = async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const includeDetails = req.query.includeDetails === "true";

      if (!slug) {
        return res.status(400).json({
          success: false,
          message: "Slug is required",
        });
      }

      const category = await this.categoryService.getCategoryBySlug(
        slug,
        includeDetails
      );

      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: category,
      });
    } catch (error) {
      return handleError(res, error, "Failed to get category");
    }
  };

  /**
   * Get complete category details including cover image URL
   * GET /api/categories/:id/complete
   */
  getCompleteCategory = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!validateObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }

      const result = await this.categoryService.getCompleteCategory(id);

      if (!result.category) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return handleError(res, error, "Failed to get complete category");
    }
  };

  /**
   * Get all active categories
   * GET /api/categories/active
   */
  getActiveCategories = async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = parseInt(req.query.skip as string) || 0;

      const result = await this.categoryService.getActiveCategories(
        limit,
        skip
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
      return handleError(res, error, "Failed to get active categories");
    }
  };

  /**
   * Get top-level categories (no parent)
   * GET /api/categories/top-level
   */
  getTopLevelCategories = async (req: Request, res: Response) => {
    try {
      const includeSubcategories = req.query.includeSubcategories === "true";

      const categories = await this.categoryService.getTopLevelCategories(
        includeSubcategories
      );

      return res.status(200).json({
        success: true,
        data: categories,
      });
    } catch (error) {
      return handleError(res, error, "Failed to get top-level categories");
    }
  };

  /**
   * Get subcategories of a parent category
   * GET /api/categories/:id/subcategories
   */
  getSubcategories = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!validateObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }

      const subcategories = await this.categoryService.getSubcategories(id);

      return res.status(200).json({
        success: true,
        data: subcategories,
      });
    } catch (error) {
      return handleError(res, error, "Failed to get subcategories");
    }
  };

  /**
   * Get category hierarchy (full tree structure)
   * GET /api/categories/hierarchy
   */
  getCategoryHierarchy = async (req: Request, res: Response) => {
    try {
      const hierarchy = await this.categoryService.getCategoryHierarchy();

      return res.status(200).json({
        success: true,
        data: hierarchy,
      });
    } catch (error) {
      return handleError(res, error, "Failed to get category hierarchy");
    }
  };

  /**
   * Search categories
   * GET /api/categories/search
   */
  searchCategories = async (req: Request, res: Response) => {
    try {
      const { q, limit, skip, activeOnly } = req.query;

      if (!q || typeof q !== "string") {
        return res.status(400).json({
          success: false,
          message: "Search query is required",
        });
      }

      const limitNum = parseInt(limit as string) || 20;
      const skipNum = parseInt(skip as string) || 0;
      const activeOnlyBool = activeOnly !== "false";

      const result = await this.categoryService.searchCategories(
        q,
        limitNum,
        skipNum,
        activeOnlyBool
      );

      return res.status(200).json({
        success: true,
        data: result.categories,
        pagination: {
          total: result.total,
          limit: limitNum,
          skip: skipNum,
          hasMore: result.hasMore,
        },
      });
    } catch (error) {
      return handleError(res, error, "Failed to search categories");
    }
  };

  /**
   * Get categories by tag
   * GET /api/categories/tag/:tag
   */
  getCategoriesByTag = async (req: Request, res: Response) => {
    try {
      const { tag } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = parseInt(req.query.skip as string) || 0;

      if (!tag) {
        return res.status(400).json({
          success: false,
          message: "Tag is required",
        });
      }

      const result = await this.categoryService.getCategoriesByTag(
        tag,
        limit,
        skip
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
      return handleError(res, error, "Failed to get categories by tag");
    }
  };

  /**
   * Get all unique tags
   * GET /api/categories/tags
   */
  getAllTags = async (req: Request, res: Response) => {
    try {
      const tags = await this.categoryService.getAllTags();

      return res.status(200).json({
        success: true,
        data: tags,
      });
    } catch (error) {
      return handleError(res, error, "Failed to get tags");
    }
  };
}
