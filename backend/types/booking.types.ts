// types/booking.types.ts
import { Types, Model, HydratedDocument } from "mongoose";
import { BaseEntity, SoftDeletable, UserLocation, UserRole } from "./base.types";

/**
 * Booking Status
 */
export enum BookingStatus {
  PENDING = "pending", // Booking requested, awaiting provider confirmation
  CONFIRMED = "confirmed", // Provider confirmed
  IN_PROGRESS = "in_progress", // Service is being delivered
  COMPLETED = "completed", // Service completed
  CANCELLED = "cancelled", // Cancelled by either party
  REJECTED = "rejected", // Provider rejected the booking
}

/**
 * Payment Status
 */
export enum PaymentStatus {
  PENDING = "pending",
  PAID = "paid",
  REFUNDED = "refunded",
  FAILED = "failed",
}

/**
 * Main Booking Interface
 */
export interface Booking extends BaseEntity, SoftDeletable {
  // Unique identifier
  bookingNumber: string; // e.g., "BK-20250101-001"

  // Parties involved
  clientId: Types.ObjectId; // Reference to ClientProfile
  providerId: Types.ObjectId; // Reference to ProviderProfile
  serviceId?: Types.ObjectId; // Optional: which service was booked

  // Booking details
  serviceLocation: UserLocation; // Where service will be delivered
  scheduledDate: Date;
  scheduledTimeSlot?: {
    start: string; // e.g., "09:00"
    end: string; // e.g., "11:00"
  };

  // Description & requirements
  serviceDescription: string; // What the client needs
  specialInstructions?: string;

  // Pricing
  estimatedPrice?: number;
  finalPrice?: number;
  currency: string; // 'GHS' or 'USD'

  // Status tracking
  status: BookingStatus;
  paymentStatus: PaymentStatus;

  // Timestamps for workflow
  confirmedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  rejectedAt?: Date;

  // Cancellation/rejection
  cancellationReason?: string;
  cancelledBy?: UserRole.CUSTOMER | UserRole.PROVIDER
  rejectionReason?: string;

  // Provider response message
  providerMessage?: string; // Message when confirming/rejecting
}

/**
 * Instance Methods Interface
 */
export interface BookingMethods {
  softDelete(deletedBy?: Types.ObjectId): Promise<this>;
  restore(): Promise<this>;

  // Status transitions
  confirm(providerMessage?: string): Promise<this>;
  reject(reason: string): Promise<this>;
  startService(): Promise<this>;
  complete(finalPrice?: number): Promise<this>;
  cancel(reason: string, cancelledBy: UserRole.CUSTOMER | UserRole.PROVIDER): Promise<this>;
}

/**
 * Static Methods Interface
 */
export interface BookingModel extends Model<Booking, {}, BookingMethods> {
  findActive(): Promise<BookingDocument[]>;
  findByClient(clientId: string): Promise<BookingDocument[]>;
  findByProvider(providerId: string): Promise<BookingDocument[]>;
  findByStatus(status: BookingStatus): Promise<BookingDocument[]>;
  generateBookingNumber(): Promise<string>;
}

/**
 * Complete Booking Document Type
 */
export type BookingDocument = HydratedDocument<Booking, BookingMethods>;

/**
 * Request Body: Create Booking
 */
export interface CreateBookingRequestBody {
  providerId: string;
  serviceId?: string;
  serviceLocation: UserLocation;
  scheduledDate: Date;
  scheduledTimeSlot?: {
    start: string;
    end: string;
  };
  serviceDescription: string;
  specialInstructions?: string;
  estimatedPrice?: number;
  currency?: string;
}

/**
 * Request Body: Update Booking
 */
export interface UpdateBookingRequestBody {
  scheduledDate?: Date;
  scheduledTimeSlot?: {
    start: string;
    end: string;
  };
  serviceDescription?: string;
  specialInstructions?: string;
}

/**
 * Request Body: Provider Response
 */
export interface ProviderBookingResponseBody {
  bookingId: string;
  action: "confirm" | "reject";
  message?: string;
}

/**
 * Request Body: Cancel Booking
 */
export interface CancelBookingRequestBody {
  bookingId: string;
  reason: string;
}

/**
 * Standard Booking Response
 */
export interface BookingResponse {
  message: string;
  booking?: Partial<Booking>;
  error?: string;
}

/**
 * Booking List Response
 */
export interface BookingListResponse {
  message: string;
  bookings?: Partial<Booking>[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  error?: string;
}
