// ============================================
// controllers/files/cloudinary.file.controller.ts
// ============================================
import multer from "multer";
import { CloudinaryFileService } from "../../services/files/claudinary.files.service";
import { MongoDBFileService } from "../../services/files/mongodb.files.service";
import { CategoryCoverHandler } from "./handlers/claudinary.handlers/catCover-cld.handler";
import { ProfilePictureHandler } from "./handlers/claudinary.handlers/profPic-cld.handler";
import { ServiceCoverHandler } from "./handlers/claudinary.handlers/serviceCover.cld";
import {
  ProviderIdImagesUploadHandler,
  ProviderGalleryImagesUploadHandler,
} from "./handlers/claudinary.handlers/provider-files.handlers";
import { ClientIdImagesUploadHandler } from "./handlers/claudinary.handlers/client-id-details.handler";

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
  private providerIdImagesUploadHandler: ProviderIdImagesUploadHandler;
  private providerGalleryImagesUploadHandler: ProviderGalleryImagesUploadHandler;
  private clientIdImagesUploadHandler: ClientIdImagesUploadHandler;
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

  // Provider ID Images Endpoints
  public uploadProviderIdImageSingle;
  public uploadProviderIdImagesMultiple;
  public deleteProviderIdImage;

  // Provider Gallery Images Endpoints
  public uploadProviderGalleryImageSingle;
  public uploadProviderGalleryImagesMultiple;
  public deleteProviderGalleryImage;
  public getOptimizedProviderGalleryImage;

  // Client ID Images Endpoints
  public uploadClientIdImageSingle;
  public uploadClientIdImagesMultiple;
  public getAllClientIdImages;
  public getSingleClientIdImage;
  public deleteClientIdImage;
  public deleteAllClientIdImages;

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
    this.providerIdImagesUploadHandler = new ProviderIdImagesUploadHandler(
      this.cloudinaryService,
      this.mongoService
    );
    this.providerGalleryImagesUploadHandler =
      new ProviderGalleryImagesUploadHandler(
        this.cloudinaryService,
        this.mongoService
      );
    this.clientIdImagesUploadHandler = new ClientIdImagesUploadHandler(
      this.cloudinaryService,
      this.mongoService
    );

    // ============================================
    // Bind Profile Picture Handlers
    // ============================================
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

    // ============================================
    // Bind Category Cover Handlers
    // ============================================
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

    // ============================================
    // Bind Service Cover Handlers
    // ============================================
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

    // ============================================
    // Bind Provider ID Images Upload Handlers
    // ============================================
    this.uploadProviderIdImageSingle =
      this.providerIdImagesUploadHandler.uploadSingle.bind(
        this.providerIdImagesUploadHandler
      );
    this.uploadProviderIdImagesMultiple =
      this.providerIdImagesUploadHandler.uploadMultiple.bind(
        this.providerIdImagesUploadHandler
      );
    this.deleteProviderIdImage = this.providerIdImagesUploadHandler.delete.bind(
      this.providerIdImagesUploadHandler
    );

    // ============================================
    // Bind Provider Gallery Images Upload Handlers
    // ============================================
    this.uploadProviderGalleryImageSingle =
      this.providerGalleryImagesUploadHandler.uploadSingle.bind(
        this.providerGalleryImagesUploadHandler
      );
    this.uploadProviderGalleryImagesMultiple =
      this.providerGalleryImagesUploadHandler.uploadMultiple.bind(
        this.providerGalleryImagesUploadHandler
      );
    this.deleteProviderGalleryImage =
      this.providerGalleryImagesUploadHandler.delete.bind(
        this.providerGalleryImagesUploadHandler
      );
    this.getOptimizedProviderGalleryImage =
      this.providerGalleryImagesUploadHandler.getOptimized.bind(
        this.providerGalleryImagesUploadHandler
      );

    // ============================================
    // Bind Client ID Images Upload Handlers
    // ============================================
    this.uploadClientIdImageSingle =
      this.clientIdImagesUploadHandler.uploadSingle.bind(
        this.clientIdImagesUploadHandler
      );
    this.uploadClientIdImagesMultiple =
      this.clientIdImagesUploadHandler.uploadMultiple.bind(
        this.clientIdImagesUploadHandler
      );
    this.getAllClientIdImages = this.clientIdImagesUploadHandler.getAll.bind(
      this.clientIdImagesUploadHandler
    );
    this.getSingleClientIdImage =
      this.clientIdImagesUploadHandler.getSingle.bind(
        this.clientIdImagesUploadHandler
      );
    this.deleteClientIdImage = this.clientIdImagesUploadHandler.delete.bind(
      this.clientIdImagesUploadHandler
    );
    this.deleteAllClientIdImages =
      this.clientIdImagesUploadHandler.deleteAll.bind(
        this.clientIdImagesUploadHandler
      );
  }
}
