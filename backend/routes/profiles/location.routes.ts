// routes/location.routes.ts

import { Router } from "express";

import { authenticateToken } from "../../middleware/auth.middleware";
import { enrichLocationData, verifyLocation, batchGeocode, geocodeAddress, reverseGeocode, searchNearby, calculateDistance, getPlaceDetails } from "../../controllers/profiles/providers/location.controller";

const router = Router();

// ============================================
// Private Location Operations (Require Authentication)
// ============================================

/**
 * @route   POST /api/location/enrich
 * @desc    Enrich location data with OpenStreetMap details (for profile creation/update)
 * @access  Private
 * @body    { ghanaPostGPS: string, coordinates?: { latitude: number, longitude: number }, nearbyLandmark?: string }
 * @returns { success: boolean, message: string, data: UserLocation }
 */
router.post("/enrich", authenticateToken, enrichLocationData);

/**
 * @route   POST /api/location/verify
 * @desc    Verify if coordinates match Ghana Post GPS address (for profile verification)
 * @access  Private
 * @body    { ghanaPostGPS: string, coordinates: { latitude: number, longitude: number } }
 * @returns { success: boolean, data: { verified: boolean, confidence: number, actualLocation?: string, distanceKm?: number, message: string } }
 */
router.post("/verify", authenticateToken, verifyLocation);

/**
 * @route   POST /api/location/batch-geocode
 * @desc    Geocode multiple addresses at once (max 20) - admin/bulk operations
 * @access  Private
 * @body    { addresses: string[] }
 * @returns { success: boolean, data: Record<string, GeocodingResult>, count: number }
 */
router.post("/batch-geocode", authenticateToken, batchGeocode);

// ============================================
// Public Location Operations (No Authentication)
// ============================================

/**
 * @route   POST /api/location/geocode
 * @desc    Convert address to coordinates (forward geocoding) - public for map browsing
 * @access  Public
 * @body    { address: string }
 * @returns { success: boolean, data: { coordinates: Coordinates, displayName: string } }
 */
router.post("/geocode", geocodeAddress);

/**
 * @route   POST /api/location/reverse-geocode
 * @desc    Convert coordinates to address (reverse geocoding) - public for map browsing
 * @access  Public
 * @body    { latitude: number, longitude: number }
 * @returns { success: boolean, data: { location: UserLocation, coordinates: Coordinates, displayName: string } }
 */
router.post("/reverse-geocode", reverseGeocode);

/**
 * @route   POST /api/location/search-nearby
 * @desc    Search for nearby places (POIs, landmarks, etc.) - public for discovery
 * @access  Public
 * @body    { latitude: number, longitude: number, query: string, radiusKm?: number }
 * @returns { success: boolean, data: GeocodingResult[], count: number }
 */
router.post("/search-nearby", searchNearby);

/**
 * @route   POST /api/location/calculate-distance
 * @desc    Calculate distance between two coordinates - public utility
 * @access  Public
 * @body    { from: { latitude: number, longitude: number }, to: { latitude: number, longitude: number } }
 * @returns { success: boolean, data: { distanceKm: number, distanceFormatted: string, from: Coordinates, to: Coordinates } }
 */
router.post("/calculate-distance", calculateDistance);

/**
 * @route   GET /api/location/place/:osmType/:osmId
 * @desc    Get place details by OpenStreetMap ID - public for discovery
 * @access  Public
 * @params  osmType: 'N' | 'W' | 'R' (Node, Way, or Relation), osmId: number
 * @returns { success: boolean, data: { location: UserLocation, coordinates: Coordinates, rawResponse: any } }
 */
router.get("/place/:osmType/:osmId", getPlaceDetails);

export default router;