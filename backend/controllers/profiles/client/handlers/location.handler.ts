// handlers/profiles/client/location.handler.ts
import { Response } from "express";
import { clientProfileService } from "../../../../services/profiles/client.profile.service";
import { Coordinates } from "../../../../types/base.types";
import { AuthenticatedRequest } from "../../../../types/user.types";
import { handleError } from "../../../../utils/controller-utils/controller.utils";

/**
 * Client Location Handlers
 * Handles location-related operations for client profiles
 */
export class ClientLocationHandlers {
  /**
   * POST /api/clients/location/enrich
   * Enrich location data using Ghana Post GPS
   */
  async enrichLocation(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { ghanaPostGPS, coordinates, nearbyLandmark } = req.body;

      if (!ghanaPostGPS) {
        res.status(400).json({
          success: false,
          message: "Ghana Post GPS is required",
        });
        return;
      }

      const result = await clientProfileService.enrichLocationData(
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
        data: { location: result.location },
      });
    } catch (error) {
      handleError(res, error, "Failed to enrich location data");
    }
  }

  /**
   * POST /api/clients/location/verify
   * Verify location coordinates against Ghana Post GPS
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
          message: "Ghana Post GPS and coordinates are required",
        });
        return;
      }

      if (!coordinates.latitude || !coordinates.longitude) {
        res.status(400).json({
          success: false,
          message: "Valid latitude and longitude are required",
        });
        return;
      }

      const result = await clientProfileService.verifyLocation(
        ghanaPostGPS,
        coordinates
      );

      res.status(200).json({
        success: true,
        message: "Location verification completed",
        data: result,
      });
    } catch (error) {
      handleError(res, error, "Failed to verify location");
    }
  }

  /**
   * POST /api/clients/location/geocode
   * Geocode an address to get coordinates
   */
  async geocodeAddress(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { address } = req.body;

      if (!address) {
        res.status(400).json({
          success: false,
          message: "Address is required",
        });
        return;
      }

      const result = await clientProfileService.geocodeAddress(address);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.error || "Failed to geocode address",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Address geocoded successfully",
        data: {
          coordinates: result.coordinates,
          displayName: result.displayName,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to geocode address");
    }
  }

  /**
   * POST /api/clients/location/distance
   * Calculate distance between two coordinates
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

      if (!from.latitude || !from.longitude || !to.latitude || !to.longitude) {
        res.status(400).json({
          success: false,
          message:
            "Valid latitude and longitude are required for both locations",
        });
        return;
      }

      const fromCoords: Coordinates = {
        latitude: parseFloat(from.latitude),
        longitude: parseFloat(from.longitude),
      };

      const toCoords: Coordinates = {
        latitude: parseFloat(to.latitude),
        longitude: parseFloat(to.longitude),
      };

      // Use the private method through a simple calculation
      const R = 6371; // Earth's radius in kilometers
      const dLat = this.toRadians(toCoords.latitude - fromCoords.latitude);
      const dLon = this.toRadians(toCoords.longitude - fromCoords.longitude);

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(this.toRadians(fromCoords.latitude)) *
          Math.cos(this.toRadians(toCoords.latitude)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distanceKm = R * c;

      const distanceFormatted =
        distanceKm < 1
          ? `${Math.round(distanceKm * 1000)}m`
          : `${distanceKm.toFixed(1)}km`;

      res.status(200).json({
        success: true,
        message: "Distance calculated successfully",
        data: {
          from: fromCoords,
          to: toCoords,
          distanceKm: parseFloat(distanceKm.toFixed(2)),
          distanceFormatted,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to calculate distance");
    }
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

export default new ClientLocationHandlers();
