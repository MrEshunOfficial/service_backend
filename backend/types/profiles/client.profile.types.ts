// types/client-profile.types.ts
import { Types, Model, HydratedDocument } from "mongoose";
import {
  BaseEntity,
  ClientContactDetails,
  IdDetails,
  SoftDeletable,
  UserLocation,
} from "../base.types";

/**
 * Primary Client Profile Entity
 */
export interface ClientProfile extends BaseEntity, SoftDeletable {
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
  clientContactInfo: ClientContactDetails;
  savedAddresses?: UserLocation[];
  defaultAddressIndex?: number;

  /**
   * Preferences & Settings
   */
  preferences?: {
    preferredCategories?: Types.ObjectId[]; // Reference to Service Categories
    communicationPreferences?: {
      emailNotifications: boolean;
      smsNotifications: boolean;
      pushNotifications: boolean;
    };
    languagePreference?: string;
  };

  /**
   * Service History & Favorites
   */
  favoriteServices?: Types.ObjectId[]; // Reference to Services
  favoriteProviders?: Types.ObjectId[]; // Reference to ProviderProfiles
  serviceHistory?: Types.ObjectId[]; // Reference to Bookings/Orders

  /**
   * Payment Information
   */
  savedPaymentMethods?: {
    type: "mobile_money" | "card" | "bank_account";
    provider?: string; // e.g., "MTN", "Vodafone", "Visa"
    isDefault: boolean;
    label?: string; // e.g., "Personal MTN", "Work Card"
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
export interface ClientProfileMethods {
  softDelete(deletedBy?: Types.ObjectId): Promise<this>;
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
export interface ClientProfileModel
  extends Model<ClientProfile, {}, ClientProfileMethods> {
  findActive(): Promise<ClientProfileDocument[]>;
  findByProfile(profileId: string): Promise<ClientProfileDocument | null>;
  findByLocation(
    region: string,
    city?: string
  ): Promise<ClientProfileDocument[]>;
  findByFavoriteService(serviceId: string): Promise<ClientProfileDocument[]>;
  findVerified(): Promise<ClientProfileDocument[]>;
}

/**
 * Complete Client Profile Document Type
 */
export type ClientProfileDocument = HydratedDocument<
  ClientProfile,
  ClientProfileMethods
>;

/**
 * Request Body: Create Client Profile
 */
export interface CreateClientProfileRequestBody
  extends Omit<ClientProfile, "_id" | "createdAt" | "updatedAt"> {}

/**
 * Request Body: Update Client Profile
 */
export interface UpdateClientProfileRequestBody
  extends Partial<
    Omit<ClientProfile, "_id" | "createdAt" | "updatedAt" | "profile">
  > {}

/**
 * Standard API Response for Client Profile
 */
export interface ClientProfileResponse {
  message: string;
  clientProfile?: Partial<ClientProfile>;
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
  provider?: string; // e.g., "MTN", "Vodafone", "Visa"
  isDefault: boolean;
  label?: string; // e.g., "Personal MTN", "Work Card"
}

/**
 * Enhanced Response with Additional Data
 */
export interface ClientProfileDetailedResponse extends ClientProfileResponse {
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
