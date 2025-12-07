// handlers/provider-profile/base-provider.handlers.ts
import { Response } from "express";
import { ProviderProfileService } from "../../../../../services/profiles/provider.profile.service";
import { Coordinates } from "../../../../../types/base.types";
import { AuthenticatedRequest } from "../../../../../types/user.types";
import { handleError, validateObjectId } from "../../../../../utils/controller-utils/controller.utils";

const providerService = new ProviderProfileService();

/**
 * Handler: Enrich Location Data
 * POST /api/providers/enrich-location
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
        message: "Ghana Post GPS is required",
      });
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
      data: result.location,
    });
  } catch (error) {
    return handleError(res, error, "Failed to enrich location data");
  }
};

/**
 * Handler: Verify Location
 * POST /api/providers/verify-location
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
        message: "Ghana Post GPS is required",
      });
    }

    if (!coordinates || !coordinates.latitude || !coordinates.longitude) {
      return res.status(400).json({
        success: false,
        message: "Valid coordinates are required",
      });
    }

    const result = await providerService.verifyLocation(ghanaPostGPS, coordinates);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return handleError(res, error, "Failed to verify location");
  }
};

/**
 * Handler: Geocode Address
 * POST /api/providers/geocode
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
      return res.status(400).json({
        success: false,
        message: result.error || "Failed to geocode address",
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
 * Handler: Get Distance to Provider
 * POST /api/providers/:providerId/distance
 * Body: { latitude, longitude }
 */
export const getDistanceToProviderHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { providerId } = req.params;
    const { latitude, longitude } = req.body;

    if (!validateObjectId(providerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid provider ID",
      });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    const customerLocation: Coordinates = { latitude, longitude };

    const distance = await providerService.getDistanceToProvider(
      customerLocation,
      providerId
    );

    if (!distance) {
      return res.status(404).json({
        success: false,
        message: "Provider not found or has no location data",
      });
    }

    return res.status(200).json({
      success: true,
      data: distance,
    });
  } catch (error) {
    return handleError(res, error, "Failed to calculate distance");
  }
};