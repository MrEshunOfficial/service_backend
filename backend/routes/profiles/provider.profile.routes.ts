// routes/provider-profile.routes.ts - FIXED VERSION

import { Router } from "express";
import { createProviderProfile, updateProviderProfile, deleteProviderProfile, restoreProviderProfile, getProviderProfile, getProviderByProfile, getMyProviderProfile, findNearestProviders, findProvidersByLocation, getDistanceToProvider, searchProviders, addServiceToProvider, removeServiceFromProvider, getAvailablePrivateServices } from "../../controllers/profiles/providers/provider.profile.controller";
import { authenticateToken } from "../../middleware/auth.middleware";

const router = Router();

// ============================================
// IMPORTANT: Specific routes MUST come before parameterized routes!
// ============================================

// ============================================
// Private Retrieval Operations (MUST BE FIRST)
// ============================================

/**
 * @route   GET /api/providers/me
 * MUST BE BEFORE /:providerId to avoid matching "me" as a providerId
 */
router.get("/me", authenticateToken, getMyProviderProfile);

// ============================================
// Location-Based Operations (BEFORE /:providerId)
// ============================================

router.post("/nearest", findNearestProviders);
router.get("/by-location", findProvidersByLocation);
router.post("/search", searchProviders);

// ============================================
// CRUD Operations
// ============================================

router.post("/", authenticateToken, createProviderProfile);
router.put("/:providerId", authenticateToken, updateProviderProfile);
router.delete("/:providerId", authenticateToken, deleteProviderProfile);
router.post("/:providerId/restore", authenticateToken, restoreProviderProfile);

// ============================================
// Service Management (specific before generic)
// ============================================

router.get("/:providerId/available-private-services", authenticateToken, getAvailablePrivateServices);
router.post("/:providerId/services", authenticateToken, addServiceToProvider);
router.delete("/:providerId/services/:serviceId", authenticateToken, removeServiceFromProvider);
router.post("/:providerId/distance", getDistanceToProvider);

// ============================================
// Public Retrieval (by-profile before generic :providerId)
// ============================================

router.get("/by-profile/:profileId", getProviderByProfile);

// ============================================
// Generic Provider Retrieval (MUST BE LAST)
// ============================================

router.get("/:providerId", getProviderProfile);

export default router;