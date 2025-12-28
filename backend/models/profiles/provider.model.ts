// models/provider-profile.model.ts
import { Schema, model, HydratedDocument } from "mongoose";
import { idType } from "../../types/base.types";
import {
  ProviderProfile,
  ProviderProfileModel,
  ProviderProfileMethods,
} from "../../types/profiles/providerProfile.types";

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

/**
 * Contact Details Sub-Schema
 */
const contactDetailsSchema = new Schema(
  {
    primaryContact: {
      type: String,
      required: true,
      trim: true,
    },
    secondaryContact: {
      type: String,
      trim: true,
    },
    businessContact: {
      type: String,
      trim: true,
    },
    businessEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
  },
  { _id: false }
);

/**
 * ID Details Sub-Schema
 */
const idDetailsSchema = new Schema(
  {
    idType: {
      type: String,
      enum: Object.values(idType),
      required: true,
    },
    idNumber: {
      type: String,
      required: true,
      trim: true,
    },
    fileImage: [
      {
        type: Schema.Types.ObjectId,
        ref: "File",
        required: true,
      },
    ],
  },
  { _id: false }
);

/**
 * Working Hours Sub-Schema
 */
const workingHoursSchema = new Schema(
  {
    start: {
      type: String,
      required: true,
    },
    end: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

/**
 * Provider Profile Schema
 */
const providerProfileSchema = new Schema<
  ProviderProfile,
  ProviderProfileModel,
  ProviderProfileMethods
>(
  {
    profile: {
      type: Schema.Types.ObjectId,
      ref: "UserProfile",
      required: true,
      unique: true,
      index: true,
    },

    // Business & Identity Information
    businessName: {
      type: String,
      trim: true,
    },
    IdDetails: {
      type: idDetailsSchema,
    },
    isCompanyTrained: {
      type: Boolean,
      default: false,
    },

    // Service Details
    serviceOfferings: [
      {
        type: Schema.Types.ObjectId,
        ref: "Service",
      },
    ],
    BusinessGalleryImages: [
      {
        type: Schema.Types.ObjectId,
        ref: "File",
      },
    ],

    // Contact & Location
    providerContactInfo: {
      type: contactDetailsSchema,
      required: true,
    },
    locationData: {
      type: userLocationSchema,
      required: true,
    },

    // Availability & Scheduling
    isAlwaysAvailable: {
      type: Boolean,
      default: true,
    },
    workingHours: {
      type: Map,
      of: workingHoursSchema,
    },

    // Payments & Deposits
    requireInitialDeposit: {
      type: Boolean,
      default: false,
    },
    percentageDeposit: {
      type: Number,
      min: 0,
      max: 100,
    },

    // Soft Delete Fields
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    collection: "provider_profiles",
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

/**
 * Indexes for performance
 */
providerProfileSchema.index({ profile: 1 });
providerProfileSchema.index({ isDeleted: 1 });
providerProfileSchema.index({ "locationData.region": 1 });
providerProfileSchema.index({ "locationData.city": 1 });
providerProfileSchema.index({ serviceOfferings: 1 });
providerProfileSchema.index({ profile: 1, isDeleted: 1 });

/**
 * Pre-save middleware for validation
 */
providerProfileSchema.pre("save", async function () {
  // Ensure working hours is empty if always available
  if (this.isAlwaysAvailable && this.workingHours) {
    this.workingHours = undefined;
  }

  // Ensure percentage deposit is set if required
  if (this.requireInitialDeposit && this.percentageDeposit === undefined) {
    throw new Error(
      "Percentage deposit must be specified when requiring deposit"
    );
  }

  // Ensure percentage deposit is not set if not required
  if (!this.requireInitialDeposit && this.percentageDeposit !== undefined) {
    this.percentageDeposit = undefined;
  }
});

/**
 * Instance Methods
 */
providerProfileSchema.methods.softDelete = function (
  this: HydratedDocument<ProviderProfile, ProviderProfileMethods>,
  deletedBy?: string
) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  if (deletedBy) this.deletedBy = deletedBy as any;
  return this.save();
};

providerProfileSchema.methods.restore = function (
  this: HydratedDocument<ProviderProfile, ProviderProfileMethods>
) {
  this.isDeleted = false;
  this.deletedAt = undefined;
  this.deletedBy = undefined;
  return this.save();
};

/**
 * Static Methods
 */
providerProfileSchema.statics.findActive = function () {
  return this.find({ isDeleted: { $ne: true } });
};

providerProfileSchema.statics.findByLocation = function (
  region: string,
  city?: string
) {
  const query: Record<string, any> = {
    isDeleted: { $ne: true },
    "locationData.region": region,
  };
  if (city) query["locationData.city"] = city;
  return this.find(query);
};

providerProfileSchema.statics.findByProfile = function (profileId: string) {
  return this.findOne({
    profile: profileId,
    isDeleted: { $ne: true },
  });
};

providerProfileSchema.statics.findByService = function (serviceId: string) {
  return this.find({
    serviceOfferings: serviceId,
    isDeleted: { $ne: true },
  });
};

/**
 * Virtual for checking if profile is active
 */
providerProfileSchema.virtual("isActive").get(function () {
  return !this.isDeleted;
});

/**
 * Virtual for checking if address is verified
 */
providerProfileSchema.virtual("hasVerifiedAddress").get(function () {
  return this.locationData?.isAddressVerified || false;
});

/**
 * Export the model
 */
export const ProviderModel = model<ProviderProfile, ProviderProfileModel>(
  "ProviderProfile",
  providerProfileSchema
);
