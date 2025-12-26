// ============================================
// controllers/files/cloudinary.file.controller.ts
// ============================================
import multer from "multer";
import { CloudinaryFileService } from "../../services/files/claudinary.files.service";
import { MongoDBFileService } from "../../services/files/mongodb.files.service";
import { CategoryCoverHandler } from "./handlers/claudinary.handlers/catCover-cld.handler";
import { ProfilePictureHandler } from "./handlers/claudinary.handlers/profPic-cld.handler";
import { ServiceCoverHandler } from "./handlers/claudinary.handlers/serviceCover.cld";

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

export class CloudinaryFileController {
  private cloudinaryService: CloudinaryFileService;
  private mongoService: MongoDBFileService;
  private profilePictureHandler: ProfilePictureHandler;
  private categoryCoverHandler: CategoryCoverHandler;
  private serviceCoverHandler: ServiceCoverHandler;
  public uploadMiddleware: multer.Multer;

  // Profile Picture Endpoints
  public uploadProfilePicture;
  public getProfilePicture;
  public getUserProfilePicture;
  public deleteProfilePicture;
  public getOptimizedProfilePicture;

  // Category Cover Endpoints
  public uploadCategoryCover;
  public getCategoryCover;
  public deleteCategoryCover;
  public getOptimizedCategoryCover;

  // Service Cover Endpoints
  public uploadServiceCover;
  public getServiceCover;
  public deleteServiceCover;
  public getOptimizedServiceCover;
    constructor(cloudinaryConfig: any) {
    this.cloudinaryService = new CloudinaryFileService(cloudinaryConfig);
    this.mongoService = new MongoDBFileService();
    this.uploadMiddleware = upload;

    // Initialize handlers
    this.profilePictureHandler = new ProfilePictureHandler(
      this.cloudinaryService,
      this.mongoService
    );
    this.categoryCoverHandler = new CategoryCoverHandler(
      this.cloudinaryService,
      this.mongoService
    );
    this.serviceCoverHandler = new ServiceCoverHandler(
      this.cloudinaryService,
      this.mongoService
    );
    // Bind profile picture handlers
    this.uploadProfilePicture = this.profilePictureHandler.upload.bind(
      this.profilePictureHandler
    );
    this.getProfilePicture = this.profilePictureHandler.get.bind(
      this.profilePictureHandler
    );
    this.getUserProfilePicture = this.profilePictureHandler.getUserFile.bind(
      this.profilePictureHandler
    );
    this.deleteProfilePicture = this.profilePictureHandler.delete.bind(
      this.profilePictureHandler
    );
    this.getOptimizedProfilePicture =
      this.profilePictureHandler.getOptimized.bind(this.profilePictureHandler);

    // Bind category cover handlers
    this.uploadCategoryCover = this.categoryCoverHandler.upload.bind(
      this.categoryCoverHandler
    );
    this.getCategoryCover = this.categoryCoverHandler.get.bind(
      this.categoryCoverHandler
    );
    this.deleteCategoryCover = this.categoryCoverHandler.delete.bind(
      this.categoryCoverHandler
    );
    this.getOptimizedCategoryCover =
      this.categoryCoverHandler.getOptimized.bind(this.categoryCoverHandler);

    // Bind service cover handlers
    this.uploadServiceCover = this.serviceCoverHandler.upload.bind(
      this.serviceCoverHandler
    );
    this.getServiceCover = this.serviceCoverHandler.get.bind(
      this.serviceCoverHandler
    );
    this.deleteServiceCover = this.serviceCoverHandler.delete.bind(
      this.serviceCoverHandler
    );
    this.getOptimizedServiceCover = this.serviceCoverHandler.getOptimized.bind(
      this.serviceCoverHandler
    );
  }
}