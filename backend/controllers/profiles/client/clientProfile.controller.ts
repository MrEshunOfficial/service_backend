// controllers/profiles/client/clientProfile.controller.ts

import { BaseClientHandlers } from "./handlers/base.handler";
import { ClientProfileHandlers } from "./handlers/client.profile.handler";
import { ClientLocationHandlers } from "./handlers/location.handler";
import { ClientManagementHandlers } from "./handlers/management.handler";
import { ClientSearchHandlers } from "./handlers/search.handler";
import { ClientVerificationHandlers } from "./handlers/verification.handler";

/**
 * Client Profile Controller
 *
 * Handles HTTP requests for client profile management endpoints.
 * Delegates to specialized handler classes for better organization.
 * Integrates location services, verification, and management operations.
 */
export class ClientProfileController {
  private profileHandler: ClientProfileHandlers;
  private searchHandler: ClientSearchHandlers;
  private managementHandler: ClientManagementHandlers;
  private verificationHandler: ClientVerificationHandlers;
  private baseHandler: BaseClientHandlers;
  private locationHandler: ClientLocationHandlers;

  // Profile CRUD Operations
  public createClientProfile;
  public getClientProfile;
  public getClientByUserId;
  public getMyClientProfile;
  public getMyCompleteProfile;
  public updateClientProfile;
  public updateMyClientProfile;
  public deleteClientProfile;
  public restoreClientProfile;
  public updateIdDetails;
  public updateMyIdDetails;
  public getClientStats;

  // Search & Discovery Operations
  public findNearestClients;
  public findClientsByLocation;
  public searchClients;
  public getClientsByFavoriteService;
  public getClientsByFavoriteProvider;

  // Management Operations
  public manageFavorites;
  public manageMyFavorites;
  public manageAddress;
  public manageMyAddress;
  public addPaymentMethod;
  public removePaymentMethod;
  public updateCommunicationPreferences;
  public updateMyCommunicationPreferences;
  public updateEmergencyContact;
  public removeEmergencyContact;
  public updatePreferredCategories;
  public updateLanguagePreference;

  // Verification Operations
  public updateVerificationStatus;
  public verifyPhone;
  public verifyEmail;
  public verifyId;
  public getVerificationStatus;

  // Base & Utility Operations
  public healthCheck;
  public getStatistics;
  public getAvailableRegions;
  public getAllVerifiedClients;

  // Location Operations
  public enrichLocation;
  public verifyLocation;
  public geocodeAddress;
  public calculateDistance;

  constructor() {
    this.profileHandler = new ClientProfileHandlers();
    this.searchHandler = new ClientSearchHandlers();
    this.managementHandler = new ClientManagementHandlers();
    this.verificationHandler = new ClientVerificationHandlers();
    this.baseHandler = new BaseClientHandlers();
    this.locationHandler = new ClientLocationHandlers();

    // Bind Profile CRUD handlers
    this.createClientProfile = this.profileHandler.createClientProfile.bind(
      this.profileHandler
    );
    this.getClientProfile = this.profileHandler.getClientProfile.bind(
      this.profileHandler
    );
    this.getClientByUserId = this.profileHandler.getClientByUserId.bind(
      this.profileHandler
    );
    this.getMyClientProfile = this.profileHandler.getMyClientProfile.bind(
      this.profileHandler
    );
    this.getMyCompleteProfile = this.profileHandler.getMyCompleteProfile.bind(
      this.profileHandler
    );
    this.updateClientProfile = this.profileHandler.updateClientProfile.bind(
      this.profileHandler
    );
    this.updateMyClientProfile = this.profileHandler.updateMyClientProfile.bind(
      this.profileHandler
    );
    this.deleteClientProfile = this.profileHandler.deleteClientProfile.bind(
      this.profileHandler
    );
    this.restoreClientProfile = this.profileHandler.restoreClientProfile.bind(
      this.profileHandler
    );
    this.updateIdDetails = this.profileHandler.updateIdDetails.bind(
      this.profileHandler
    );
    this.updateMyIdDetails = this.profileHandler.updateMyIdDetails.bind(
      this.profileHandler
    );
    this.getClientStats = this.profileHandler.getClientStats.bind(
      this.profileHandler
    );

    // Bind Search & Discovery handlers
    this.findNearestClients = this.searchHandler.findNearestClients.bind(
      this.searchHandler
    );
    this.findClientsByLocation = this.searchHandler.findClientsByLocation.bind(
      this.searchHandler
    );
    this.searchClients = this.searchHandler.searchClients.bind(
      this.searchHandler
    );
    this.getClientsByFavoriteService =
      this.searchHandler.getClientsByFavoriteService.bind(this.searchHandler);
    this.getClientsByFavoriteProvider =
      this.searchHandler.getClientsByFavoriteProvider.bind(this.searchHandler);

    // Bind Management handlers
    this.manageFavorites = this.managementHandler.manageFavorites.bind(
      this.managementHandler
    );
    this.manageMyFavorites = this.managementHandler.manageMyFavorites.bind(
      this.managementHandler
    );
    this.manageAddress = this.managementHandler.manageAddress.bind(
      this.managementHandler
    );
    this.manageMyAddress = this.managementHandler.manageMyAddress.bind(
      this.managementHandler
    );
    this.addPaymentMethod = this.managementHandler.addPaymentMethod.bind(
      this.managementHandler
    );
    this.removePaymentMethod = this.managementHandler.removePaymentMethod.bind(
      this.managementHandler
    );
    this.updateCommunicationPreferences =
      this.managementHandler.updateCommunicationPreferences.bind(
        this.managementHandler
      );
    this.updateMyCommunicationPreferences =
      this.managementHandler.updateMyCommunicationPreferences.bind(
        this.managementHandler
      );
    this.updateEmergencyContact =
      this.managementHandler.updateEmergencyContact.bind(
        this.managementHandler
      );
    this.removeEmergencyContact =
      this.managementHandler.removeEmergencyContact.bind(
        this.managementHandler
      );
    this.updatePreferredCategories =
      this.managementHandler.updatePreferredCategories.bind(
        this.managementHandler
      );
    this.updateLanguagePreference =
      this.managementHandler.updateLanguagePreference.bind(
        this.managementHandler
      );

    // Bind Verification handlers
    this.updateVerificationStatus =
      this.verificationHandler.updateVerificationStatus.bind(
        this.verificationHandler
      );
    this.verifyPhone = this.verificationHandler.verifyPhone.bind(
      this.verificationHandler
    );
    this.verifyEmail = this.verificationHandler.verifyEmail.bind(
      this.verificationHandler
    );
    this.verifyId = this.verificationHandler.verifyId.bind(
      this.verificationHandler
    );
    this.getVerificationStatus =
      this.verificationHandler.getVerificationStatus.bind(
        this.verificationHandler
      );

    // Bind Base & Utility handlers
    this.healthCheck = this.baseHandler.healthCheck.bind(this.baseHandler);
    this.getStatistics = this.baseHandler.getStatistics.bind(this.baseHandler);
    this.getAvailableRegions = this.baseHandler.getAvailableRegions.bind(
      this.baseHandler
    );
    this.getAllVerifiedClients = this.baseHandler.getAllVerifiedClients.bind(
      this.baseHandler
    );

    // Bind Location handlers
    this.enrichLocation = this.locationHandler.enrichLocation.bind(
      this.locationHandler
    );
    this.verifyLocation = this.locationHandler.verifyLocation.bind(
      this.locationHandler
    );
    this.geocodeAddress = this.locationHandler.geocodeAddress.bind(
      this.locationHandler
    );
    this.calculateDistance = this.locationHandler.calculateDistance.bind(
      this.locationHandler
    );
  }
}

// Create and export a singleton instance
const clientProfileController = new ClientProfileController();

// Export individual handlers for use in routes
export const {
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
} = clientProfileController;

export default ClientProfileController;
