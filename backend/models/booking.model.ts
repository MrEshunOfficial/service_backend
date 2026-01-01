// models/booking.model.ts
import { Schema, model, HydratedDocument, Types } from "mongoose";
import {
  Booking,
  BookingModel as IBookingModel,
  BookingMethods,
  BookingStatus,
  PaymentStatus,
} from "../types/booking.types";
import { UserRole } from "../types/base.types";

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
  { _id: false }
);

/**
 * Time Slot Sub-Schema
 */
const timeSlotSchema = new Schema(
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
 * Booking Schema
 */
const bookingSchema = new Schema<Booking, IBookingModel, BookingMethods>(
  {
    bookingNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Parties
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
    },

    // Service details
    serviceLocation: {
      type: userLocationSchema,
      required: true,
    },
    scheduledDate: {
      type: Date,
      required: true,
      index: true,
    },
    scheduledTimeSlot: {
      type: timeSlotSchema,
    },

    // Description
    serviceDescription: {
      type: String,
      required: true,
      trim: true,
    },
    specialInstructions: {
      type: String,
      trim: true,
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
    currency: {
      type: String,
      required: true,
      default: "GHS",
    },

    // Status
    status: {
      type: String,
      enum: Object.values(BookingStatus),
      default: BookingStatus.PENDING,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
      index: true,
    },

    // Workflow timestamps
    confirmedAt: {
      type: Date,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },

    // Cancellation/rejection
    cancellationReason: {
      type: String,
      trim: true,
    },
    cancelledBy: {
      type: String,
      enum: [UserRole.CUSTOMER, UserRole.PROVIDER],
    },
    rejectionReason: {
      type: String,
      trim: true,
    },

    // Provider message
    providerMessage: {
      type: String,
      trim: true,
    },

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
 * Indexes
 */
bookingSchema.index({ clientId: 1, status: 1 });
bookingSchema.index({ providerId: 1, status: 1 });
bookingSchema.index({ bookingNumber: 1 });
bookingSchema.index({ scheduledDate: 1, status: 1 });
bookingSchema.index({ isDeleted: 1 });

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

bookingSchema.methods.confirm = function (
  this: HydratedDocument<Booking, BookingMethods>,
  providerMessage?: string
) {
  if (this.status !== BookingStatus.PENDING) {
    throw new Error("Only pending bookings can be confirmed");
  }
  this.status = BookingStatus.CONFIRMED;
  this.confirmedAt = new Date();
  if (providerMessage) this.providerMessage = providerMessage;
  return this.save();
};

bookingSchema.methods.reject = function (
  this: HydratedDocument<Booking, BookingMethods>,
  reason: string
) {
  if (this.status !== BookingStatus.PENDING) {
    throw new Error("Only pending bookings can be rejected");
  }
  this.status = BookingStatus.REJECTED;
  this.rejectedAt = new Date();
  this.rejectionReason = reason;
  return this.save();
};

bookingSchema.methods.startService = function (
  this: HydratedDocument<Booking, BookingMethods>
) {
  if (this.status !== BookingStatus.CONFIRMED) {
    throw new Error("Only confirmed bookings can be started");
  }
  this.status = BookingStatus.IN_PROGRESS;
  this.startedAt = new Date();
  return this.save();
};

bookingSchema.methods.complete = function (
  this: HydratedDocument<Booking, BookingMethods>,
  finalPrice?: number
) {
  if (this.status !== BookingStatus.IN_PROGRESS) {
    throw new Error("Only in-progress bookings can be completed");
  }
  this.status = BookingStatus.COMPLETED;
  this.completedAt = new Date();
  if (finalPrice !== undefined) this.finalPrice = finalPrice;
  return this.save();
};

bookingSchema.methods.cancel = function (
  this: HydratedDocument<Booking, BookingMethods>,
  reason: string,
  cancelledBy: UserRole.CUSTOMER | UserRole.PROVIDER
) {
  if (
    this.status === BookingStatus.COMPLETED ||
    this.status === BookingStatus.CANCELLED
  ) {
    throw new Error("Cannot cancel completed or already cancelled bookings");
  }
  this.status = BookingStatus.CANCELLED;
  this.cancelledAt = new Date();
  this.cancellationReason = reason;
  this.cancelledBy = cancelledBy;
  return this.save();
};

/**
 * Static Methods
 */
bookingSchema.statics.findActive = function () {
  return this.find({ isDeleted: { $ne: true } });
};

bookingSchema.statics.findByClient = function (clientId: string) {
  return this.find({
    clientId,
    isDeleted: { $ne: true },
  }).sort({ createdAt: -1 });
};

bookingSchema.statics.findByProvider = function (providerId: string) {
  return this.find({
    providerId,
    isDeleted: { $ne: true },
  }).sort({ createdAt: -1 });
};

bookingSchema.statics.findByStatus = function (status: BookingStatus) {
  return this.find({
    status,
    isDeleted: { $ne: true },
  }).sort({ scheduledDate: 1 });
};

bookingSchema.statics.generateBookingNumber = async function () {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const datePrefix = `BK-${year}${month}${day}`;

  // Find the last booking for today
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
 * Virtuals
 */
bookingSchema.virtual("isActive").get(function () {
  return !this.isDeleted;
});

bookingSchema.virtual("isPending").get(function () {
  return this.status === BookingStatus.PENDING;
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

/**
 * Export the model
 */
export const BookingModel = model<Booking, IBookingModel>(
  "Booking",
  bookingSchema
);
