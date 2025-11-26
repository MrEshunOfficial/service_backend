// controllers/files/mongodb.file.controller.ts
import { MongoDBFileService } from "../../services/files/mongodb.files.service";
import { CategoryCoverHandlers } from "./handlers/mongodb.handlers/category-cover.handler";
import { ProfilePictureHandlers } from "./handlers/mongodb.handlers/profile-picture.handler";
import { ServiceCoverHandlers } from "./handlers/mongodb.handlers/service-cover.handler";

export class MongoDBFileController {
  private fileService: MongoDBFileService;
  private profilePictureHandlers: ProfilePictureHandlers;
  private categoryCoverHandlers: CategoryCoverHandlers;
  private serviceCoverHandlers: ServiceCoverHandlers;

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

  constructor() {
    this.fileService = new MongoDBFileService();
    this.profilePictureHandlers = new ProfilePictureHandlers(this.fileService);
    this.categoryCoverHandlers = new CategoryCoverHandlers(this.fileService);
    this.serviceCoverHandlers = new ServiceCoverHandlers(this.fileService);

    // Bind profile picture handlers
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

    // Bind category cover handlers
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

    // Bind service cover handlers
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
  }
}
