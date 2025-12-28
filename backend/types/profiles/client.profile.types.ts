// types/customer-profile.types.ts
import { Types, Model } from "mongoose";
import {
  BaseEntity,
  ClientContactDetails,
  IdDetails,
  SoftDeletable,
  UserLocation,
} from "../base.types";

/**
 * Primary Customer Profile Entity
 */
export interface CustomerProfile extends BaseEntity, SoftDeletable {
  // Linking User Profile
  profile: Types.ObjectId;

  /**
   * Personal Information
   */
  preferredName?: string;
  dateOfBirth?: Date;
  idDetails?: IdDetails;

  /**
   * Contact & Location
   */
  customerContactInfo: ClientContactDetails;
  savedAddresses?: UserLocation[];
  defaultAddressIndex?: number; // Index of the default address in savedAddresses

  /**
   * Preferences & Settings
   */
  preferences?: {
    preferredCategories?: Types.ObjectId[]; // Service categories they're interested in
    communicationPreferences?: {
      emailNotifications: boolean;
      smsNotifications: boolean;
      pushNotifications: boolean;
    };
    languagePreference?: string; // e.g., "en", "tw" (Twi), etc.
  };

  /**
   * Service History & Favorites
   */
  favoriteServices?: Types.ObjectId[]; // Services they've bookmarked
  favoriteProviders?: Types.ObjectId[]; // Providers they've bookmarked
  serviceHistory?: Types.ObjectId[]; // References to past bookings/orders

  /**
   * Payment Information
   */
  savedPaymentMethods?: {
    type: "mobile_money" | "card" | "bank_account";
    provider?: string; // e.g., "MTN", "Vodafone", "AirtelTigo"
    lastFourDigits?: string;
    isDefault: boolean;
    label?: string; // e.g., "Personal", "Business"
  }[];

  /**
   * Trust & Safety
   */
  isVerified: boolean;
  verificationDetails?: {
    phoneVerified: boolean;
    emailVerified: boolean;
    idVerified: boolean;
    verifiedAt?: Date;
  };

  /**
   * Emergency Contact (Optional)
   */
  emergencyContact?: {
    name: string;
    relationship: string;
    phoneNumber: string;
  };
}

/**
 * Instance Methods Interface
 */
export interface CustomerProfileMethods {
  softDelete(deletedBy?: string): Promise<this>;
  restore(): Promise<this>;
  addFavoriteService(serviceId: string): Promise<this>;
  removeFavoriteService(serviceId: string): Promise<this>;
  addFavoriteProvider(providerId: string): Promise<this>;
  removeFavoriteProvider(providerId: string): Promise<this>;
  setDefaultAddress(addressIndex: number): Promise<this>;
  addSavedAddress(address: UserLocation): Promise<this>;
  removeSavedAddress(addressIndex: number): Promise<this>;
}

/**
 * Static Methods Interface
 */
export interface CustomerProfileModel
  extends Model<CustomerProfile, {}, CustomerProfileMethods> {
  findActive(): Promise<CustomerProfile[]>;
  findByProfile(profileId: string): Promise<CustomerProfile | null>;
  findByLocation(region: string, city?: string): Promise<CustomerProfile[]>;
  findByFavoriteService(serviceId: string): Promise<CustomerProfile[]>;
  findVerified(): Promise<CustomerProfile[]>;
}

/**
 * Request Body: Create Customer Profile
 */
export interface CreateCustomerProfileRequestBody
  extends Omit<CustomerProfile, "_id" | "createdAt" | "updatedAt"> {}

/**
 * Request Body: Update Customer Profile
 */
export interface UpdateCustomerProfileRequestBody
  extends Partial<
    Omit<CustomerProfile, "_id" | "createdAt" | "updatedAt" | "profile">
  > {}

/**
 * Standard API Response for Customer Profile
 */
export interface CustomerProfileResponse {
  message: string;
  customerProfile?: Partial<CustomerProfile>;
  error?: string;
}

/**
 * Request Body: Add/Remove Favorites
 */
export interface ManageFavoritesRequestBody {
  serviceId?: string;
  providerId?: string;
  action: "add" | "remove";
}

/**
 * Request Body: Manage Saved Addresses
 */
export interface ManageAddressRequestBody {
  address?: UserLocation;
  addressIndex?: number;
  action: "add" | "remove" | "set_default";
}

/**
 * Request Body: Update Communication Preferences
 */
export interface UpdateCommunicationPreferencesRequestBody {
  emailNotifications?: boolean;
  smsNotifications?: boolean;
  pushNotifications?: boolean;
}

/**
 * Request Body: Add Payment Method
 */
export interface AddPaymentMethodRequestBody {
  type: "mobile_money" | "card" | "bank_account";
  provider?: string;
  lastFourDigits?: string;
  isDefault: boolean;
  label?: string;
}

/**
 * Enhanced Response with Additional Data
 */
export interface CustomerProfileDetailedResponse
  extends CustomerProfileResponse {
  favoriteServicesCount?: number;
  favoriteProvidersCount?: number;
  totalBookings?: number;
  verificationStatus?: {
    phoneVerified: boolean;
    emailVerified: boolean;
    idVerified: boolean;
    overallVerified: boolean;
  };
}
