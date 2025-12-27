// ============================================
// controllers/files/mongodb.file.controller.ts
// ============================================
import { MongoDBFileService } from "../../services/files/mongodb.files.service";
import { CategoryCoverHandlers } from "./handlers/mongodb.handlers/category-cover.handler";
import { ProfilePictureHandlers } from "./handlers/mongodb.handlers/profile-picture.handler";
import { ServiceCoverHandlers } from "./handlers/mongodb.handlers/service-cover.handler";
import {
  ProviderIdImagesHandlers,
  ProviderGalleryImagesHandlers,
} from "./handlers/mongodb.handlers/provider-files.handlers";

export class MongoDBFileController {
  private fileService: MongoDBFileService;
  private profilePictureHandlers: ProfilePictureHandlers;
  private categoryCoverHandlers: CategoryCoverHandlers;
  private serviceCoverHandlers: ServiceCoverHandlers;
  private providerIdImagesHandlers: ProviderIdImagesHandlers;
  private providerGalleryImagesHandlers: ProviderGalleryImagesHandlers;

  // Profile Picture Endpoints
  public getProfilePictureRecord;
  public getUserProfilePictureRecord;
  public getProfilePictureHistory;
  public updateProfilePictureMetadata;
  public archiveProfilePicture;
  public restoreProfilePicture;
  public deleteProfilePicture;
  public getProfilePictureStats;
  public cleanupArchivedProfilePictures;

  // Category Cover Endpoints
  public getCategoryCoverRecord;
  public getCategoryCoverHistory;
  public updateCategoryCoverMetadata;
  public archiveCategoryCover;
  public restoreCategoryCover;
  public deleteCategoryCover;
  public getCategoryCoverStats;
  public cleanupArchivedCategoryCovers;

  // Service Cover Endpoints
  public getServiceCoverRecord;
  public getServiceCoverHistory;
  public updateServiceCoverMetadata;
  public archiveServiceCover;
  public restoreServiceCover;
  public deleteServiceCover;
  public getServiceCoverStats;
  public cleanupArchivedServiceCovers;

  // Provider ID Images Endpoints
  public getProviderIdImagesRecords;
  public getProviderIdImageRecord;
  public getProviderIdImagesHistory;
  public updateProviderIdImageMetadata;
  public archiveProviderIdImage;
  public restoreProviderIdImage;
  public deleteProviderIdImage;
  public getProviderIdImagesStats;

  // Provider Gallery Images Endpoints
  public getProviderGalleryImagesRecords;
  public getProviderGalleryImageRecord;
  public getProviderGalleryImagesHistory;
  public updateProviderGalleryImageMetadata;
  public archiveProviderGalleryImage;
  public restoreProviderGalleryImage;
  public deleteProviderGalleryImage;
  public getProviderGalleryImagesStats;
  public cleanupArchivedProviderGalleryImages;

  constructor() {
    this.fileService = new MongoDBFileService();
    this.profilePictureHandlers = new ProfilePictureHandlers(this.fileService);
    this.categoryCoverHandlers = new CategoryCoverHandlers(this.fileService);
    this.serviceCoverHandlers = new ServiceCoverHandlers(this.fileService);
    this.providerIdImagesHandlers = new ProviderIdImagesHandlers(
      this.fileService
    );
    this.providerGalleryImagesHandlers = new ProviderGalleryImagesHandlers(
      this.fileService
    );

    // ============================================
    // Bind Profile Picture Handlers
    // ============================================
    this.getProfilePictureRecord = this.profilePictureHandlers.getRecord.bind(
      this.profilePictureHandlers
    );
    this.getUserProfilePictureRecord =
      this.profilePictureHandlers.getUserRecord.bind(
        this.profilePictureHandlers
      );
    this.getProfilePictureHistory = this.profilePictureHandlers.getHistory.bind(
      this.profilePictureHandlers
    );
    this.updateProfilePictureMetadata =
      this.profilePictureHandlers.updateMetadata.bind(
        this.profilePictureHandlers
      );
    this.archiveProfilePicture = this.profilePictureHandlers.archive.bind(
      this.profilePictureHandlers
    );
    this.restoreProfilePicture = this.profilePictureHandlers.restore.bind(
      this.profilePictureHandlers
    );
    this.deleteProfilePicture = this.profilePictureHandlers.delete.bind(
      this.profilePictureHandlers
    );
    this.getProfilePictureStats = this.profilePictureHandlers.getStats.bind(
      this.profilePictureHandlers
    );
    this.cleanupArchivedProfilePictures =
      this.profilePictureHandlers.cleanupArchived.bind(
        this.profilePictureHandlers
      );

    // ============================================
    // Bind Category Cover Handlers
    // ============================================
    this.getCategoryCoverRecord = this.categoryCoverHandlers.getRecord.bind(
      this.categoryCoverHandlers
    );
    this.getCategoryCoverHistory = this.categoryCoverHandlers.getHistory.bind(
      this.categoryCoverHandlers
    );
    this.updateCategoryCoverMetadata =
      this.categoryCoverHandlers.updateMetadata.bind(
        this.categoryCoverHandlers
      );
    this.archiveCategoryCover = this.categoryCoverHandlers.archive.bind(
      this.categoryCoverHandlers
    );
    this.restoreCategoryCover = this.categoryCoverHandlers.restore.bind(
      this.categoryCoverHandlers
    );
    this.deleteCategoryCover = this.categoryCoverHandlers.delete.bind(
      this.categoryCoverHandlers
    );
    this.getCategoryCoverStats = this.categoryCoverHandlers.getStats.bind(
      this.categoryCoverHandlers
    );
    this.cleanupArchivedCategoryCovers =
      this.categoryCoverHandlers.cleanupArchived.bind(
        this.categoryCoverHandlers
      );

    // ============================================
    // Bind Service Cover Handlers
    // ============================================
    this.getServiceCoverRecord = this.serviceCoverHandlers.getRecord.bind(
      this.serviceCoverHandlers
    );
    this.getServiceCoverHistory = this.serviceCoverHandlers.getHistory.bind(
      this.serviceCoverHandlers
    );
    this.updateServiceCoverMetadata =
      this.serviceCoverHandlers.updateMetadata.bind(this.serviceCoverHandlers);
    this.archiveServiceCover = this.serviceCoverHandlers.archive.bind(
      this.serviceCoverHandlers
    );
    this.restoreServiceCover = this.serviceCoverHandlers.restore.bind(
      this.serviceCoverHandlers
    );
    this.deleteServiceCover = this.serviceCoverHandlers.delete.bind(
      this.serviceCoverHandlers
    );
    this.getServiceCoverStats = this.serviceCoverHandlers.getStats.bind(
      this.serviceCoverHandlers
    );
    this.cleanupArchivedServiceCovers =
      this.serviceCoverHandlers.cleanupArchived.bind(this.serviceCoverHandlers);

    // ============================================
    // Bind Provider ID Images Handlers
    // ============================================
    this.getProviderIdImagesRecords =
      this.providerIdImagesHandlers.getRecords.bind(
        this.providerIdImagesHandlers
      );
    this.getProviderIdImageRecord =
      this.providerIdImagesHandlers.getRecord.bind(
        this.providerIdImagesHandlers
      );
    this.getProviderIdImagesHistory =
      this.providerIdImagesHandlers.getHistory.bind(
        this.providerIdImagesHandlers
      );
    this.updateProviderIdImageMetadata =
      this.providerIdImagesHandlers.updateMetadata.bind(
        this.providerIdImagesHandlers
      );
    this.archiveProviderIdImage = this.providerIdImagesHandlers.archive.bind(
      this.providerIdImagesHandlers
    );
    this.restoreProviderIdImage = this.providerIdImagesHandlers.restore.bind(
      this.providerIdImagesHandlers
    );
    this.deleteProviderIdImage = this.providerIdImagesHandlers.delete.bind(
      this.providerIdImagesHandlers
    );
    this.getProviderIdImagesStats = this.providerIdImagesHandlers.getStats.bind(
      this.providerIdImagesHandlers
    );

    // ============================================
    // Bind Provider Gallery Images Handlers
    // ============================================
    this.getProviderGalleryImagesRecords =
      this.providerGalleryImagesHandlers.getRecords.bind(
        this.providerGalleryImagesHandlers
      );
    this.getProviderGalleryImageRecord =
      this.providerGalleryImagesHandlers.getRecord.bind(
        this.providerGalleryImagesHandlers
      );
    this.getProviderGalleryImagesHistory =
      this.providerGalleryImagesHandlers.getHistory.bind(
        this.providerGalleryImagesHandlers
      );
    this.updateProviderGalleryImageMetadata =
      this.providerGalleryImagesHandlers.updateMetadata.bind(
        this.providerGalleryImagesHandlers
      );
    this.archiveProviderGalleryImage =
      this.providerGalleryImagesHandlers.archive.bind(
        this.providerGalleryImagesHandlers
      );
    this.restoreProviderGalleryImage =
      this.providerGalleryImagesHandlers.restore.bind(
        this.providerGalleryImagesHandlers
      );
    this.deleteProviderGalleryImage =
      this.providerGalleryImagesHandlers.delete.bind(
        this.providerGalleryImagesHandlers
      );
    this.getProviderGalleryImagesStats =
      this.providerGalleryImagesHandlers.getStats.bind(
        this.providerGalleryImagesHandlers
      );
    this.cleanupArchivedProviderGalleryImages =
      this.providerGalleryImagesHandlers.cleanupArchived.bind(
        this.providerGalleryImagesHandlers
      );
  }
}
