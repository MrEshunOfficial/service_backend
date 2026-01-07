// models/booking.model.ts - REFACTORED (Execution Phase Only)

import { Schema, model, HydratedDocument, Types } from "mongoose";
import {
  Booking,
  BookingModel as IBookingModel,
  BookingMethods,
  BookingStatus,
  PaymentStatus,
} from "../types/booking.types";
import { UserRole } from "../types/base.types";
import { userLocationSchema } from "./shared-schemas/location.schema";
import { timeSlotSchema } from "./shared-schemas/timeSlotSchema";

/**
 * Status History Entry Sub-Schema
 * Tracks all status changes with full audit trail
 */
const statusHistorySchema = new Schema(
  {
    status: {
      type: String,
      enum: Object.values(BookingStatus),
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    actorRole: {
      type: String,
      enum: [UserRole.CUSTOMER, UserRole.PROVIDER, "SYSTEM"],
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    message: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { _id: false }
);

/**
 * REFACTORED Booking Schema - EXECUTION PHASE ONLY
 * Bookings are created when a Task is accepted by a provider
 */
const bookingSchema = new Schema<Booking, IBookingModel, BookingMethods>(
  {
    bookingNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // ✅ Link to originating task
    taskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },

    // Parties (Keep references only - don't duplicate data)
    clientId: {
      type: Schema.Types.ObjectId,
      ref: "ClientProfile",
      required: true,
      index: true,
    },
    providerId: {
      type: Schema.Types.ObjectId,
      ref: "ProviderProfile",
      required: true,
      index: true,
    },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      index: true,
    },

    // Service Location - Snapshot at time of booking
    // Justified duplication: location may change in profiles later
    serviceLocation: {
      type: userLocationSchema,
      required: true,
    },

    // Scheduling
    scheduledDate: {
      type: Date,
      required: true,
      index: true,
    },
    scheduledTimeSlot: {
      type: timeSlotSchema,
      required: true,
    },

    // Service Details
    serviceDescription: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    specialInstructions: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    // Pricing
    estimatedPrice: {
      type: Number,
      min: 0,
    },
    finalPrice: {
      type: Number,
      min: 0,
    },
    depositAmount: {
      type: Number,
      min: 0,
    },
    depositPaid: {
      type: Boolean,
      default: false,
    },
    currency: {
      type: String,
      required: true,
      default: "GHS",
    },

    // Current Status (for quick queries) - EXECUTION PHASE ONLY
    status: {
      type: String,
      enum: [
        BookingStatus.CONFIRMED, // Created from accepted task
        BookingStatus.IN_PROGRESS, // Service started
        BookingStatus.COMPLETED, // Service finished
        BookingStatus.CANCELLED, // Cancelled after booking
        // ❌ REMOVED: PENDING (tasks handle this)
        // ❌ REMOVED: REJECTED (tasks handle this)
      ],
      default: BookingStatus.CONFIRMED,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
      index: true,
    },

    // ✅ Status History (replaces individual timestamp fields)
    statusHistory: [statusHistorySchema],

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    collection: "bookings",
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
 * Compound Indexes (More efficient than individual indexes)
 */
bookingSchema.index({ clientId: 1, status: 1, isDeleted: 1 });
bookingSchema.index({ providerId: 1, status: 1, isDeleted: 1 });
bookingSchema.index({ scheduledDate: 1, status: 1, isDeleted: 1 });
bookingSchema.index({ serviceId: 1, status: 1 });
bookingSchema.index({ taskId: 1 });
bookingSchema.index({ bookingNumber: 1 });

/**
 * Helper: Add status history entry
 */
function addStatusEntry(
  booking: any,
  status: BookingStatus,
  actor?: Types.ObjectId,
  actorRole?: string,
  reason?: string,
  message?: string
) {
  if (!booking.statusHistory) {
    booking.statusHistory = [];
  }

  booking.statusHistory.push({
    status,
    timestamp: new Date(),
    actor,
    actorRole,
    reason,
    message,
  });
}

/**
 * Pre-save middleware
 */
bookingSchema.pre("save", function () {
  // Validate time slot
  if (this.scheduledTimeSlot) {
    const { start, end } = this.scheduledTimeSlot;
    if (start >= end) {
      throw new Error("Start time must be before end time");
    }
  }

  // Validate pricing
  if (this.estimatedPrice && this.finalPrice) {
    if (this.finalPrice < 0) {
      throw new Error("Final price cannot be negative");
    }
  }

  // Validate deposit
  if (this.depositAmount) {
    if (this.depositAmount > (this.estimatedPrice || 0)) {
      throw new Error("Deposit cannot exceed estimated price");
    }
  }
});

/**
 * Instance Methods
 */
bookingSchema.methods.softDelete = function (
  this: HydratedDocument<Booking, BookingMethods>,
  deletedBy?: Types.ObjectId
) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  if (deletedBy) this.deletedBy = deletedBy;
  return this.save();
};

bookingSchema.methods.restore = function (
  this: HydratedDocument<Booking, BookingMethods>
) {
  this.isDeleted = false;
  this.deletedAt = undefined;
  this.deletedBy = undefined;
  return this.save();
};

/**
 * ✅ SIMPLIFIED: Confirm is no longer needed
 * Bookings are created in CONFIRMED state from accepted tasks
 */

/**
 * ❌ REMOVED: reject() method
 * Rejection happens at Task level, not Booking level
 */

/**
 * Start Service
 */
bookingSchema.methods.startService = function (
  this: HydratedDocument<Booking, BookingMethods>,
  providerId?: Types.ObjectId
) {
  if (this.status !== BookingStatus.CONFIRMED) {
    throw new Error("Only confirmed bookings can be started");
  }

  this.status = BookingStatus.IN_PROGRESS;
  addStatusEntry(
    this,
    BookingStatus.IN_PROGRESS,
    providerId,
    UserRole.PROVIDER
  );

  return this.save();
};

/**
 * Complete Service
 */
bookingSchema.methods.complete = function (
  this: HydratedDocument<Booking, BookingMethods>,
  finalPrice?: number,
  providerId?: Types.ObjectId
) {
  if (this.status !== BookingStatus.IN_PROGRESS) {
    throw new Error("Only in-progress bookings can be completed");
  }

  this.status = BookingStatus.COMPLETED;
  if (finalPrice !== undefined) {
    this.finalPrice = finalPrice;
  }

  addStatusEntry(this, BookingStatus.COMPLETED, providerId, UserRole.PROVIDER);

  return this.save();
};

/**
 * Cancel Booking
 * Can only be cancelled after it's been created (execution phase)
 */
bookingSchema.methods.cancel = function (
  this: HydratedDocument<Booking, BookingMethods>,
  reason: string,
  cancelledBy: string,
  actorId?: Types.ObjectId
) {
  if (this.status === BookingStatus.COMPLETED) {
    throw new Error("Cannot cancel completed bookings");
  }

  if (this.status === BookingStatus.CANCELLED) {
    throw new Error("Booking is already cancelled");
  }

  this.status = BookingStatus.CANCELLED;
  addStatusEntry(this, BookingStatus.CANCELLED, actorId, cancelledBy, reason);

  return this.save();
};

/**
 * Update Payment Status
 */
bookingSchema.methods.updatePaymentStatus = function (
  this: HydratedDocument<Booking, BookingMethods>,
  paymentStatus: PaymentStatus,
  actorId?: Types.ObjectId
) {
  this.paymentStatus = paymentStatus;

  // If deposit is paid, mark it
  if (paymentStatus === PaymentStatus.DEPOSIT_PAID) {
    this.depositPaid = true;
  }

  return this.save();
};

/**
 * Reschedule Booking
 */
bookingSchema.methods.reschedule = function (
  this: HydratedDocument<Booking, BookingMethods>,
  newDate: Date,
  newTimeSlot?: { start: string; end: string },
  actorId?: Types.ObjectId,
  actorRole?: string
) {
  if (this.status !== BookingStatus.CONFIRMED) {
    throw new Error("Only confirmed bookings can be rescheduled");
  }

  const oldDate = this.scheduledDate;
  const oldTimeSlot = this.scheduledTimeSlot;

  this.scheduledDate = newDate;
  if (newTimeSlot) {
    this.scheduledTimeSlot = newTimeSlot;
  }

  addStatusEntry(
    this,
    BookingStatus.CONFIRMED,
    actorId,
    actorRole,
    undefined,
    `Rescheduled from ${oldDate.toISOString()} to ${newDate.toISOString()}`
  );

  return this.save();
};

/**
 * Static Methods
 */
bookingSchema.statics.findActive = function () {
  return this.find({
    isDeleted: { $ne: true },
    status: { $ne: BookingStatus.CANCELLED },
  })
    .populate("taskId")
    .populate("clientId")
    .populate("providerId")
    .populate("serviceId")
    .sort({ scheduledDate: 1 });
};

bookingSchema.statics.findByClient = function (clientId: string) {
  return this.find({
    clientId,
    isDeleted: { $ne: true },
  })
    .populate("taskId")
    .populate("providerId", "businessName locationData")
    .populate("serviceId", "title")
    .sort({ createdAt: -1 });
};

bookingSchema.statics.findByProvider = function (providerId: string) {
  return this.find({
    providerId,
    isDeleted: { $ne: true },
  })
    .populate("taskId")
    .populate("clientId")
    .populate("serviceId", "title")
    .sort({ scheduledDate: 1 });
};

bookingSchema.statics.findByStatus = function (status: BookingStatus) {
  return this.find({
    status,
    isDeleted: { $ne: true },
  })
    .populate("taskId")
    .populate("clientId")
    .populate("providerId", "businessName")
    .sort({ scheduledDate: 1 });
};

bookingSchema.statics.findByTask = function (taskId: string) {
  return this.findOne({
    taskId,
    isDeleted: { $ne: true },
  })
    .populate("clientId")
    .populate("providerId", "businessName locationData")
    .populate("serviceId");
};

bookingSchema.statics.findUpcoming = function (providerId?: string) {
  const query: any = {
    isDeleted: { $ne: true },
    status: { $in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] },
    scheduledDate: { $gte: new Date() },
  };

  if (providerId) {
    query.providerId = providerId;
  }

  return this.find(query)
    .populate("clientId")
    .populate("providerId", "businessName")
    .populate("serviceId", "title")
    .sort({ scheduledDate: 1 });
};

bookingSchema.statics.findByDateRange = function (
  startDate: Date,
  endDate: Date,
  providerId?: string
) {
  const query: any = {
    isDeleted: { $ne: true },
    scheduledDate: { $gte: startDate, $lte: endDate },
  };

  if (providerId) {
    query.providerId = providerId;
  }

  return this.find(query)
    .populate("clientId")
    .populate("providerId", "businessName")
    .populate("serviceId", "title")
    .sort({ scheduledDate: 1 });
};

bookingSchema.statics.generateBookingNumber = async function () {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const datePrefix = `BK-${year}${month}${day}`;

  const lastBooking = await this.findOne({
    bookingNumber: new RegExp(`^${datePrefix}`),
  })
    .sort({ bookingNumber: -1 })
    .limit(1);

  let sequence = 1;
  if (lastBooking) {
    const lastSequence = parseInt(lastBooking.bookingNumber.split("-")[2]);
    sequence = lastSequence + 1;
  }

  return `${datePrefix}-${String(sequence).padStart(4, "0")}`;
};

/**
 * Virtuals - Enhanced with status history lookups
 */
bookingSchema.virtual("isActive").get(function () {
  return !this.isDeleted && this.status !== BookingStatus.CANCELLED;
});

bookingSchema.virtual("isConfirmed").get(function () {
  return this.status === BookingStatus.CONFIRMED;
});

bookingSchema.virtual("isInProgress").get(function () {
  return this.status === BookingStatus.IN_PROGRESS;
});

bookingSchema.virtual("isCompleted").get(function () {
  return this.status === BookingStatus.COMPLETED;
});

bookingSchema.virtual("isCancelled").get(function () {
  return this.status === BookingStatus.CANCELLED;
});

bookingSchema.virtual("isUpcoming").get(function () {
  return (
    this.scheduledDate > new Date() &&
    (this.status === BookingStatus.CONFIRMED ||
      this.status === BookingStatus.IN_PROGRESS)
  );
});

bookingSchema.virtual("isPastDue").get(function () {
  return (
    this.scheduledDate < new Date() && this.status === BookingStatus.CONFIRMED
  );
});

// ✅ Convenience virtuals for timestamp lookups from status history
bookingSchema.virtual("confirmedAt").get(function () {
  const entry = this.statusHistory?.find(
    (h) => h.status === BookingStatus.CONFIRMED
  );
  return entry?.timestamp;
});

bookingSchema.virtual("startedAt").get(function () {
  const entry = this.statusHistory?.find(
    (h) => h.status === BookingStatus.IN_PROGRESS
  );
  return entry?.timestamp;
});

bookingSchema.virtual("completedAt").get(function () {
  const entry = this.statusHistory?.find(
    (h) => h.status === BookingStatus.COMPLETED
  );
  return entry?.timestamp;
});

bookingSchema.virtual("cancelledAt").get(function () {
  const entry = this.statusHistory?.find(
    (h) => h.status === BookingStatus.CANCELLED
  );
  return entry?.timestamp;
});

bookingSchema.virtual("cancellationReason").get(function () {
  const entry = this.statusHistory?.find(
    (h) => h.status === BookingStatus.CANCELLED
  );
  return entry?.reason;
});

bookingSchema.virtual("cancelledBy").get(function () {
  const entry = this.statusHistory?.find(
    (h) => h.status === BookingStatus.CANCELLED
  );
  return entry?.actorRole;
});

bookingSchema.virtual("providerMessage").get(function () {
  const entry = this.statusHistory?.find(
    (h) => h.status === BookingStatus.CONFIRMED
  );
  return entry?.message;
});

bookingSchema.virtual("durationInDays").get(function () {
  if (!this.completedAt || !this.confirmedAt) return null;
  const diff = this.completedAt.getTime() - this.confirmedAt.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

bookingSchema.virtual("requiresDeposit").get(function () {
  return this.depositAmount && this.depositAmount > 0;
});

bookingSchema.virtual("depositRemaining").get(function () {
  if (!this.depositAmount) return 0;
  return this.depositPaid ? 0 : this.depositAmount;
});

bookingSchema.virtual("balanceRemaining").get(function () {
  if (!this.finalPrice) return this.estimatedPrice || 0;
  const paid = this.depositPaid ? this.depositAmount || 0 : 0;
  return this.finalPrice - paid;
});

/**
 * Export the model
 */
export const BookingModel = model<Booking, IBookingModel>(
  "Booking",
  bookingSchema
);
