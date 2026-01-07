import { Schema } from "mongoose";

/**
 * Coordinates Sub-Schema
 */
const coordinatesSchema = new Schema(
  {
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

/**
 * User Location Sub-Schema
 */
export const userLocationSchema = new Schema(
  {
    ghanaPostGPS: {
      type: String,
      required: true,
      trim: true,
    },
    nearbyLandmark: {
      type: String,
      trim: true,
    },
    region: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    district: {
      type: String,
      trim: true,
    },
    locality: {
      type: String,
      trim: true,
    },
    streetName: {
      type: String,
      trim: true,
    },
    houseNumber: {
      type: String,
      trim: true,
    },
    gpsCoordinates: {
      type: coordinatesSchema,
    },
    isAddressVerified: {
      type: Boolean,
      default: false,
    },
    sourceProvider: {
      type: String,
      enum: ["openstreetmap", "google", "ghanapost"],
    },
  },
  { timestamps: true, _id: false }
);
