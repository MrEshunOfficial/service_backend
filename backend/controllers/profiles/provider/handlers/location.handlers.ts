// handlers/location.handlers.ts
import { Response } from "express";
import { osmLocationService } from "../../../../services/profiles/openstreetmap.location.service";
import { Coordinates } from "../../../../types/base.types";
import { AuthenticatedRequest } from "../../../../types/user.types";
import { handleError } from "../../../../utils/controller-utils/controller.utils";

/**
 * Location Handlers
 * Handles location enrichment, verification, and geocoding operations
 */
export class LocationHandlers {
  /**
   * POST /api/location/enrich
   * Enriches location data using Ghana Post GPS, coordinates, and/or landmarks
   */
  async enrichLocation(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { ghanaPostGPS, coordinates, nearbyLandmark } = req.body;

      if (!ghanaPostGPS && !coordinates && !nearbyLandmark) {
        res.status(400).json({
          success: false,
          message:
            "At least one of ghanaPostGPS, coordinates, or nearbyLandmark is required",
        });
        return;
      }

      const result = await osmLocationService.enrichLocationData(
        ghanaPostGPS,
        coordinates,
        nearbyLandmark
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.error || "Failed to enrich location data",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Location data enriched successfully",
        data: {
          location: result.location,
          coordinates: result.coordinates,
          source: result.location?.sourceProvider,
          verified: result.location?.isAddressVerified,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to enrich location data");
    }
  }

  /**
   * POST /api/location/verify
   * Verifies that provided coordinates match the Ghana Post GPS code
   */
  async verifyLocation(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { ghanaPostGPS, coordinates } = req.body;

      if (!ghanaPostGPS || !coordinates) {
        res.status(400).json({
          success: false,
          message: "ghanaPostGPS and coordinates are required",
        });
        return;
      }

      if (
        typeof coordinates.latitude !== "number" ||
        typeof coordinates.longitude !== "number"
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid coordinates format",
        });
        return;
      }

      const result = await osmLocationService.verifyLocation(
        ghanaPostGPS,
        coordinates
      );

      res.status(200).json({
        success: true,
        message: result.verified
          ? "Location verified successfully"
          : "Location verification failed",
        data: {
          verified: result.verified,
          confidence: result.confidence,
          distanceKm: result.distanceKm,
          actualLocation: result.actualLocation,
          warning:
            result.confidence < 0.5
              ? "Low confidence - coordinates may not match GPS code"
              : undefined,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to verify location");
    }
  }

  /**
   * POST /api/location/geocode
   * Converts an address string to GPS coordinates
   */
  async geocodeAddress(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { address, countryCode = "gh" } = req.body;

      if (!address) {
        res.status(400).json({
          success: false,
          message: "Address is required",
        });
        return;
      }

      const result = await osmLocationService.geocode(address, countryCode);

      if (!result.success) {
        res.status(404).json({
          success: false,
          message: result.error || "Location not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Address geocoded successfully",
        data: {
          coordinates: result.coordinates,
          displayName: result.displayName,
          address: result.address,
          confidence: result.confidence,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to geocode address");
    }
  }

  /**
   * POST /api/location/reverse-geocode
   * Converts GPS coordinates to a human-readable address
   */
  async reverseGeocode(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { coordinates } = req.body;

      if (!coordinates) {
        res.status(400).json({
          success: false,
          message: "Coordinates are required",
        });
        return;
      }

      if (
        typeof coordinates.latitude !== "number" ||
        typeof coordinates.longitude !== "number"
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid coordinates format",
        });
        return;
      }

      const result = await osmLocationService.reverseGeocode(coordinates);

      if (!result.success) {
        res.status(404).json({
          success: false,
          message: result.error || "Location not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Coordinates reverse geocoded successfully",
        data: {
          location: result.location,
          coordinates: result.coordinates,
          displayName: (result.rawResponse as any)?.display_name,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to reverse geocode coordinates");
    }
  }

  /**
   * POST /api/location/search-nearby
   * Searches for places near given coordinates
   */
  async searchNearby(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { coordinates, query, radiusKm = 5 } = req.body;

      if (!coordinates || !query) {
        res.status(400).json({
          success: false,
          message: "Coordinates and search query are required",
        });
        return;
      }

      if (
        typeof coordinates.latitude !== "number" ||
        typeof coordinates.longitude !== "number"
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid coordinates format",
        });
        return;
      }

      const results = await osmLocationService.searchNearby(
        coordinates,
        query,
        radiusKm
      );

      res.status(200).json({
        success: true,
        message: `Found ${results.length} nearby places`,
        data: {
          results: results.map((r) => ({
            coordinates: r.coordinates,
            displayName: r.displayName,
            address: r.address,
            confidence: r.confidence,
          })),
          searchCenter: coordinates,
          radiusKm,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to search nearby places");
    }
  }

  /**
   * POST /api/location/calculate-distance
   * Calculates distance between two coordinate points
   */
  async calculateDistance(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { from, to } = req.body;

      if (!from || !to) {
        res.status(400).json({
          success: false,
          message: "Both 'from' and 'to' coordinates are required",
        });
        return;
      }

      if (
        typeof from.latitude !== "number" ||
        typeof from.longitude !== "number" ||
        typeof to.latitude !== "number" ||
        typeof to.longitude !== "number"
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid coordinates format",
        });
        return;
      }

      const distanceKm = this.haversineDistance(from, to);

      res.status(200).json({
        success: true,
        message: "Distance calculated successfully",
        data: {
          distanceKm: parseFloat(distanceKm.toFixed(2)),
          distanceM: Math.round(distanceKm * 1000),
          distanceFormatted: this.formatDistance(distanceKm),
          from,
          to,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to calculate distance");
    }
  }

  /**
   * Haversine formula to calculate distance between two coordinates
   */
  private haversineDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(coord2.latitude - coord1.latitude);
    const dLon = this.toRadians(coord2.longitude - coord1.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(coord1.latitude)) *
        Math.cos(this.toRadians(coord2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private formatDistance(km: number): string {
    if (km < 1) {
      return `${Math.round(km * 1000)}m`;
    }
    return `${km.toFixed(1)}km`;
  }
}

export default new LocationHandlers();
