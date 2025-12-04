// handlers/location.handlers.ts
import { Response } from "express";
import { ProviderProfileService } from "../../../../services/profiles/provider.profile.service";
import { Coordinates } from "../../../../types/base.types";
import { AuthenticatedRequest } from "../../../../types/user.types";
import { handleError } from "../../../../utils/controller-utils/controller.utils";
import { osmLocationService } from "../../../../services/profiles/openstreetmap.location.service";

const providerService = new ProviderProfileService();

/**
 * Handler: Enrich Location Data
 * POST /api/location/enrich
 * Body: { ghanaPostGPS, coordinates?, nearbyLandmark? }
 */
export const enrichLocationDataHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { ghanaPostGPS, coordinates, nearbyLandmark } = req.body;

    if (!ghanaPostGPS) {
      return res.status(400).json({
        success: false,
        message: "Ghana Post GPS address is required",
      });
    }

    // Validate coordinates if provided
    if (coordinates) {
      if (!coordinates.latitude || !coordinates.longitude) {
        return res.status(400).json({
          success: false,
          message: "Coordinates must include latitude and longitude",
        });
      }

      if (
        typeof coordinates.latitude !== "number" ||
        typeof coordinates.longitude !== "number"
      ) {
        return res.status(400).json({
          success: false,
          message: "Latitude and longitude must be numbers",
        });
      }
    }

    const result = await providerService.enrichLocationData(
      ghanaPostGPS,
      coordinates,
      nearbyLandmark
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || "Failed to enrich location data",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Location data enriched successfully",
      data: result.location,
    });
  } catch (error) {
    return handleError(res, error, "Failed to enrich location data");
  }
};

/**
 * Handler: Verify Location
 * POST /api/location/verify
 * Body: { ghanaPostGPS, coordinates }
 */
export const verifyLocationHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { ghanaPostGPS, coordinates } = req.body;

    if (!ghanaPostGPS) {
      return res.status(400).json({
        success: false,
        message: "Ghana Post GPS address is required",
      });
    }

    if (!coordinates || !coordinates.latitude || !coordinates.longitude) {
      return res.status(400).json({
        success: false,
        message: "Coordinates with latitude and longitude are required",
      });
    }

    if (
      typeof coordinates.latitude !== "number" ||
      typeof coordinates.longitude !== "number"
    ) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude must be numbers",
      });
    }

    const result = await providerService.verifyLocation(
      ghanaPostGPS,
      coordinates
    );

    return res.status(200).json({
      success: true,
      data: {
        verified: result.verified,
        confidence: result.confidence,
        actualLocation: result.actualLocation,
        distanceKm: result.distanceKm,
        message: result.verified
          ? "Location verified successfully"
          : "Location verification failed. Coordinates don't match Ghana Post GPS.",
      },
    });
  } catch (error) {
    return handleError(res, error, "Failed to verify location");
  }
};

/**
 * Handler: Geocode Address
 * POST /api/location/geocode
 * Body: { address }
 */
export const geocodeAddressHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        success: false,
        message: "Address is required",
      });
    }

    const result = await providerService.geocodeAddress(address);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.error || "Location not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        coordinates: result.coordinates,
        displayName: result.displayName,
      },
    });
  } catch (error) {
    return handleError(res, error, "Failed to geocode address");
  }
};

/**
 * Handler: Reverse Geocode Coordinates
 * POST /api/location/reverse-geocode
 * Body: { latitude, longitude }
 */
export const reverseGeocodeHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude must be numbers",
      });
    }

    // Use the OSM service directly for reverse geocoding
    
    const coordinates: Coordinates = { latitude, longitude };
    const result = await osmLocationService.reverseGeocode(coordinates);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || "Failed to reverse geocode coordinates",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        location: result.location,
        coordinates: result.coordinates,
        displayName: result.rawResponse?.display_name,
      },
    });
  } catch (error) {
    return handleError(res, error, "Failed to reverse geocode coordinates");
  }
};

/**
 * Handler: Search Nearby Places
 * POST /api/location/search-nearby
 * Body: { latitude, longitude, query, radiusKm? }
 */
export const searchNearbyHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { latitude, longitude, query, radiusKm } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude must be numbers",
      });
    }

    // Use the OSM service directly for nearby search
    
    const coordinates: Coordinates = { latitude, longitude };
    const results = await osmLocationService.searchNearby(
      coordinates,
      query,
      radiusKm || 5
    );

    return res.status(200).json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error) {
    return handleError(res, error, "Failed to search nearby places");
  }
};

/**
 * Handler: Calculate Distance Between Two Points
 * POST /api/location/calculate-distance
 * Body: { from: { latitude, longitude }, to: { latitude, longitude } }
 */
export const calculateDistanceHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { from, to } = req.body;

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: "Both 'from' and 'to' coordinates are required",
      });
    }

    if (
      !from.latitude ||
      !from.longitude ||
      !to.latitude ||
      !to.longitude
    ) {
      return res.status(400).json({
        success: false,
        message: "Both coordinates must include latitude and longitude",
      });
    }

    // Calculate distance using Haversine formula
    const calculateDistance = (
      coord1: Coordinates,
      coord2: Coordinates
    ): number => {
      const R = 6371; // Earth's radius in km
      const toRadians = (degrees: number) => degrees * (Math.PI / 180);
      
      const dLat = toRadians(coord2.latitude - coord1.latitude);
      const dLon = toRadians(coord2.longitude - coord1.longitude);

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(coord1.latitude)) *
          Math.cos(toRadians(coord2.latitude)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const formatDistance = (km: number): string => {
      if (km < 1) {
        return `${Math.round(km * 1000)}m`;
      }
      return `${km.toFixed(1)}km`;
    };

    const distanceKm = calculateDistance(from, to);

    return res.status(200).json({
      success: true,
      data: {
        distanceKm,
        distanceFormatted: formatDistance(distanceKm),
        from,
        to,
      },
    });
  } catch (error) {
    return handleError(res, error, "Failed to calculate distance");
  }
};

/**
 * Handler: Batch Geocode Addresses
 * POST /api/location/batch-geocode
 * Body: { addresses: string[] }
 */
export const batchGeocodeHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { addresses } = req.body;

    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({
        success: false,
        message: "Addresses array is required",
      });
    }

    if (addresses.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Addresses array cannot be empty",
      });
    }

    if (addresses.length > 20) {
      return res.status(400).json({
        success: false,
        message: "Maximum 20 addresses can be geocoded at once",
      });
    }

    // Use the OSM service directly for batch geocoding
    
    const results = await osmLocationService.batchGeocode(addresses);

    // Convert Map to object for JSON response
    const resultsObject: Record<string, any> = {};
    results.forEach((value, key) => {
      resultsObject[key] = value;
    });

    return res.status(200).json({
      success: true,
      data: resultsObject,
      count: results.size,
    });
  } catch (error) {
    return handleError(res, error, "Failed to batch geocode addresses");
  }
};

/**
 * Handler: Get Place Details by OSM ID
 * GET /api/location/place/:osmType/:osmId
 * Params: osmType (N|W|R), osmId (number)
 */
export const getPlaceDetailsHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { osmType, osmId } = req.params;

    if (!osmType || !osmId) {
      return res.status(400).json({
        success: false,
        message: "OSM type and ID are required",
      });
    }

    if (!["N", "W", "R"].includes(osmType)) {
      return res.status(400).json({
        success: false,
        message: "OSM type must be 'N' (Node), 'W' (Way), or 'R' (Relation)",
      });
    }

    const osmIdNumber = parseInt(osmId);
    if (isNaN(osmIdNumber)) {
      return res.status(400).json({
        success: false,
        message: "OSM ID must be a number",
      });
    }

    // Use the OSM service directly for place details
    
    const result = await osmLocationService.getPlaceDetails(
      osmType as "N" | "W" | "R",
      osmIdNumber
    );

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.error || "Place not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        location: result.location,
        coordinates: result.coordinates,
        rawResponse: result.rawResponse,
      },
    });
  } catch (error) {
    return handleError(res, error, "Failed to get place details");
  }
};