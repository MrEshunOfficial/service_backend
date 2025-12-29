// routes/file.routes.ts
import { Router } from "express";
import { initCloudinaryService } from "../config/cloudinary.config";
import { CloudinaryFileController } from "../controllers/files/claudinary.files.controller";
import { MongoDBFileController } from "../controllers/files/mongodb.files.controller";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();

const cloudinaryConfig = initCloudinaryService();
const cloudinaryController = new CloudinaryFileController(cloudinaryConfig);
const mongoController = new MongoDBFileController();

// ============================================
// PROFILE PICTURE ROUTES
// ============================================

// Cloudinary operations (upload, get, delete, optimize)
router.post(
  "/cloudinary/profile-picture",
  authenticateToken,
  cloudinaryController.uploadMiddleware.single("file"),
  cloudinaryController.uploadProfilePicture
);

router.get(
  "/cloudinary/profile-picture/optimized",
  authenticateToken,
  cloudinaryController.getOptimizedProfilePicture
);

router.get(
  "/cloudinary/profile-picture/:userId",
  authenticateToken,
  cloudinaryController.getUserProfilePicture
);

router.get(
  "/cloudinary/profile-picture",
  authenticateToken,
  cloudinaryController.getProfilePicture
);

router.delete(
  "/cloudinary/profile-picture",
  authenticateToken,
  cloudinaryController.deleteProfilePicture
);

// MongoDB operations (metadata, history, stats, archive/restore)
router.get(
  "/profile-picture/history",
  authenticateToken,
  mongoController.getProfilePictureHistory
);

router.get(
  "/profile-picture/stats",
  authenticateToken,
  mongoController.getProfilePictureStats
);

router.get(
  "/profile-picture/:userId",
  authenticateToken,
  mongoController.getUserProfilePictureRecord
);

router.get(
  "/profile-picture",
  authenticateToken,
  mongoController.getProfilePictureRecord
);

router.put(
  "/profile-picture/metadata",
  authenticateToken,
  mongoController.updateProfilePictureMetadata
);

router.post(
  "/profile-picture/archive",
  authenticateToken,
  mongoController.archiveProfilePicture
);

router.post(
  "/profile-picture/restore/:fileId",
  authenticateToken,
  mongoController.restoreProfilePicture
);

router.delete(
  "/profile-picture/cleanup",
  authenticateToken,
  mongoController.cleanupArchivedProfilePictures
);

router.delete(
  "/profile-picture",
  authenticateToken,
  mongoController.deleteProfilePicture
);

// ============================================
// CATEGORY COVER ROUTES
// ============================================

// Cloudinary operations (upload, get, delete, optimize)
router.post(
  "/cloudinary/category/:categoryId/cover",
  authenticateToken,
  cloudinaryController.uploadMiddleware.single("file"),
  cloudinaryController.uploadCategoryCover
);

router.get(
  "/cloudinary/category/:categoryId/cover/optimized",
  authenticateToken,
  cloudinaryController.getOptimizedCategoryCover
);

router.get(
  "/cloudinary/category/:categoryId/cover",
  authenticateToken,
  cloudinaryController.getCategoryCover
);

router.delete(
  "/cloudinary/category/:categoryId/cover",
  authenticateToken,
  cloudinaryController.deleteCategoryCover
);

// MongoDB operations (metadata, history, stats, archive/restore)
router.get(
  "/category/:categoryId/cover/history",
  authenticateToken,
  mongoController.getCategoryCoverHistory
);

router.get(
  "/category/:categoryId/cover/stats",
  authenticateToken,
  mongoController.getCategoryCoverStats
);

router.get(
  "/category/:categoryId/cover",
  authenticateToken,
  mongoController.getCategoryCoverRecord
);

router.put(
  "/category/:categoryId/cover/metadata",
  authenticateToken,
  mongoController.updateCategoryCoverMetadata
);

router.post(
  "/category/:categoryId/cover/archive",
  authenticateToken,
  mongoController.archiveCategoryCover
);

router.post(
  "/category/:categoryId/cover/restore/:fileId",
  authenticateToken,
  mongoController.restoreCategoryCover
);

router.delete(
  "/category/:categoryId/cover/cleanup",
  authenticateToken,
  mongoController.cleanupArchivedCategoryCovers
);

router.delete(
  "/category/:categoryId/cover",
  authenticateToken,
  mongoController.deleteCategoryCover
);

// ============================================
// SERVICE COVER ROUTES
// ============================================

// Cloudinary operations (upload, get, delete, optimize)
router.post(
  "/cloudinary/service/:serviceId/cover",
  authenticateToken,
  cloudinaryController.uploadMiddleware.single("file"),
  cloudinaryController.uploadServiceCover
);

router.get(
  "/cloudinary/service/:serviceId/cover/optimized",
  authenticateToken,
  cloudinaryController.getOptimizedServiceCover
);

router.get(
  "/cloudinary/service/:serviceId/cover",
  authenticateToken,
  cloudinaryController.getServiceCover
);

router.delete(
  "/cloudinary/service/:serviceId/cover",
  authenticateToken,
  cloudinaryController.deleteServiceCover
);

// MongoDB operations (metadata, history, stats, archive/restore)
router.get(
  "/service/:serviceId/cover/history",
  authenticateToken,
  mongoController.getServiceCoverHistory
);

router.get(
  "/service/:serviceId/cover/stats",
  authenticateToken,
  mongoController.getServiceCoverStats
);

router.get(
  "/service/:serviceId/cover",
  authenticateToken,
  mongoController.getServiceCoverRecord
);

router.put(
  "/service/:serviceId/cover/metadata",
  authenticateToken,
  mongoController.updateServiceCoverMetadata
);

router.post(
  "/service/:serviceId/cover/archive",
  authenticateToken,
  mongoController.archiveServiceCover
);

router.post(
  "/service/:serviceId/cover/restore/:fileId",
  authenticateToken,
  mongoController.restoreServiceCover
);

router.delete(
  "/service/:serviceId/cover/cleanup",
  authenticateToken,
  mongoController.cleanupArchivedServiceCovers
);

router.delete(
  "/service/:serviceId/cover",
  authenticateToken,
  mongoController.deleteServiceCover
);

// ============================================
// PROVIDER ID IMAGES ROUTES
// ============================================

// Cloudinary operations (upload, delete)
// IMPORTANT: Upload uses authenticated user's ID, management uses providerId
// This allows users to upload ID images BEFORE creating provider profile

// Upload multiple ID images (uses authenticated userId)
router.post(
  "/cloudinary/provider/id-images/upload-multiple",
  authenticateToken,
  cloudinaryController.uploadMiddleware.array("idImages", 2), // Max 2 files (front and back)
  cloudinaryController.uploadProviderIdImagesMultiple
);

// Upload single ID image (uses authenticated userId)
router.post(
  "/cloudinary/provider/id-images/upload",
  authenticateToken,
  cloudinaryController.uploadMiddleware.single("idImage"),
  cloudinaryController.uploadProviderIdImageSingle
);

// Delete ID image from Cloudinary (by providerId after profile creation)
router.delete(
  "/cloudinary/provider/:providerId/id-images/:fileId",
  authenticateToken,
  cloudinaryController.deleteProviderIdImage
);

// MongoDB operations (metadata, history, stats, archive/restore)
// IMPORTANT: Place specific routes BEFORE :fileId routes

// Get ID images history (by providerId)
router.get(
  "/provider/:providerId/id-images/history/all",
  authenticateToken,
  mongoController.getProviderIdImagesHistory
);

// Get ID images statistics (by providerId)
router.get(
  "/provider/:providerId/id-images/stats/overview",
  authenticateToken,
  mongoController.getProviderIdImagesStats
);

// Update ID image metadata
router.patch(
  "/provider/:providerId/id-images/:fileId/metadata",
  authenticateToken,
  mongoController.updateProviderIdImageMetadata
);

// Archive ID image
router.post(
  "/provider/:providerId/id-images/:fileId/archive",
  authenticateToken,
  mongoController.archiveProviderIdImage
);

// Restore archived ID image
router.post(
  "/provider/:providerId/id-images/:fileId/restore",
  authenticateToken,
  mongoController.restoreProviderIdImage
);

// Permanently delete ID image
router.delete(
  "/provider/:providerId/id-images/:fileId",
  authenticateToken,
  mongoController.deleteProviderIdImage
);

// Get single ID image
router.get(
  "/provider/:providerId/id-images/:fileId",
  authenticateToken,
  mongoController.getProviderIdImageRecord
);

// Get all active ID images
router.get(
  "/provider/:providerId/id-images",
  authenticateToken,
  mongoController.getProviderIdImagesRecords
);

// ============================================
// PROVIDER GALLERY IMAGES ROUTES
// ============================================

// Cloudinary operations (upload, delete, optimize)
// IMPORTANT: Upload can use userId (before profile) or providerId (after profile)

// Upload multiple gallery images (uses authenticated userId)
router.post(
  "/cloudinary/provider/gallery/upload-multiple",
  authenticateToken,
  cloudinaryController.uploadMiddleware.array("galleryImages", 10), // Max 10 at once
  cloudinaryController.uploadProviderGalleryImagesMultiple
);

// Upload single gallery image (uses authenticated userId)
router.post(
  "/cloudinary/provider/gallery/upload",
  authenticateToken,
  cloudinaryController.uploadMiddleware.single("galleryImage"),
  cloudinaryController.uploadProviderGalleryImageSingle
);

// Get optimized gallery image (by providerId)
router.get(
  "/cloudinary/provider/:providerId/gallery/:fileId/optimized",
  cloudinaryController.getOptimizedProviderGalleryImage // Public route
);

// Delete gallery image from Cloudinary (by providerId)
router.delete(
  "/cloudinary/provider/:providerId/gallery/:fileId",
  authenticateToken,
  cloudinaryController.deleteProviderGalleryImage
);

// MongoDB operations (metadata, history, stats, archive/restore)
// IMPORTANT: Place specific routes BEFORE :fileId routes

// Get gallery images history (by providerId)
router.get(
  "/provider/:providerId/gallery/history/all",
  authenticateToken,
  mongoController.getProviderGalleryImagesHistory
);

// Get gallery images statistics (by providerId)
router.get(
  "/provider/:providerId/gallery/stats/overview",
  authenticateToken,
  mongoController.getProviderGalleryImagesStats
);

// Cleanup old archived gallery images (by providerId)
router.delete(
  "/provider/:providerId/gallery/cleanup",
  authenticateToken,
  mongoController.cleanupArchivedProviderGalleryImages
);

// Update gallery image metadata
router.patch(
  "/provider/:providerId/gallery/:fileId/metadata",
  authenticateToken,
  mongoController.updateProviderGalleryImageMetadata
);

// Archive gallery image
router.post(
  "/provider/:providerId/gallery/:fileId/archive",
  authenticateToken,
  mongoController.archiveProviderGalleryImage
);

// Restore archived gallery image
router.post(
  "/provider/:providerId/gallery/:fileId/restore",
  authenticateToken,
  mongoController.restoreProviderGalleryImage
);

// Permanently delete gallery image
router.delete(
  "/provider/:providerId/gallery/:fileId",
  authenticateToken,
  mongoController.deleteProviderGalleryImage
);

// Get single gallery image (PUBLIC, by providerId)
router.get(
  "/provider/:providerId/gallery/:fileId",
  mongoController.getProviderGalleryImageRecord
);

// Get all active gallery images (PUBLIC, by providerId)
router.get(
  "/provider/:providerId/gallery",
  mongoController.getProviderGalleryImagesRecords
);

// ============================================
// CLIENT ID IMAGES ROUTES
// ============================================

// Cloudinary operations (upload, get, delete)
// IMPORTANT: Upload uses authenticated user's ID, management uses clientId
// This allows users to upload ID images BEFORE creating client profile

// Upload multiple ID images (uses authenticated userId)
router.post(
  "/cloudinary/client/id-images/upload-multiple",
  authenticateToken,
  cloudinaryController.uploadMiddleware.array("idImages", 5), // Max 5 files
  cloudinaryController.uploadClientIdImagesMultiple
);

// Upload single ID image (uses authenticated userId)
router.post(
  "/cloudinary/client/id-images/upload",
  authenticateToken,
  cloudinaryController.uploadMiddleware.single("idImage"),
  cloudinaryController.uploadClientIdImageSingle
);

// Delete single ID image from Cloudinary (by clientId after profile creation)
router.delete(
  "/cloudinary/client/:clientId/id-images/:fileId",
  authenticateToken,
  cloudinaryController.deleteClientIdImage
);

// Delete all ID images from Cloudinary (by clientId after profile creation)
router.delete(
  "/cloudinary/client/:clientId/id-images",
  authenticateToken,
  cloudinaryController.deleteAllClientIdImages
);

// MongoDB operations (metadata, history, stats, archive/restore, bulk operations)
// IMPORTANT: Place specific routes BEFORE :fileId routes

// Get ID images history (by clientId)
router.get(
  "/client/:clientId/id-images/history/all",
  authenticateToken,
  mongoController.getClientIdImagesHistory
);

// Get ID images statistics (by clientId)
router.get(
  "/client/:clientId/id-images/stats/overview",
  authenticateToken,
  mongoController.getClientIdImagesStats
);

// Cleanup old archived ID images (by clientId)
router.delete(
  "/client/:clientId/id-images/cleanup",
  authenticateToken,
  mongoController.cleanupArchivedClientIdImages
);

// Verify ID image links integrity (by clientId)
router.get(
  "/client/:clientId/id-images/verify-links",
  authenticateToken,
  mongoController.verifyClientIdImageLinks
);

// Sync ID image links with client profile (by clientId)
router.post(
  "/client/:clientId/id-images/sync-links",
  authenticateToken,
  mongoController.syncClientIdImageLinks
);

// Bulk archive ID images (by clientId)
router.post(
  "/client/:clientId/id-images/bulk-archive",
  authenticateToken,
  mongoController.bulkArchiveClientIdImages
);

// Bulk restore ID images (by clientId)
router.post(
  "/client/:clientId/id-images/bulk-restore",
  authenticateToken,
  mongoController.bulkRestoreClientIdImages
);

// Bulk delete ID images (by clientId)
router.delete(
  "/client/:clientId/id-images/bulk-delete",
  authenticateToken,
  mongoController.bulkDeleteClientIdImages
);

// Update ID image metadata
router.patch(
  "/client/:clientId/id-images/:fileId/metadata",
  authenticateToken,
  mongoController.updateClientIdImageMetadata
);

// Archive ID image
router.post(
  "/client/:clientId/id-images/:fileId/archive",
  authenticateToken,
  mongoController.archiveClientIdImage
);

// Restore archived ID image
router.post(
  "/client/:clientId/id-images/:fileId/restore",
  authenticateToken,
  mongoController.restoreClientIdImage
);

// Permanently delete ID image
router.delete(
  "/client/:clientId/id-images/:fileId",
  authenticateToken,
  mongoController.deleteClientIdImage
);

// Get single ID image
router.get(
  "/client/:clientId/id-images/:fileId",
  authenticateToken,
  mongoController.getClientIdImageRecord
);

// Get all active ID images
router.get(
  "/client/:clientId/id-images",
  authenticateToken,
  mongoController.getClientIdImagesRecords
);

export default router;
