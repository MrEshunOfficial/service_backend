// controllers/handlers/category.handlers.ts
import { Request, Response } from "express";
import { CategoryService } from "../../../services/category.service";
import {
  handleError,
  validateObjectId,
  AuthenticatedRequest,
} from "../../../utils/controller-utils/controller.utils";

// ============================================================================
// CRUD Operations
// ============================================================================

export const createCategoryHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  service: CategoryService
) => {
  try {
    const userId = req.user?.userId;
    const categoryData = req.body;

    if (!categoryData.catName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    if (!categoryData.catDesc?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category description is required",
      });
    }

    const category = await service.createCategory(categoryData, userId);

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("already exists")) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }
    return handleError(res, error, "Failed to create category");
  }
};

export const getCategoryByIdHandler = async (
  req: Request,
  res: Response,
  service: CategoryService
) => {
  try {
    const { id } = req.params;
    const includeDetails = req.query.includeDetails === "true";

    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const category = await service.getCategoryById(id, includeDetails);

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

export const getCategoryBySlugHandler = async (
  req: Request,
  res: Response,
  service: CategoryService
) => {
  try {
    const { slug } = req.params;
    const includeDetails = req.query.includeDetails === "true";

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Slug is required",
      });
    }

    const category = await service.getCategoryBySlug(slug, includeDetails);

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

export const updateCategoryHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  service: CategoryService
) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const updates = req.body;

    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    // Remove protected fields
    delete updates._id;
    delete updates.createdAt;
    delete updates.createdBy;
    delete updates.deletedAt;
    delete updates.deletedBy;
    delete updates.isDeleted;

    const category = await service.updateCategory(id, updates, userId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    return handleError(res, error, "Failed to update category");
  }
};

export const deleteCategoryHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  service: CategoryService
) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    await service.deleteCategory(id, userId);

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    return handleError(res, error, "Failed to delete category");
  }
};

export const restoreCategoryHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  service: CategoryService
) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const category = await service.restoreCategory(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Deleted category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category restored successfully",
      data: category,
    });
  } catch (error) {
    return handleError(res, error, "Failed to restore category");
  }
};

export const permanentlyDeleteCategoryHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  service: CategoryService
) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    await service.permanentlyDeleteCategory(id);

    return res.status(200).json({
      success: true,
      message: "Category permanently deleted",
    });
  } catch (error) {
    return handleError(res, error, "Failed to permanently delete category");
  }
};

// ============================================================================
// Query Operations
// ============================================================================

export const getActiveCategoriesHandler = async (
  req: Request,
  res: Response,
  service: CategoryService
) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = parseInt(req.query.skip as string) || 0;

    const result = await service.getActiveCategories(limit, skip);

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

export const getTopLevelCategoriesHandler = async (
  req: Request,
  res: Response,
  service: CategoryService
) => {
  try {
    const includeSubcategories = req.query.includeSubcategories === "true";

    const categories = await service.getTopLevelCategories(
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

export const getSubcategoriesHandler = async (
  req: Request,
  res: Response,
  service: CategoryService
) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const subcategories = await service.getSubcategories(id);

    return res.status(200).json({
      success: true,
      data: subcategories,
    });
  } catch (error) {
    return handleError(res, error, "Failed to get subcategories");
  }
};

export const getAllCategoriesHandler = async (
  req: Request,
  res: Response,
  service: CategoryService
) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = parseInt(req.query.skip as string) || 0;
    const includeDeleted = req.query.includeDeleted === "true";

    const result = await service.getAllCategories(limit, skip, includeDeleted);

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

// ============================================================================
// Search and Filter Operations
// ============================================================================

export const searchCategoriesHandler = async (
  req: Request,
  res: Response,
  service: CategoryService
) => {
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

    const result = await service.searchCategories(
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

export const getCategoriesByTagHandler = async (
  req: Request,
  res: Response,
  service: CategoryService
) => {
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

    const result = await service.getCategoriesByTag(tag, limit, skip);

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

export const getAllTagsHandler = async (
  req: Request,
  res: Response,
  service: CategoryService
) => {
  try {
    const tags = await service.getAllTags();

    return res.status(200).json({
      success: true,
      data: tags,
    });
  } catch (error) {
    return handleError(res, error, "Failed to get tags");
  }
};

// ============================================================================
// Hierarchy Operations
// ============================================================================

export const getCategoryHierarchyHandler = async (
  req: Request,
  res: Response,
  service: CategoryService
) => {
  try {
    const hierarchy = await service.getCategoryHierarchy();

    return res.status(200).json({
      success: true,
      data: hierarchy,
    });
  } catch (error) {
    return handleError(res, error, "Failed to get category hierarchy");
  }
};

// ============================================================================
// Cover Image Operations
// ============================================================================

export const updateCoverImageHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  service: CategoryService
) => {
  try {
    const { id } = req.params;
    const { catCoverId } = req.body;
    const userId = req.user?.userId;

    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    if (catCoverId && !validateObjectId(catCoverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid cover image ID",
      });
    }

    const category = await service.updateCoverImageId(
      id,
      catCoverId || null,
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
      message: "Cover image updated successfully",
      data: category,
    });
  } catch (error) {
    return handleError(res, error, "Failed to update cover image");
  }
};

export const getCompleteCategoryHandler = async (
  req: Request,
  res: Response,
  service: CategoryService
) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const result = await service.getCompleteCategory(id);

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

export const getCategoryImageStatusHandler = async (
  req: Request,
  res: Response,
  service: CategoryService
) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const status = await service.getCategoryImageStatus(id);

    return res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    return handleError(res, error, "Failed to get image status");
  }
};

export const repairCoverLinksHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  service: CategoryService
) => {
  try {
    const { categoryId } = req.body;

    if (categoryId && !validateObjectId(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const result = await service.repairCategoryCoverLinks(categoryId);

    return res.status(200).json({
      success: true,
      message: "Cover image links repaired successfully",
      data: result,
    });
  } catch (error) {
    return handleError(res, error, "Failed to repair cover links");
  }
};

// ============================================================================
// Statistics and Checks
// ============================================================================

export const getCategoryStatsHandler = async (
  req: Request,
  res: Response,
  service: CategoryService
) => {
  try {
    const { categoryId } = req.query;

    const stats = await service.getCategoryStats(categoryId as string);

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    return handleError(res, error, "Failed to get category statistics");
  }
};

export const checkCategoryExistsHandler = async (
  req: Request,
  res: Response,
  service: CategoryService
) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const exists = await service.categoryExists(id);

    return res.status(200).json({
      success: true,
      data: { exists },
    });
  } catch (error) {
    return handleError(res, error, "Failed to check category existence");
  }
};

export const checkSlugAvailabilityHandler = async (
  req: Request,
  res: Response,
  service: CategoryService
) => {
  try {
    const { slug } = req.params;
    const { excludeCategoryId } = req.query;

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Slug is required",
      });
    }

    const isAvailable = await service.isSlugAvailable(
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

// ============================================================================
// Bulk Operations
// ============================================================================

export const bulkUpdateCategoriesHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  service: CategoryService
) => {
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

    const result = await service.bulkUpdateCategories(
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

export const toggleActiveStatusHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  service: CategoryService
) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const category = await service.toggleActiveStatus(id, userId);

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
