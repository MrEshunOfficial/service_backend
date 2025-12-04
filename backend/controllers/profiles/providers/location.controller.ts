// controllers/location.controller.ts

import { enrichLocationDataHandler, verifyLocationHandler, geocodeAddressHandler, reverseGeocodeHandler, batchGeocodeHandler, searchNearbyHandler, calculateDistanceHandler, getPlaceDetailsHandler } from "./handlers/location.handler";

/**
 * Location Controller
 *
 * Handles HTTP requests for location-related endpoints.
 * Provides geocoding, reverse geocoding, location enrichment,
 * and verification services using OpenStreetMap.
 */
export class LocationController {
  // Location Enrichment & Verification
  public enrichLocationData;
  public verifyLocation;

  // Geocoding Operations
  public geocodeAddress;
  public reverseGeocode;
  public batchGeocode;

  // Location Search & Utility
  public searchNearby;
  public calculateDistance;
  public getPlaceDetails;

  constructor() {
    // Bind location enrichment & verification handlers
    this.enrichLocationData = enrichLocationDataHandler;
    this.verifyLocation = verifyLocationHandler;

    // Bind geocoding handlers
    this.geocodeAddress = geocodeAddressHandler;
    this.reverseGeocode = reverseGeocodeHandler;
    this.batchGeocode = batchGeocodeHandler;

    // Bind location search & utility handlers
    this.searchNearby = searchNearbyHandler;
    this.calculateDistance = calculateDistanceHandler;
    this.getPlaceDetails = getPlaceDetailsHandler;
  }
}

// Create and export a singleton instance
const locationController = new LocationController();

// Export individual handlers for use in routes
export const {
  // Location Enrichment & Verification
  enrichLocationData,
  verifyLocation,

  // Geocoding Operations
  geocodeAddress,
  reverseGeocode,
  batchGeocode,

  // Location Search & Utility
  searchNearby,
  calculateDistance,
  getPlaceDetails,
} = locationController;