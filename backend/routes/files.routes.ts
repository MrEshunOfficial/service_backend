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

export default router;