// routes/category.routes.ts
import { Router } from "express";
import { authenticateToken, requireAdmin } from "../middleware/auth.middleware";
import { CategoryController } from "../controllers/categories/category.controller";

const router = Router();
const categoryController = new CategoryController();

/**
 * Category Routes
 *
 * Public routes (no authentication required):
 * - GET endpoints for viewing categories
 * - Search and filtering
 *
 * Protected routes (authentication required):
 * - POST, PUT, DELETE operations
 * - Admin functions
 */

// ============================================================================
// PUBLIC ROUTES (No authentication required)
// ============================================================================

// Search and filtering - must come before parameterized routes
router.get("/search", categoryController.searchCategories);
router.get("/tags", categoryController.getAllTags);
router.get("/tag/:tag", categoryController.getCategoriesByTag);

// Hierarchy and structure
router.get("/hierarchy", categoryController.getCategoryHierarchy);
router.get("/top-level", categoryController.getTopLevelCategories);
router.get("/active", categoryController.getActiveCategories);

// Statistics
router.get("/stats", categoryController.getCategoryStats);

// Slug operations - must come before /:id routes
router.get("/slug/:slug", categoryController.getCategoryBySlug);
router.get("/slug/:slug/available", categoryController.checkSlugAvailability);

// ============================================================================
// PROTECTED ROUTES (Authentication required)
// ============================================================================

// Admin routes - require both authentication and admin role
router.get(
  "/admin/all",
  authenticateToken,
  requireAdmin,
  categoryController.getAllCategories
);

// Create category - admin only (or add editor role check if implemented)
router.post(
  "/",
  authenticateToken,
  // requireAdmin,
  categoryController.createCategory
);

// Bulk operations - admin only
router.put(
  "/bulk-update",
  authenticateToken,
  requireAdmin,
  categoryController.bulkUpdateCategories
);

// Repair operations - admin only
router.post(
  "/repair-cover-links",
  authenticateToken,
  requireAdmin,
  categoryController.repairCoverLinks
);

// ============================================================================
// CATEGORY-SPECIFIC ROUTES (by ID)
// ============================================================================

// Public category viewing
router.get("/:id", categoryController.getCategoryById);
router.get("/:id/complete", categoryController.getCompleteCategory);
router.get("/:id/subcategories", categoryController.getSubcategories);
router.get("/:id/exists", categoryController.checkCategoryExists);
router.get("/:id/image-status", categoryController.getCategoryImageStatus);

// Protected category operations
router.put(
  "/:id",
  authenticateToken,
  requireAdmin,
  categoryController.updateCategory
);

router.delete(
  "/:id",
  authenticateToken,
  requireAdmin,
  categoryController.deleteCategory
);

router.post(
  "/:id/restore",
  authenticateToken,
  requireAdmin,
  categoryController.restoreCategory
);

router.delete(
  "/:id/permanent",
  authenticateToken,
  // requireAdmin,
  categoryController.permanentlyDeleteCategory
);

router.put(
  "/:id/cover-image",
  authenticateToken,
  requireAdmin,
  categoryController.updateCoverImage
);

router.patch(
  "/:id/toggle-active",
  authenticateToken,
  requireAdmin,
  categoryController.toggleActiveStatus
);

export default router;
