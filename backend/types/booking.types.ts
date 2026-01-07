// types/booking.types.ts - FIXED

import { Types, Model, HydratedDocument } from "mongoose";

/**
 * Booking Status - EXECUTION PHASE ONLY
 */
export enum BookingStatus {
  CONFIRMED = "CONFIRMED", // Created from accepted task
  IN_PROGRESS = "IN_PROGRESS", // Service started
  COMPLETED = "COMPLETED", // Service finished
  CANCELLED = "CANCELLED", // Cancelled after booking
}

/**
 * Payment Status
 */
export enum PaymentStatus {
  PENDING = "PENDING",
  DEPOSIT_PAID = "DEPOSIT_PAID",
  PARTIALLY_PAID = "PARTIALLY_PAID",
  PAID = "PAID",
  REFUNDED = "REFUNDED",
  FAILED = "FAILED",
}

/**
 * Status History Entry
 */
export interface StatusHistoryEntry {
  status: BookingStatus;
  timestamp: Date;
  actor?: Types.ObjectId;
  actorRole?: string;
  reason?: string;
  message?: string;
}

/**
 * Booking Interface - with virtual properties
 */
export interface Booking {
  _id?: Types.ObjectId;
  bookingNumber: string;
  taskId: Types.ObjectId;
  clientId: Types.ObjectId;
  providerId: Types.ObjectId;
  serviceId: Types.ObjectId;
  serviceLocation: any; // UserLocation type
  scheduledDate: Date;
  scheduledTimeSlot: {
    start: string;
    end: string;
  };
  serviceDescription: string;
  specialInstructions?: string;
  estimatedPrice?: number;
  finalPrice?: number;
  depositAmount?: number;
  depositPaid?: boolean;
  currency: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  statusHistory?: StatusHistoryEntry[];
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;

  // ✅ Virtual properties (read-only)
  readonly isActive?: boolean;
  readonly isConfirmed?: boolean;
  readonly isInProgress?: boolean;
  readonly isCompleted?: boolean;
  readonly isCancelled?: boolean;
  readonly isUpcoming?: boolean;
  readonly isPastDue?: boolean;
  readonly confirmedAt?: Date;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly cancelledAt?: Date;
  readonly cancellationReason?: string;
  readonly cancelledBy?: string;
  readonly providerMessage?: string;
  readonly durationInDays?: number | null;
  readonly requiresDeposit?: boolean;
  readonly depositRemaining?: number;
  readonly balanceRemaining?: number;
}

/**
 * Booking Instance Methods
 */
export interface BookingMethods {
  softDelete(
    deletedBy?: Types.ObjectId
  ): Promise<HydratedDocument<Booking, BookingMethods>>;
  restore(): Promise<HydratedDocument<Booking, BookingMethods>>;
  startService(
    providerId?: Types.ObjectId
  ): Promise<HydratedDocument<Booking, BookingMethods>>;
  complete(
    finalPrice?: number,
    providerId?: Types.ObjectId
  ): Promise<HydratedDocument<Booking, BookingMethods>>;
  cancel(
    reason: string,
    cancelledBy: string,
    actorId?: Types.ObjectId
  ): Promise<HydratedDocument<Booking, BookingMethods>>;
  updatePaymentStatus(
    paymentStatus: PaymentStatus,
    actorId?: Types.ObjectId
  ): Promise<HydratedDocument<Booking, BookingMethods>>;
  reschedule(
    newDate: Date,
    newTimeSlot?: { start: string; end: string },
    actorId?: Types.ObjectId,
    actorRole?: string
  ): Promise<HydratedDocument<Booking, BookingMethods>>;
}

/**
 * Booking Static Methods
 */
export interface BookingModel extends Model<Booking, {}, BookingMethods> {
  findActive(): any;
  findByClient(clientId: string): any;
  findByProvider(providerId: string): any;
  findByStatus(status: BookingStatus): any;
  findByTask(taskId: string): any;
  findUpcoming(providerId?: string): any;
  findByDateRange(startDate: Date, endDate: Date, providerId?: string): any;
  generateBookingNumber(): Promise<string>;
}
