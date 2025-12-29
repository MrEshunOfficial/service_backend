// routes/profiles/client-profile.routes.ts
import { Router } from "express";
import {
  // Profile CRUD Operations
  createClientProfile,
  getClientProfile,
  getClientByUserId,
  getMyClientProfile,
  getMyCompleteProfile,
  updateClientProfile,
  updateMyClientProfile,
  deleteClientProfile,
  restoreClientProfile,
  updateIdDetails,
  updateMyIdDetails,
  getClientStats,
  // Search & Discovery Operations
  findNearestClients,
  findClientsByLocation,
  searchClients,
  getClientsByFavoriteService,
  getClientsByFavoriteProvider,
  // Management Operations
  manageFavorites,
  manageMyFavorites,
  manageAddress,
  manageMyAddress,
  addPaymentMethod,
  removePaymentMethod,
  updateCommunicationPreferences,
  updateMyCommunicationPreferences,
  updateEmergencyContact,
  removeEmergencyContact,
  updatePreferredCategories,
  updateLanguagePreference,
  // Verification Operations
  updateVerificationStatus,
  verifyPhone,
  verifyEmail,
  verifyId,
  getVerificationStatus,
  // Base & Utility Operations
  healthCheck,
  getStatistics,
  getAvailableRegions,
  getAllVerifiedClients,
  // Location Operations
  enrichLocation,
  verifyLocation,
  geocodeAddress,
  calculateDistance,
} from "../../controllers/profiles/client/clientProfile.controller";
import {
  authenticateToken,
  requireAdmin,
  optionalAuth,
} from "../../middleware/auth.middleware";
import { requireCustomer } from "../../middleware/role.middleware";

const router = Router();

// ============================================================================
// PUBLIC & UTILITY ROUTES
// ============================================================================

/**
 * GET /api/clients/health
 * Health check endpoint
 * Public access
 */
router.get("/health", healthCheck);

/**
 * GET /api/clients/statistics
 * Get platform-wide client statistics
 * Public access (or optionalAuth if you want to track who's viewing)
 */
router.get("/statistics", optionalAuth, getStatistics);

/**
 * GET /api/clients/regions
 * Get list of available regions with client counts
 * Public access
 */
router.get("/regions", optionalAuth, getAvailableRegions);

/**
 * GET /api/clients/verified
 * Get all verified clients with pagination
 * Public access
 */
router.get("/verified", optionalAuth, getAllVerifiedClients);

// ============================================================================
// LOCATION UTILITY ROUTES (Before :clientId routes to avoid conflicts)
// ============================================================================

/**
 * POST /api/clients/location/enrich
 * Enrich location data using Ghana Post GPS
 * Authenticated users only
 */
router.post("/location/enrich", authenticateToken, enrichLocation);

/**
 * POST /api/clients/location/verify
 * Verify location coordinates against Ghana Post GPS
 * Authenticated users only
 */
router.post("/location/verify", authenticateToken, verifyLocation);

/**
 * POST /api/clients/location/geocode
 * Geocode an address to get coordinates
 * Authenticated users only
 */
router.post("/location/geocode", authenticateToken, geocodeAddress);

/**
 * POST /api/clients/location/distance
 * Calculate distance between two coordinates
 * Authenticated users only
 */
router.post("/location/distance", authenticateToken, calculateDistance);

// ============================================================================
// SEARCH & DISCOVERY ROUTES (Before :clientId routes)
// ============================================================================

/**
 * POST /api/clients/search/nearest
 * Find nearest clients to a location
 * Public or authenticated
 */
router.post("/search/nearest", optionalAuth, findNearestClients);

/**
 * GET /api/clients/search/location
 * Find clients by region and city
 * Public or authenticated
 */
router.get("/search/location", optionalAuth, findClientsByLocation);

/**
 * GET /api/clients/search
 * Advanced client search with multiple filters
 * Public or authenticated
 */
router.get("/search", optionalAuth, searchClients);

/**
 * GET /api/clients/favorites/service/:serviceId
 * Get clients who favorited a specific service
 * Authenticated users only
 */
router.get(
  "/favorites/service/:serviceId",
  authenticateToken,
  getClientsByFavoriteService
);

/**
 * GET /api/clients/favorites/provider/:providerId
 * Get clients who favorited a specific provider
 * Authenticated users only
 */
router.get(
  "/favorites/provider/:providerId",
  authenticateToken,
  getClientsByFavoriteProvider
);

// ============================================================================
// "ME" ROUTES - Current authenticated user's profile
// ============================================================================

/**
 * POST /api/clients
 * Create a new client profile for current user
 * Requires: Authentication + Customer role
 */
router.post("/", authenticateToken, requireCustomer, createClientProfile);

/**
 * GET /api/clients/me
 * Get current user's client profile
 * Requires: Authentication + Customer role
 */
router.get("/me", authenticateToken, requireCustomer, getMyClientProfile);

/**
 * GET /api/clients/me/complete
 * Get complete client profile with stats and enriched data
 * Requires: Authentication + Customer role
 */
router.get(
  "/me/complete",
  authenticateToken,
  requireCustomer,
  getMyCompleteProfile
);

/**
 * PATCH /api/clients/me
 * Update current user's client profile
 * Requires: Authentication + Customer role
 */
router.patch("/me", authenticateToken, requireCustomer, updateMyClientProfile);

/**
 * PATCH /api/clients/me/id-details
 * Update ID details for current user's client profile
 * Requires: Authentication + Customer role
 */
router.patch(
  "/me/id-details",
  authenticateToken,
  requireCustomer,
  updateMyIdDetails
);

/**
 * POST /api/clients/me/favorites
 * Manage favorites for current user
 * Requires: Authentication + Customer role
 */
router.post(
  "/me/favorites",
  authenticateToken,
  requireCustomer,
  manageMyFavorites
);

/**
 * POST /api/clients/me/addresses
 * Manage addresses for current user
 * Requires: Authentication + Customer role
 */
router.post(
  "/me/addresses",
  authenticateToken,
  requireCustomer,
  manageMyAddress
);

/**
 * PATCH /api/clients/me/communication-preferences
 * Update communication preferences for current user
 * Requires: Authentication + Customer role
 */
router.patch(
  "/me/communication-preferences",
  authenticateToken,
  requireCustomer,
  updateMyCommunicationPreferences
);

// ============================================================================
// SPECIFIC CLIENT ROUTES (by clientId or userId)
// ============================================================================

/**
 * GET /api/clients/user/:userId
 * Get client profile by user ID
 * Admin only
 */
router.get("/user/:userId", authenticateToken, requireAdmin, getClientByUserId);

/**
 * GET /api/clients/:clientId
 * Get client profile by ID
 * Admin or public with restrictions
 */
router.get("/:clientId", optionalAuth, getClientProfile);

/**
 * PATCH /api/clients/:clientId
 * Update client profile
 * Admin only (or owner with additional middleware)
 */
router.patch(
  "/:clientId",
  authenticateToken,
  requireAdmin,
  updateClientProfile
);

/**
 * DELETE /api/clients/:clientId
 * Soft delete client profile
 * Admin only
 */
router.delete(
  "/:clientId",
  authenticateToken,
  requireAdmin,
  deleteClientProfile
);

/**
 * POST /api/clients/:clientId/restore
 * Restore soft-deleted client profile
 * Admin only
 */
router.post(
  "/:clientId/restore",
  authenticateToken,
  requireAdmin,
  restoreClientProfile
);

/**
 * PATCH /api/clients/:clientId/id-details
 * Update ID details
 * Admin only
 */
router.patch(
  "/:clientId/id-details",
  authenticateToken,
  requireAdmin,
  updateIdDetails
);

/**
 * GET /api/clients/:clientId/stats
 * Get client statistics
 * Admin or owner
 */
router.get("/:clientId/stats", authenticateToken, getClientStats);

// ============================================================================
// FAVORITES MANAGEMENT (by clientId)
// ============================================================================

/**
 * POST /api/clients/:clientId/favorites
 * Add or remove favorite services/providers
 * Admin only (for managing other users)
 */
router.post(
  "/:clientId/favorites",
  authenticateToken,
  requireAdmin,
  manageFavorites
);

// ============================================================================
// ADDRESS MANAGEMENT (by clientId)
// ============================================================================

/**
 * POST /api/clients/:clientId/addresses
 * Manage saved addresses
 * Admin only (for managing other users)
 */
router.post(
  "/:clientId/addresses",
  authenticateToken,
  requireAdmin,
  manageAddress
);

// ============================================================================
// PAYMENT METHODS (by clientId)
// ============================================================================

/**
 * POST /api/clients/:clientId/payment-methods
 * Add payment method
 * Admin only (for managing other users)
 */
router.post(
  "/:clientId/payment-methods",
  authenticateToken,
  requireAdmin,
  addPaymentMethod
);

/**
 * DELETE /api/clients/:clientId/payment-methods/:paymentMethodId
 * Remove payment method
 * Admin only (for managing other users)
 */
router.delete(
  "/:clientId/payment-methods/:paymentMethodId",
  authenticateToken,
  requireAdmin,
  removePaymentMethod
);

// ============================================================================
// COMMUNICATION PREFERENCES (by clientId)
// ============================================================================

/**
 * PATCH /api/clients/:clientId/communication-preferences
 * Update communication preferences
 * Admin only (for managing other users)
 */
router.patch(
  "/:clientId/communication-preferences",
  authenticateToken,
  requireAdmin,
  updateCommunicationPreferences
);

// ============================================================================
// EMERGENCY CONTACT (by clientId)
// ============================================================================

/**
 * PATCH /api/clients/:clientId/emergency-contact
 * Update emergency contact
 * Admin only (for managing other users)
 */
router.patch(
  "/:clientId/emergency-contact",
  authenticateToken,
  requireAdmin,
  updateEmergencyContact
);

/**
 * DELETE /api/clients/:clientId/emergency-contact
 * Remove emergency contact
 * Admin only (for managing other users)
 */
router.delete(
  "/:clientId/emergency-contact",
  authenticateToken,
  requireAdmin,
  removeEmergencyContact
);

// ============================================================================
// PREFERENCES (by clientId)
// ============================================================================

/**
 * PATCH /api/clients/:clientId/preferred-categories
 * Update preferred categories
 * Admin only (for managing other users)
 */
router.patch(
  "/:clientId/preferred-categories",
  authenticateToken,
  requireAdmin,
  updatePreferredCategories
);

/**
 * PATCH /api/clients/:clientId/language-preference
 * Update language preference
 * Admin only (for managing other users)
 */
router.patch(
  "/:clientId/language-preference",
  authenticateToken,
  requireAdmin,
  updateLanguagePreference
);

// ============================================================================
// VERIFICATION ROUTES (by clientId)
// ============================================================================

/**
 * PATCH /api/clients/:clientId/verification
 * Update verification status
 * Admin only
 */
router.patch(
  "/:clientId/verification",
  authenticateToken,
  requireAdmin,
  updateVerificationStatus
);

/**
 * POST /api/clients/:clientId/verify-phone
 * Verify phone number
 * Admin only
 */
router.post(
  "/:clientId/verify-phone",
  authenticateToken,
  requireAdmin,
  verifyPhone
);

/**
 * POST /api/clients/:clientId/verify-email
 * Verify email
 * Admin only
 */
router.post(
  "/:clientId/verify-email",
  authenticateToken,
  requireAdmin,
  verifyEmail
);

/**
 * POST /api/clients/:clientId/verify-id
 * Verify ID document
 * Admin only
 */
router.post("/:clientId/verify-id", authenticateToken, requireAdmin, verifyId);

/**
 * GET /api/clients/:clientId/verification-status
 * Get verification status
 * Admin or owner
 */
router.get(
  "/:clientId/verification-status",
  authenticateToken,
  getVerificationStatus
);

export default router;
