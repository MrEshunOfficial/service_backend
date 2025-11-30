// models/service.model.ts
import { Schema, model, Model, HydratedDocument } from "mongoose";
import {
  Service,
  ServiceMethods,
  ServiceModel as IServiceModel,
} from "../types/service.types";

// Service pricing subdocument schema
const servicePricingSchema = new Schema(
  {
    serviceBasePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    includeTravelFee: {
      type: Boolean,
      default: false,
    },
    includeAdditionalFees: {
      type: Boolean,
      default: false,
    },
    currency: {
      type: String,
      required: true,
      default: "GHS",
    },
    platformCommissionRate: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
      default: 0.2,
    },
    providerEarnings: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

// Main service schema
const serviceSchema = new Schema<Service, IServiceModel, ServiceMethods>(
  {
    // Core service details
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (tags: string[]) => tags.length <= 20,
        message: "Maximum 20 tags allowed",
      },
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    coverImage: {
      type: Schema.Types.ObjectId,
      ref: "File",
      default: null,
    },

    // Provider-specific fields
    providerId: {
      type: Schema.Types.ObjectId,
      ref: "Provider",
      index: true,
    },

    // Pricing and availability
    servicePricing: {
      type: servicePricingSchema,
      required: function (this: Service) {
        return !!this.providerId;
      },
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },

    // Moderation fields
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Soft delete
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
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

// Indexes for performance
serviceSchema.index({ title: "text", description: "text", tags: "text" });
serviceSchema.index({ categoryId: 1, isActive: 1, deletedAt: 1 });
serviceSchema.index({ providerId: 1, isActive: 1, deletedAt: 1 });
serviceSchema.index({ slug: 1, deletedAt: 1 });

// Pre-save middleware to calculate provider earnings
serviceSchema.pre("save", function (next) {
  if (this.servicePricing && this.servicePricing.serviceBasePrice) {
    const commissionAmount =
      this.servicePricing.serviceBasePrice *
      this.servicePricing.platformCommissionRate;
    this.servicePricing.providerEarnings =
      this.servicePricing.serviceBasePrice - commissionAmount;
  }
  // next();
});

// Instance methods
serviceSchema.methods.softDelete = function (
  this: HydratedDocument<Service, ServiceMethods>
) {
  this.deletedAt = new Date();
  return this.save();
};

serviceSchema.methods.restore = function (
  this: HydratedDocument<Service, ServiceMethods>
) {
  this.deletedAt = undefined;
  return this.save();
};

serviceSchema.methods.approve = function (
  this: HydratedDocument<Service, ServiceMethods>,
  approverId: string
) {
  this.approvedBy = approverId as any;
  this.approvedAt = new Date();
  this.isActive = true;
  this.rejectedAt = undefined;
  this.rejectionReason = undefined;
  return this.save();
};

serviceSchema.methods.reject = function (
  this: HydratedDocument<Service, ServiceMethods>,
  approverId: string,
  reason: string
) {
  this.approvedBy = approverId as any;
  this.rejectedAt = new Date();
  this.rejectionReason = reason;
  this.isActive = false;
  this.approvedAt = undefined;
  return this.save();
};

// Static methods
serviceSchema.statics.findActive = function () {
  return this.find({ isActive: true, deletedAt: null });
};

serviceSchema.statics.findByCategory = function (categoryId: string) {
  return this.find({
    categoryId,
    isActive: true,
    deletedAt: null,
  });
};

serviceSchema.statics.findByProvider = function (providerId: string) {
  return this.find({
    providerId,
    deletedAt: null,
  });
};

serviceSchema.statics.searchServices = function (
  searchTerm: string,
  filters?: {
    categoryId?: string;
    providerId?: string;
    minPrice?: number;
    maxPrice?: number;
  }
) {
  const query: any = {
    $text: { $search: searchTerm },
    isActive: true,
    deletedAt: null,
  };

  if (filters?.categoryId) {
    query.categoryId = filters.categoryId;
  }

  if (filters?.providerId) {
    query.providerId = filters.providerId;
  }

  if (filters?.minPrice || filters?.maxPrice) {
    query["servicePricing.serviceBasePrice"] = {};
    if (filters.minPrice) {
      query["servicePricing.serviceBasePrice"].$gte = filters.minPrice;
    }
    if (filters.maxPrice) {
      query["servicePricing.serviceBasePrice"].$lte = filters.maxPrice;
    }
  }

  return this.find(query).sort({ score: { $meta: "textScore" } });
};

// Virtual for checking if service is approved
serviceSchema.virtual("isApproved").get(function () {
  return !!this.approvedAt && !this.rejectedAt;
});

// Virtual for checking if service is rejected
serviceSchema.virtual("isRejected").get(function () {
  return !!this.rejectedAt;
});

// Virtual for checking if service is pending
serviceSchema.virtual("isPending").get(function () {
  return !this.approvedAt && !this.rejectedAt;
});

// Export the model
export const ServiceModel = model<Service, IServiceModel>(
  "Service",
  serviceSchema
);
