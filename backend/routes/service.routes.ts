// routes/service.routes.ts
import { Router } from "express";

import { authenticateToken, requireAdmin } from "../middleware/auth.middleware";
import { updateCoverImage } from "../controllers/categories/category.controller";
import {
  getPublicServices,
  getServiceBySlug,
  searchServices,
  getAccessibleServices,
  getServiceById,
  getCompleteService,
  getServicesByCategory,
  getServicesByProvider,
  checkServiceAccessibility,
  createService,
  updateService,
  deleteService,
  getPendingServices,
  getAllServices,
  getServiceStats,
  getServiceImageStatus,
  approveService,
  rejectService,
  restoreService,
  repairServiceCoverLinks,
  bulkUpdateServices,
} from "../controllers/service/service.controller";

const router = Router();

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

/**
 * Get public services
 * Query params: categoryId, providerId, minPrice, maxPrice, tags, page, limit, sortBy, sortOrder
 */
router.get("/public", getPublicServices);

/**
 * Get service by slug (public)
 */
router.get("/slug/:slug", getServiceBySlug);

// ============================================
// authenticateTokenD ROUTES
// ============================================

/**
 * Search services
 * Query params: q (required), categoryId, providerId, minPrice, maxPrice, tags, page, limit
 */
router.get("/search", authenticateToken, searchServices);

/**
 * Get accessible services based on user access level
 * Query params: categoryId, providerId, minPrice, maxPrice, tags, isActive, page, limit, sortBy, sortOrder
 */
router.get("/", authenticateToken, getAccessibleServices);

/**
 * Get service by ID
 */
router.get("/:id", authenticateToken, getServiceById);

/**
 * Get complete service with full details including cover image
 */
router.get("/:id/complete", authenticateToken, getCompleteService);

/**
 * Get services by category
 * Query params: page, limit, sortBy, sortOrder
 */
router.get("/category/:categoryId", authenticateToken, getServicesByCategory);

/**
 * Get services by provider
 * Query params: includeInactive (admin only), page, limit, sortBy, sortOrder
 */
router.get("/provider/:providerId", authenticateToken, getServicesByProvider);

/**
 * Check if service is accessible for current user
 */
router.get("/:id/accessible", authenticateToken, checkServiceAccessibility);

/**
 * Create a new service
 * Body: title, description, categoryId, tags?, coverImage?, providerId?, servicePricing?, isPrivate? (admin only)
 */
router.post("/", authenticateToken, createService);

/**
 * Update service
 * Body: title?, description?, tags?, categoryId?, coverImage?, servicePricing?, isPrivate? (admin only)
 */
router.put("/:id", authenticateToken, updateService);

/**
 * Update service cover image
 * Body: coverImageId (null to remove)
 */
router.patch("/:id/cover-image", authenticateToken, updateCoverImage);

/**
 * Delete service (soft delete)
 */
router.delete("/:id", authenticateToken, deleteService);

// ============================================
// ADMIN ONLY ROUTES
// ============================================

/**
 * Get pending services for moderation
 * Query params: page, limit, sortBy, sortOrder
 */
router.get(
  "/admin/pending",
  authenticateToken,
  requireAdmin,
  getPendingServices
);

/**
 * Get all services (admin view)
 * Query params: categoryId, providerId, isActive, isPrivate, page, limit, sortBy, sortOrder
 */
router.get("/admin/all", authenticateToken, requireAdmin,  getAllServices);

/**
 * Get service statistics
 */
router.get("/admin/stats", authenticateToken, requireAdmin, getServiceStats);

/**
 * Get service image status (for debugging)
 */
router.get(
  "/:id/admin/image-status",
  authenticateToken,
  requireAdmin,
  getServiceImageStatus
);

/**
 * Approve service
 */
router.post("/:id/approve", authenticateToken, requireAdmin, approveService);

/**
 * Reject service
 * Body: reason (required)
 */
router.post("/:id/reject", authenticateToken, requireAdmin, rejectService);

/**
 * Restore soft-deleted service
 */
router.post("/:id/restore", authenticateToken, requireAdmin, restoreService);

/**
 * Repair service cover image links
 * Body: serviceId? (optional - repairs specific service or all if not provided)
 */
router.post(
  "/admin/repair-cover-links",
  authenticateToken,
  requireAdmin,
  repairServiceCoverLinks
);

/**
 * Bulk update services
 * Body: serviceIds (array), update (update object)
 */
router.post(
  "/admin/bulk-update",
  authenticateToken,
  requireAdmin,
  bulkUpdateServices
);

export default router;
