// routes/profiles/userProfile.route.ts
import { Router } from "express";
import { UserProfileController } from "../../controllers/profiles/user/userProfile.controller";
import {
  authenticateToken,
  requireAdmin,
} from "../../middleware/auth.middleware";

const router = Router();
const profileController = new UserProfileController();

/**
 * Public/User Routes
 * These routes require authentication but are accessible to all authenticated users
 */

// Check if profile exists for current user
router.get("/exists", authenticateToken, profileController.checkProfileExists);

// Get current user's profile
router.get("/me", authenticateToken, profileController.getMyProfile);

// Get complete profile with picture details
router.get(
  "/me/complete",
  authenticateToken,
  profileController.getCompleteProfile
);

// Get current user's profile statistics
router.get("/me/stats", authenticateToken, profileController.getMyProfileStats);

// Create a new profile for current user
router.post("/", authenticateToken, profileController.createProfile);

// Update current user's profile
router.patch("/me", authenticateToken, profileController.updateMyProfile);

// Soft delete current user's profile
router.delete("/me", authenticateToken, profileController.deleteMyProfile);

// Restore current user's soft deleted profile
router.post(
  "/me/restore",
  authenticateToken,
  profileController.restoreMyProfile
);

// Search profiles by bio (authenticated users only)
router.get("/search", authenticateToken, profileController.searchProfiles);

// Get multiple profiles by user IDs (batch operation)
router.post(
  "/batch",
  authenticateToken,
  profileController.getProfilesByUserIds
);

/**
 * Admin Routes
 * These routes require admin or super admin privileges
 * Note: requireAdmin checks for both isAdmin and isSuperAdmin
 */

// Get all profiles with pagination (admin only)
router.get(
  "/",
  authenticateToken,
  requireAdmin,
  profileController.getAllProfiles
);

// Bulk update profiles (admin only)
router.patch(
  "/bulk",
  authenticateToken,
  requireAdmin,
  profileController.bulkUpdateProfiles
);

// Get profile by user ID (admin only)
router.get(
  "/user/:userId",
  authenticateToken,
  requireAdmin,
  profileController.getProfileByUserId
);

// Get profile by profile ID (admin only)
router.get(
  "/:profileId",
  authenticateToken,
  requireAdmin,
  profileController.getProfileById
);

// Update profile by profile ID (admin only)
router.patch(
  "/:profileId",
  authenticateToken,
  requireAdmin,
  profileController.updateProfileById
);

// Permanently delete profile (admin only)
router.delete(
  "/:userId/permanent",
  authenticateToken,
  requireAdmin,
  profileController.permanentlyDeleteProfile
);

export default router;
