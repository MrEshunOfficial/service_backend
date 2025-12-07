// types/base.types.ts
import { Types } from "mongoose";

export interface BaseEntity {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface SoftDeletable {
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface UserLocation {
  // Core (User-provided)
  ghanaPostGPS: string; // e.g. "GA-123-4567"
  nearbyLandmark?: string; // e.g. "Opposite Accra Mall"

  // Auto-filled / Verified (from OpenStreetMap or googleMap)
  region?: string; // e.g. "Greater Accra"
  city?: string; // e.g. "Accra"
  district?: string; // e.g. "Ayawaso West"
  locality?: string; // e.g. "East Legon"
  streetName?: string; // optional: useful for clarity
  houseNumber?: string; // optional: required only for certain providers

  // Technical / Validation
  gpsCoordinates?: Coordinates; // auto-filled from lookup
  isAddressVerified?: boolean; // true when verified via API lookup
  sourceProvider?: "openstreetmap" | "google" | "ghanapost"; // helpful for debugging

  // System Fields
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SocialMediaHandle {
  nameOfSocial: string;
  userName: string;
  profileUrl?: string;
}

export interface ContactDetails {
  // Personal
  primaryContact: string; // main phone (required)
  secondaryContact?: string; // alternate phone

  // Business
  businessContact?: string; // for providers or organizations
  businessEmail?: string; // official company email
}

export enum idType {
  NATIONAL_ID = "national_id",
  PASSPORT = "passport",
  VOTERS_ID = "voters_id",
  DRIVERS_LICENSE = "drivers_license",
  NHIS = "nhis",
  OTHER = "other",
}

export interface IdDetails {
  idType: idType;
  idNumber: string;
  fileImage: Types.ObjectId[];
}

// Enums
export enum UserRole {
  CUSTOMER = "customer",
  PROVIDER = "service_provider",
}

export enum SystemRole {
  USER = "user",
  ADMIN = "admin",
  SUPER_ADMIN = "super_admin",
}

export enum AuthProvider {
  CREDENTIALS = "credentials",
  GOOGLE = "google",
  APPLE = "apple",
}

export enum ServiceStatus {
  PENDING_APPROVAL = "pending-approval",
  APPROVED = "approved",
  REJECTED = "rejected",
  SUSPENDED = "suspended",
}
