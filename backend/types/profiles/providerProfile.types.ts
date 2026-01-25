// types/provider-profile.types.ts
import { Types, Model } from "mongoose";
import {
  BaseEntity,
  ContactDetails,
  IdDetails,
  SoftDeletable,
  UserLocation,
} from "../base.types";

export enum PopulationLevel {
  NONE = "none",
  MINIMAL = "minimal",
  STANDARD = "standard",
  DETAILED = "detailed",
}

/**
 * Primary Provider Profile Entity
 */
export interface ProviderProfile extends BaseEntity, SoftDeletable {
  // Linking User Profile
  profile: Types.ObjectId;

  /**
   * Business & Identity Information
   */
  businessName?: string;
  IdDetails?: IdDetails;
  isCompanyTrained: boolean;

  /**
   * Service Details
   */
  serviceOfferings?: Types.ObjectId[];
  BusinessGalleryImages?: Types.ObjectId[];

  /**
   * Contact & Location
   */
  providerContactInfo: ContactDetails;
  locationData: UserLocation;

  /**
   * Availability & Scheduling
   */
  isAlwaysAvailable: boolean;
  // Shown only if not always available
  workingHours?: Record<
    string,
    {
      start: string;
      end: string;
    }
  >;

  /**
   * Payments & Deposits
   */
  requireInitialDeposit: boolean;
  percentageDeposit?: number;
}

/**
 * Instance Methods Interface
 */
export interface ProviderProfileMethods {
  softDelete(deletedBy?: string): Promise<this>;
  restore(): Promise<this>;
}

/**
 * Static Methods Interface
 */
export interface ProviderProfileModel
  extends Model<ProviderProfile, {}, ProviderProfileMethods> {
  findActive(): Promise<ProviderProfile[]>;
  findByLocation(region: string, city?: string): Promise<ProviderProfile[]>;
  findByProfile(profileId: string): Promise<ProviderProfile | null>;
  findByService(serviceId: string): Promise<ProviderProfile[]>;
}

/**
 * Request Body: Create Provider Profile
 */
export interface CreateProviderProfileRequestBody
  extends Omit<ProviderProfile, "_id" | "createdAt" | "updatedAt"> {}

/**
 * Request Body: Update Provider Profile
 */
export interface UpdateProviderProfileRequestBody
  extends Partial<
    Omit<ProviderProfile, "_id" | "createdAt" | "updatedAt" | "profile">
  > {}

/**
 * Standard API Response for Provider Profile
 */
export interface ProviderProfileResponse {
  message: string;
  providerProfile?: Partial<ProviderProfile>;
  error?: string;
}

