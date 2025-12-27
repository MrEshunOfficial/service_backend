// controllers/profiles/provider/providerProfile.controller.ts

import { ProviderAdminHandlers } from "./handlers/admin.handler";
import { BaseProviderHandlers } from "./handlers/base.handler";
import { LocationHandlers } from "./handlers/location.handlers";
import { ProviderProfileHandlers } from "./handlers/provider.profile.handler";
import { ProviderSearchHandlers } from "./handlers/search.handlers";

/**
 * Provider Profile Controller
 *
 * Handles HTTP requests for provider profile management endpoints.
 * Delegates to specialized handler classes for better organization.
 * Integrates location services and administrative operations.
 */
export class ProviderProfileController {
  private profileHandler: ProviderProfileHandlers;
  private searchHandler: ProviderSearchHandlers;
  private adminHandler: ProviderAdminHandlers;
  private baseHandler: BaseProviderHandlers;
  private locationHandler: LocationHandlers;

  // Profile CRUD Operations
  public createProviderProfile;
  public getProviderProfile;
  public getProviderByUserId;
  public getMyProviderProfile;
  public updateProviderProfile;
  public deleteProviderProfile;
  public restoreProviderProfile;
  public updateIdDetails;
  public updateMyIdDetails;
  public updateMyProviderProfile;

  // Search & Discovery Operations
  public findNearestProviders;
  public findProvidersByLocation;
  public searchProviders;
  public getDistanceToProvider;
  public findProvidersByService;
  public findNearbyServiceProviders;
  public findCompanyTrainedProviders;

  // Admin Operations
  public approveProvider;
  public rejectProvider;
  public suspendProvider;
  public unsuspendProvider;
  public bulkOperations;
  public generateProviderReport;
  public getAllProviders;
  public getProviderAuditLog;
  public getProviderStatistics;

  // Base & Utility Operations
  public healthCheck;
  public getStatistics;
  public getAvailableRegions;
  public getAvailableCities;
  public getServiceCoverage;

  // Location Operations
  public enrichLocation;
  public verifyLocation;
  public geocodeAddress;
  public reverseGeocode;
  public searchNearby;
  public calculateDistance;

  constructor() {
    this.profileHandler = new ProviderProfileHandlers();
    this.searchHandler = new ProviderSearchHandlers();
    this.adminHandler = new ProviderAdminHandlers();
    this.baseHandler = new BaseProviderHandlers();
    this.locationHandler = new LocationHandlers();

    // Bind Profile CRUD handlers
    this.createProviderProfile = this.profileHandler.createProviderProfile.bind(
      this.profileHandler
    );
    this.getProviderProfile = this.profileHandler.getProviderProfile.bind(
      this.profileHandler
    );
    this.getProviderByUserId = this.profileHandler.getProviderByUserId.bind(
      this.profileHandler
    );
    this.getMyProviderProfile = this.profileHandler.getMyProviderProfile.bind(
      this.profileHandler
    );
    this.updateProviderProfile = this.profileHandler.updateProviderProfile.bind(
      this.profileHandler
    );
    this.deleteProviderProfile = this.profileHandler.deleteProviderProfile.bind(
      this.profileHandler
    );
    this.restoreProviderProfile =
      this.profileHandler.restoreProviderProfile.bind(this.profileHandler);
    this.updateIdDetails = this.profileHandler.updateIdDetails.bind(
      this.profileHandler
    );
    this.updateMyProviderProfile =
      this.profileHandler.updateMyProviderProfile.bind(this.profileHandler);
    // NEW: Bind the new updateMyIdDetails handler
    this.updateMyIdDetails = this.profileHandler.updateMyIdDetails.bind(
      this.profileHandler
    );

    // Bind Search & Discovery handlers
    this.findNearestProviders = this.searchHandler.findNearestProviders.bind(
      this.searchHandler
    );
    this.findProvidersByLocation =
      this.searchHandler.findProvidersByLocation.bind(this.searchHandler);
    this.searchProviders = this.searchHandler.searchProviders.bind(
      this.searchHandler
    );
    this.getDistanceToProvider = this.searchHandler.getDistanceToProvider.bind(
      this.searchHandler
    );
    this.findProvidersByService =
      this.searchHandler.findProvidersByService.bind(this.searchHandler);
    this.findNearbyServiceProviders =
      this.searchHandler.findNearbyServiceProviders.bind(this.searchHandler);
    this.findCompanyTrainedProviders =
      this.searchHandler.findCompanyTrainedProviders.bind(this.searchHandler);

    // Bind Admin handlers
    this.approveProvider = this.adminHandler.approveProvider.bind(
      this.adminHandler
    );
    this.rejectProvider = this.adminHandler.rejectProvider.bind(
      this.adminHandler
    );
    this.suspendProvider = this.adminHandler.suspendProvider.bind(
      this.adminHandler
    );
    this.unsuspendProvider = this.adminHandler.unsuspendProvider.bind(
      this.adminHandler
    );
    this.bulkOperations = this.adminHandler.bulkOperations.bind(
      this.adminHandler
    );
    this.generateProviderReport = this.adminHandler.generateProviderReport.bind(
      this.adminHandler
    );
    this.getAllProviders = this.adminHandler.getAllProviders.bind(
      this.adminHandler
    );
    this.getProviderAuditLog = this.adminHandler.getProviderAuditLog.bind(
      this.adminHandler
    );
    this.getProviderStatistics = this.adminHandler.getProviderStatistics.bind(
      this.adminHandler
    );

    // Bind Base & Utility handlers
    this.healthCheck = this.baseHandler.healthCheck.bind(this.baseHandler);
    this.getStatistics = this.baseHandler.getStatistics.bind(this.baseHandler);
    this.getAvailableRegions = this.baseHandler.getAvailableRegions.bind(
      this.baseHandler
    );
    this.getAvailableCities = this.baseHandler.getAvailableCities.bind(
      this.baseHandler
    );
    this.getServiceCoverage = this.baseHandler.getServiceCoverage.bind(
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
    this.reverseGeocode = this.locationHandler.reverseGeocode.bind(
      this.locationHandler
    );
    this.searchNearby = this.locationHandler.searchNearby.bind(
      this.locationHandler
    );
    this.calculateDistance = this.locationHandler.calculateDistance.bind(
      this.locationHandler
    );
  }
}

// Create and export a singleton instance
const providerProfileController = new ProviderProfileController();

// Export individual handlers for use in routes
export const {
  // Profile CRUD Operations
  createProviderProfile,
  getProviderProfile,
  getProviderByUserId,
  getMyProviderProfile,
  updateProviderProfile,
  deleteProviderProfile,
  restoreProviderProfile,
  updateIdDetails,
  updateMyIdDetails,
  updateMyProviderProfile,

  // Search & Discovery Operations
  findNearestProviders,
  findProvidersByLocation,
  searchProviders,
  getDistanceToProvider,
  findProvidersByService,
  findNearbyServiceProviders,
  findCompanyTrainedProviders,

  // Admin Operations
  approveProvider,
  rejectProvider,
  suspendProvider,
  unsuspendProvider,
  bulkOperations,
  generateProviderReport,
  getAllProviders,
  getProviderAuditLog,
  getProviderStatistics,

  // Base & Utility Operations
  healthCheck,
  getStatistics,
  getAvailableRegions,
  getAvailableCities,
  getServiceCoverage,

  // Location Operations
  enrichLocation,
  verifyLocation,
  geocodeAddress,
  reverseGeocode,
  searchNearby,
  calculateDistance,
} = providerProfileController;

export default ProviderProfileController;
