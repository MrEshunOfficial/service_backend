// controllers/profiles/userProfile.controller.ts

import { ProfileAdminHandler } from "./handlers/admin.handlers";
import { ProfileCRUDHandler } from "./handlers/Crud.handlers";
import { ProfileRetrievalHandler } from "./handlers/retrieval.handlers";

/**
 * User Profile Controller
 *
 * Handles HTTP requests for user profile management endpoints.
 * Delegates to specialized handler classes for better organization.
 */
export class UserProfileController {
  private crudHandler: ProfileCRUDHandler;
  private retrievalHandler: ProfileRetrievalHandler;
  private adminHandler: ProfileAdminHandler;

  // CRUD Operations
  public createProfile;
  public updateMyProfile;
  public updateProfileById;
  public deleteMyProfile;
  public restoreMyProfile;
  public permanentlyDeleteProfile;

  // Retrieval Operations
  public getMyProfile;
  public getCompleteProfile;
  public getProfileByUserId;
  public getProfileById;
  public searchProfiles;
  public getProfilesByUserIds;
  public getMyProfileStats;

  // Admin Operations
  public getAllProfiles;
  public checkProfileExists;
  public bulkUpdateProfiles;

  constructor() {
    this.crudHandler = new ProfileCRUDHandler();
    this.retrievalHandler = new ProfileRetrievalHandler();
    this.adminHandler = new ProfileAdminHandler();

    // Bind CRUD handlers
    this.createProfile = this.crudHandler.createProfile.bind(this.crudHandler);
    this.updateMyProfile = this.crudHandler.updateMyProfile.bind(
      this.crudHandler
    );
    this.updateProfileById = this.crudHandler.updateProfileById.bind(
      this.crudHandler
    );
    this.deleteMyProfile = this.crudHandler.deleteMyProfile.bind(
      this.crudHandler
    );
    this.restoreMyProfile = this.crudHandler.restoreMyProfile.bind(
      this.crudHandler
    );
    this.permanentlyDeleteProfile =
      this.crudHandler.permanentlyDeleteProfile.bind(this.crudHandler);

    // Bind retrieval handlers
    this.getMyProfile = this.retrievalHandler.getMyProfile.bind(
      this.retrievalHandler
    );
    this.getCompleteProfile = this.retrievalHandler.getCompleteProfile.bind(
      this.retrievalHandler
    );
    this.getProfileByUserId = this.retrievalHandler.getProfileByUserId.bind(
      this.retrievalHandler
    );
    this.getProfileById = this.retrievalHandler.getProfileById.bind(
      this.retrievalHandler
    );
    this.searchProfiles = this.retrievalHandler.searchProfiles.bind(
      this.retrievalHandler
    );
    this.getProfilesByUserIds = this.retrievalHandler.getProfilesByUserIds.bind(
      this.retrievalHandler
    );
    this.getMyProfileStats = this.retrievalHandler.getMyProfileStats.bind(
      this.retrievalHandler
    );

    // Bind admin handlers
    this.getAllProfiles = this.adminHandler.getAllProfiles.bind(
      this.adminHandler
    );
    this.checkProfileExists = this.adminHandler.checkProfileExists.bind(
      this.adminHandler
    );
    this.bulkUpdateProfiles = this.adminHandler.bulkUpdateProfiles.bind(
      this.adminHandler
    );
  }
}

// Create and export a singleton instance
const userProfileController = new UserProfileController();

// Export individual handlers for use in routes
export const {
  // CRUD Operations
  createProfile,
  updateMyProfile,
  updateProfileById,
  deleteMyProfile,
  restoreMyProfile,
  permanentlyDeleteProfile,

  // Retrieval Operations
  getMyProfile,
  getCompleteProfile,
  getProfileByUserId,
  getProfileById,
  searchProfiles,
  getProfilesByUserIds,
  getMyProfileStats,

  // Admin Operations
  getAllProfiles,
  checkProfileExists,
  bulkUpdateProfiles,
} = userProfileController;

export default UserProfileController;
