// models/client-profile.model.ts
import { Schema, model, HydratedDocument, Types } from "mongoose";
import { idType } from "../../types/base.types";
import {
  ClientProfile,
  ClientProfileModel,
  ClientProfileMethods,
} from "../../types/profiles/client.profile.types";

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
const userLocationSchema = new Schema(
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
 * Client Contact Details Sub-Schema
 */
const clientContactDetailsSchema = new Schema(
  {
    secondaryContact: {
      type: String,
      trim: true,
    },
    emailAddress: {
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
 * Communication Preferences Sub-Schema
 */
const communicationPreferencesSchema = new Schema(
  {
    emailNotifications: {
      type: Boolean,
      default: true,
    },
    smsNotifications: {
      type: Boolean,
      default: true,
    },
    pushNotifications: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

/**
 * Preferences Sub-Schema
 */
const preferencesSchema = new Schema(
  {
    preferredCategories: [
      {
        type: Schema.Types.ObjectId,
        ref: "ServiceCategory",
      },
    ],
    communicationPreferences: {
      type: communicationPreferencesSchema,
      default: () => ({}),
    },
    languagePreference: {
      type: String,
      default: "en",
      trim: true,
    },
  },
  { _id: false }
);

/**
 * Payment Method Sub-Schema
 */
const paymentMethodSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["mobile_money", "card", "bank_account"],
      required: true,
    },
    provider: {
      type: String,
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    label: {
      type: String,
      trim: true,
    },
  },
  { _id: true }
);

/**
 * Verification Details Sub-Schema
 */
const verificationDetailsSchema = new Schema(
  {
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    idVerified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
    },
  },
  { _id: false }
);

/**
 * Emergency Contact Sub-Schema
 */
const emergencyContactSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    relationship: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

/**
 * Client Profile Schema
 */
const clientProfileSchema = new Schema<
  ClientProfile,
  ClientProfileModel,
  ClientProfileMethods
>(
  {
    profile: {
      type: Schema.Types.ObjectId,
      ref: "UserProfile",
      required: true,
      unique: true,
      index: true,
    },

    // Personal Information
    preferredName: {
      type: String,
      trim: true,
    },
    dateOfBirth: {
      type: Date,
    },
    idDetails: {
      type: idDetailsSchema,
    },

    // Contact & Location
    clientContactInfo: {
      type: clientContactDetailsSchema,
      required: true,
    },
    savedAddresses: [userLocationSchema],
    defaultAddressIndex: {
      type: Number,
      default: 0,
    },

    // Preferences & Settings
    preferences: {
      type: preferencesSchema,
      default: () => ({}),
    },

    // Service History & Favorites
    favoriteServices: [
      {
        type: Schema.Types.ObjectId,
        ref: "Service",
      },
    ],
    favoriteProviders: [
      {
        type: Schema.Types.ObjectId,
        ref: "ProviderProfile",
      },
    ],
    serviceHistory: [
      {
        type: Schema.Types.ObjectId,
        ref: "Booking",
      },
    ],

    // Payment Information
    savedPaymentMethods: [paymentMethodSchema],

    // Trust & Safety
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    verificationDetails: {
      type: verificationDetailsSchema,
      default: () => ({}),
    },

    // Emergency Contact
    emergencyContact: {
      type: emergencyContactSchema,
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
    collection: "client_profiles",
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
clientProfileSchema.index({ profile: 1 });
clientProfileSchema.index({ isDeleted: 1 });
clientProfileSchema.index({ isVerified: 1 });
clientProfileSchema.index({ favoriteServices: 1 });
clientProfileSchema.index({ favoriteProviders: 1 });
clientProfileSchema.index({ "savedAddresses.region": 1 });
clientProfileSchema.index({ "savedAddresses.city": 1 });
clientProfileSchema.index({ profile: 1, isDeleted: 1 });

/**
 * Pre-save middleware for validation
 */
clientProfileSchema.pre("save", async function () {
  // Ensure default address index is valid
  if (
    this.savedAddresses &&
    this.savedAddresses.length > 0 &&
    this.defaultAddressIndex !== undefined
  ) {
    if (
      this.defaultAddressIndex < 0 ||
      this.defaultAddressIndex >= this.savedAddresses.length
    ) {
      this.defaultAddressIndex = 0;
    }
  }

  // Ensure only one default payment method
  if (this.savedPaymentMethods && this.savedPaymentMethods.length > 0) {
    const defaultMethods = this.savedPaymentMethods.filter((m) => m.isDefault);
    if (defaultMethods.length > 1) {
      // Keep only the first default, set others to false
      let foundFirst = false;
      this.savedPaymentMethods = this.savedPaymentMethods.map((method) => {
        if (method.isDefault && !foundFirst) {
          foundFirst = true;
          return method;
        }
        return { ...method, isDefault: false };
      });
    }
  }

  // Update overall verification status
  if (this.verificationDetails) {
    this.isVerified =
      this.verificationDetails.phoneVerified &&
      this.verificationDetails.emailVerified &&
      this.verificationDetails.idVerified;

    // Set verifiedAt if fully verified and not already set
    if (this.isVerified && !this.verificationDetails.verifiedAt) {
      this.verificationDetails.verifiedAt = new Date();
    }
  }
});

/**
 * Instance Methods
 */
clientProfileSchema.methods.softDelete = function (
  this: HydratedDocument<ClientProfile, ClientProfileMethods>,
  deletedBy?: Types.ObjectId
) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  if (deletedBy) this.deletedBy = deletedBy;
  return this.save();
};

clientProfileSchema.methods.restore = function (
  this: HydratedDocument<ClientProfile, ClientProfileMethods>
) {
  this.isDeleted = false;
  this.deletedAt = undefined;
  this.deletedBy = undefined;
  return this.save();
};

clientProfileSchema.methods.addFavoriteService = function (
  this: HydratedDocument<ClientProfile, ClientProfileMethods>,
  serviceId: string
) {
  if (!this.favoriteServices) {
    this.favoriteServices = [];
  }
  // Avoid duplicates
  if (!this.favoriteServices.some((id) => id.toString() === serviceId)) {
    this.favoriteServices.push(serviceId as any);
  }
  return this.save();
};

clientProfileSchema.methods.removeFavoriteService = function (
  this: HydratedDocument<ClientProfile, ClientProfileMethods>,
  serviceId: string
) {
  if (this.favoriteServices) {
    this.favoriteServices = this.favoriteServices.filter(
      (id) => id.toString() !== serviceId
    );
  }
  return this.save();
};

clientProfileSchema.methods.addFavoriteProvider = function (
  this: HydratedDocument<ClientProfile, ClientProfileMethods>,
  providerId: string
) {
  if (!this.favoriteProviders) {
    this.favoriteProviders = [];
  }
  // Avoid duplicates
  if (!this.favoriteProviders.some((id) => id.toString() === providerId)) {
    this.favoriteProviders.push(providerId as any);
  }
  return this.save();
};

clientProfileSchema.methods.removeFavoriteProvider = function (
  this: HydratedDocument<ClientProfile, ClientProfileMethods>,
  providerId: string
) {
  if (this.favoriteProviders) {
    this.favoriteProviders = this.favoriteProviders.filter(
      (id) => id.toString() !== providerId
    );
  }
  return this.save();
};

clientProfileSchema.methods.setDefaultAddress = function (
  this: HydratedDocument<ClientProfile, ClientProfileMethods>,
  addressIndex: number
) {
  if (
    !this.savedAddresses ||
    addressIndex < 0 ||
    addressIndex >= this.savedAddresses.length
  ) {
    throw new Error("Invalid address index");
  }
  this.defaultAddressIndex = addressIndex;
  return this.save();
};

clientProfileSchema.methods.addSavedAddress = function (
  this: HydratedDocument<ClientProfile, ClientProfileMethods>,
  address: any
) {
  if (!this.savedAddresses) {
    this.savedAddresses = [];
  }
  this.savedAddresses.push(address);
  // Set as default if it's the first address
  if (this.savedAddresses.length === 1) {
    this.defaultAddressIndex = 0;
  }
  return this.save();
};

clientProfileSchema.methods.removeSavedAddress = function (
  this: HydratedDocument<ClientProfile, ClientProfileMethods>,
  addressIndex: number
) {
  if (
    !this.savedAddresses ||
    addressIndex < 0 ||
    addressIndex >= this.savedAddresses.length
  ) {
    throw new Error("Invalid address index");
  }
  this.savedAddresses.splice(addressIndex, 1);
  // Adjust default address index if necessary
  if (
    this.defaultAddressIndex !== undefined &&
    this.defaultAddressIndex >= this.savedAddresses.length
  ) {
    this.defaultAddressIndex = Math.max(0, this.savedAddresses.length - 1);
  }
  return this.save();
};

/**
 * Static Methods
 */
clientProfileSchema.statics.findActive = function () {
  return this.find({ isDeleted: { $ne: true } });
};

clientProfileSchema.statics.findByProfile = function (profileId: string) {
  return this.findOne({
    profile: profileId,
    isDeleted: { $ne: true },
  });
};

clientProfileSchema.statics.findByLocation = function (
  region: string,
  city?: string
) {
  const query: Record<string, any> = {
    isDeleted: { $ne: true },
    "savedAddresses.region": region,
  };
  if (city) query["savedAddresses.city"] = city;
  return this.find(query);
};

clientProfileSchema.statics.findByFavoriteService = function (
  serviceId: string
) {
  return this.find({
    favoriteServices: serviceId,
    isDeleted: { $ne: true },
  });
};

clientProfileSchema.statics.findVerified = function () {
  return this.find({
    isVerified: true,
    isDeleted: { $ne: true },
  });
};

/**
 * Virtual for checking if profile is active
 */
clientProfileSchema.virtual("isActive").get(function () {
  return !this.isDeleted;
});

/**
 * Virtual for getting default address
 */
clientProfileSchema.virtual("defaultAddress").get(function () {
  if (
    this.savedAddresses &&
    this.savedAddresses.length > 0 &&
    this.defaultAddressIndex !== undefined
  ) {
    return this.savedAddresses[this.defaultAddressIndex];
  }
  return null;
});

/**
 * Virtual for checking if client has verified address
 */
clientProfileSchema.virtual("hasVerifiedAddress").get(function () {
  return this.savedAddresses?.some((addr) => addr.isAddressVerified) || false;
});

/**
 * Virtual for getting default payment method
 */
clientProfileSchema.virtual("defaultPaymentMethod").get(function () {
  return this.savedPaymentMethods?.find((method) => method.isDefault) || null;
});

/**
 * Export the model
 */
export const ClientModel = model<ClientProfile, ClientProfileModel>(
  "ClientProfile",
  clientProfileSchema
);
