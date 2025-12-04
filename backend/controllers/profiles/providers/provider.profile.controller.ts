// controllers/provider-profile.controller.ts

import { createProviderProfileHandler, updateProviderProfileHandler, deleteProviderProfileHandler, restoreProviderProfileHandler, getProviderProfileHandler, getProviderByProfileHandler, getMyProviderProfileHandler, findNearestProvidersHandler, findProvidersByLocationHandler, getDistanceToProviderHandler, searchProvidersHandler, addServiceToProviderHandler, removeServiceFromProviderHandler, getAvailablePrivateServicesHandler } from "./handlers/provider.profile.handlers";



/**
 * Provider Profile Controller
 *
 * Handles HTTP requests for provider profile management endpoints.
 * Includes CRUD operations, location-based searches, service management,
 * and distance calculations.
 */
export class ProviderProfileController {
  // CRUD Operations
  public createProviderProfile;
  public updateProviderProfile;
  public deleteProviderProfile;
  public restoreProviderProfile;

  // Retrieval Operations
  public getProviderProfile;
  public getProviderByProfile;
  public getMyProviderProfile;

  // Location-Based Operations
  public findNearestProviders;
  public findProvidersByLocation;
  public getDistanceToProvider;
  public searchProviders;

  // Service Management
  public addServiceToProvider;
  public removeServiceFromProvider;
  public getAvailablePrivateServices;

  constructor() {
    // Bind CRUD handlers
    this.createProviderProfile = createProviderProfileHandler;
    this.updateProviderProfile = updateProviderProfileHandler;
    this.deleteProviderProfile = deleteProviderProfileHandler;
    this.restoreProviderProfile = restoreProviderProfileHandler;

    // Bind retrieval handlers
    this.getProviderProfile = getProviderProfileHandler;
    this.getProviderByProfile = getProviderByProfileHandler;
    this.getMyProviderProfile = getMyProviderProfileHandler;

    // Bind location-based handlers
    this.findNearestProviders = findNearestProvidersHandler;
    this.findProvidersByLocation = findProvidersByLocationHandler;
    this.getDistanceToProvider = getDistanceToProviderHandler;
    this.searchProviders = searchProvidersHandler;

    // Bind service management handlers
    this.addServiceToProvider = addServiceToProviderHandler;
    this.removeServiceFromProvider = removeServiceFromProviderHandler;
    this.getAvailablePrivateServices = getAvailablePrivateServicesHandler;
  }
}

// Create and export a singleton instance
const providerProfileController = new ProviderProfileController();

// Export individual handlers for use in routes
export const {
  // CRUD Operations
  createProviderProfile,
  updateProviderProfile,
  deleteProviderProfile,
  restoreProviderProfile,

  // Retrieval Operations
  getProviderProfile,
  getProviderByProfile,
  getMyProviderProfile,

  // Location-Based Operations
  findNearestProviders,
  findProvidersByLocation,
  getDistanceToProvider,
  searchProviders,

  // Service Management
  addServiceToProvider,
  removeServiceFromProvider,
  getAvailablePrivateServices,
} = providerProfileController;