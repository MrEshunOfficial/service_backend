// routes/profiles/provider/providerProfile.route.ts
import { Router } from "express";
import ProviderProfileController from "../../controllers/profiles/provider/provider.profile.controller";
import {
  authenticateToken,
  requireAdmin,
} from "../../middleware/auth.middleware";
import { requireProvider } from "../../middleware/role.middleware";

const router = Router();
const providerController = new ProviderProfileController();

/**
 * ============================================================================
 * BASE & UTILITY ROUTES
 * Public routes for service health and general statistics
 * ============================================================================
 */

// Health check endpoint - no authentication required
router.get("/health", providerController.healthCheck);

// Get provider statistics - public
router.get("/stats", providerController.getStatistics);

// Get available regions - public
router.get("/regions", providerController.getAvailableRegions);

// Get available cities (optionally filtered by region) - public
router.get("/cities", providerController.getAvailableCities);

// Get service coverage for a specific service - public
router.get(
  "/service-coverage/:serviceId",
  providerController.getServiceCoverage
);

/**
 * ============================================================================
 * LOCATION ROUTES
 * Location enrichment and verification services
 * ============================================================================
 */

// Enrich location data
router.post(
  "/location/enrich",
  authenticateToken,
  providerController.enrichLocation
);

// Verify location coordinates
router.post(
  "/location/verify",
  authenticateToken,
  providerController.verifyLocation
);

// Geocode address to coordinates
router.post(
  "/location/geocode",
  authenticateToken,
  providerController.geocodeAddress
);

// Reverse geocode coordinates to address
router.post(
  "/location/reverse-geocode",
  authenticateToken,
  providerController.reverseGeocode
);

// Search for nearby places
router.post(
  "/location/search-nearby",
  authenticateToken,
  providerController.searchNearby
);

// Calculate distance between two points
router.post(
  "/location/calculate-distance",
  authenticateToken,
  providerController.calculateDistance
);

/**
 * ============================================================================
 * SEARCH & DISCOVERY ROUTES
 * Provider search and discovery endpoints
 * ============================================================================
 */

// Find nearest providers by GPS coordinates
router.post(
  "/search/nearest",
  authenticateToken,
  providerController.findNearestProviders
);

// Find providers by location (region/city)
router.get(
  "/search/location",
  authenticateToken,
  providerController.findProvidersByLocation
);

// Advanced provider search with multiple filters
router.post("/search", authenticateToken, providerController.searchProviders);

// Find providers by specific service
router.get(
  "/search/by-service/:serviceId",
  authenticateToken,
  providerController.findProvidersByService
);

// Find nearby providers offering specific services
router.post(
  "/search/nearby-services",
  authenticateToken,
  providerController.findNearbyServiceProviders
);

// Find company-trained providers
router.get(
  "/search/company-trained",
  authenticateToken,
  providerController.findCompanyTrainedProviders
);

/**
 * ============================================================================
 * ADMIN ROUTES - PROVIDER MANAGEMENT
 * Administrative operations for managing providers
 * All endpoints require admin/super_admin roles
 * IMPORTANT: Admin routes with /admin prefix come before generic parameterized routes
 * ============================================================================
 */

// Get all providers with pagination and filtering
router.get(
  "/admin/all",
  authenticateToken,
  requireAdmin,
  providerController.getAllProviders
);

// Get provider statistics (admin view)
router.get(
  "/admin/statistics",
  authenticateToken,
  requireAdmin,
  providerController.getProviderStatistics
);

// Generate comprehensive provider report
router.get(
  "/admin/report",
  authenticateToken,
  requireAdmin,
  providerController.generateProviderReport
);

// Bulk operations on multiple providers
router.post(
  "/admin/bulk-operations",
  authenticateToken,
  requireAdmin,
  providerController.bulkOperations
);

// Approve a provider profile
router.post(
  "/admin/:providerId/approve",
  authenticateToken,
  requireAdmin,
  providerController.approveProvider
);

// Reject a provider profile
router.post(
  "/admin/:providerId/reject",
  authenticateToken,
  requireAdmin,
  providerController.rejectProvider
);

// Suspend a provider profile
router.post(
  "/admin/:providerId/suspend",
  authenticateToken,
  requireAdmin,
  providerController.suspendProvider
);

// Unsuspend a provider profile
router.post(
  "/admin/:providerId/unsuspend",
  authenticateToken,
  requireAdmin,
  providerController.unsuspendProvider
);

// Get audit log for a provider
router.get(
  "/admin/:providerId/audit-log",
  authenticateToken,
  requireAdmin,
  providerController.getProviderAuditLog
);

/**
 * ============================================================================
 * PROVIDER PROFILE ROUTES (USER) - /me routes
 * Routes for providers to manage their own profiles
 * CRITICAL: These must come BEFORE generic parameterized routes like /:providerId
 * to prevent "me" from being interpreted as a providerId
 * ============================================================================
 */

// Get current user's provider profile
router.get(
  "/me",
  authenticateToken,
  requireProvider,
  providerController.getMyProviderProfile
);

// Update current user's provider profile
router.patch(
  "/me",
  authenticateToken,
  requireProvider,
  providerController.updateMyProviderProfile
);

// Update current user's ID details
router.patch(
  "/me/id-details",
  authenticateToken,
  requireProvider,
  providerController.updateMyIdDetails
);

// Restore current user's soft-deleted provider profile
router.post(
  "/me/restore",
  authenticateToken,
  requireProvider,
  providerController.restoreProviderProfile
);

// Delete current user's provider profile (soft delete)
router.delete(
  "/me",
  authenticateToken,
  requireProvider,
  providerController.deleteProviderProfile
);

/**
 * ============================================================================
 * PROVIDER CREATION ROUTE
 * ============================================================================
 */

// Create a new provider profile for current user
router.post(
  "/",
  authenticateToken,
  requireProvider,
  providerController.createProviderProfile
);

/**
 * ============================================================================
 * SPECIFIC PARAMETERIZED ROUTES
 * Routes with specific paths before generic /:providerId
 * ============================================================================
 */

// Get provider profile by user ID
router.get(
  "/user/:userId",
  authenticateToken,
  providerController.getProviderByUserId
);

// Calculate distance to specific provider
router.post(
  "/:providerId/distance",
  authenticateToken,
  providerController.getDistanceToProvider
);

// Restore provider profile by provider ID (admin or owner)
router.post(
  "/:providerId/restore",
  authenticateToken,
  providerController.restoreProviderProfile
);

// Update ID details by provider ID (admin or owner)
router.patch(
  "/:providerId/id-details",
  authenticateToken,
  providerController.updateIdDetails
);

/**
 * ============================================================================
 * PROVIDER PROFILE ROUTES (GENERAL)
 * Generic parameterized routes - MUST BE LAST
 * These catch-all routes should come after all specific routes
 * ============================================================================
 */

// Get provider profile by provider ID
router.get(
  "/:providerId",
  authenticateToken,
  providerController.getProviderProfile
);

// Update provider profile by provider ID (admin or owner)
router.patch(
  "/:providerId",
  authenticateToken,
  providerController.updateProviderProfile
);

// Delete provider profile by provider ID (admin or owner)
router.delete(
  "/:providerId",
  authenticateToken,
  providerController.deleteProviderProfile
);

export default router;
