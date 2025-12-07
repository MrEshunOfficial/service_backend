// models/task.model.ts
import { Schema, model, HydratedDocument } from "mongoose";
import {
  TaskPriority,
  Task,
  TaskMethods,
  TaskStatus,
  ITaskModel,
} from "../types/tasks.types";

/**
 * Task Location Sub-Schema
 */
const taskLocationSchema = new Schema(
  {
    clientLocality: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    clientGPSAddress: {
      type: String,
      required: true,
      trim: true,
    },
    providerLocality: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
  },
  { _id: false }
);

/**
 * Task Schedule Sub-Schema
 */
const taskScheduleSchema = new Schema(
  {
    urgency: {
      type: String,
      enum: Object.values(TaskPriority),
      required: true,
      default: TaskPriority.MEDIUM,
    },
    preferredDate: { type: Date },
    timeSlot: {
      startTime: { type: String, trim: true },
      endTime: { type: String, trim: true },
    },
  },
  { _id: false }
);

/**
 * Main Task Schema
 */
const taskSchema = new Schema<Task, ITaskModel, TaskMethods>(
  {
    // Basic Information
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      index: "text",
    },

    // Customer Information
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Location
    location: {
      type: taskLocationSchema,
      required: true,
    },

    // Scheduling
    schedule: {
      type: taskScheduleSchema,
      required: true,
    },

    // Status & Visibility
    status: {
      type: String,
      enum: Object.values(TaskStatus),
      default: TaskStatus.DRAFT,
      index: true,
    },
    expiresAt: {
      type: Date,
      index: true,
    },

    // Matching Results (Auto-matched on creation)
    matchedProviders: [
      {
        type: Schema.Types.ObjectId,
        ref: "ProviderProfile",
      },
    ],
    hasMatches: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Provider Interest (For floating tasks)
    interestedProviders: [
      {
        type: Schema.Types.ObjectId,
        ref: "ProviderProfile",
      },
    ],

    // Assignment
    requestedProviderId: {
      type: Schema.Types.ObjectId,
      ref: "ProviderProfile",
      index: true,
    },
    requestedAt: {
      type: Date,
    },
    assignedProviderId: {
      type: Schema.Types.ObjectId,
      ref: "ProviderProfile",
      index: true,
    },
    assignedAt: {
      type: Date,
    },

    // Task Completion
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    // Metadata
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Soft Delete
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
    collection: "tasks",
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
taskSchema.index({ title: "text" });
taskSchema.index({ customerId: 1, status: 1, isDeleted: 1 });
taskSchema.index({ status: 1, hasMatches: 1, expiresAt: 1, isDeleted: 1 });
taskSchema.index({
  "location.clientLocality": 1,
  "location.providerLocality": 1,
});
taskSchema.index({ matchedProviders: 1, status: 1 });
taskSchema.index({ requestedProviderId: 1, status: 1 });
taskSchema.index({ assignedProviderId: 1, status: 1 });
taskSchema.index({ createdAt: -1, status: 1 });

/**
 * Pre-save middleware
 */
taskSchema.pre("save", async function () {
  // Auto-set expiration if not set (default: 30 days)
  if (
    !this.expiresAt &&
    (this.status === TaskStatus.OPEN || this.status === TaskStatus.FLOATING)
  ) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    this.expiresAt = expiryDate;
  }

  // Validate time slot if provided
  if (this.schedule.timeSlot) {
    const { startTime, endTime } = this.schedule.timeSlot;
    if (startTime && endTime && startTime >= endTime) {
      throw new Error("Start time must be before end time");
    }
  }

  // Auto-match providers when task moves from DRAFT to OPEN/FLOATING
  if (
    this.isModified("status") &&
    this.status !== TaskStatus.DRAFT &&
    !this.hasMatches
  ) {
    try {
      const matches = await this.findMatchingProviders();

      if (matches && matches.length > 0) {
        this.matchedProviders = matches.map((m) => m.provider as any);
        this.hasMatches = true;
        this.status = TaskStatus.OPEN;
      } else {
        this.matchedProviders = [];
        this.hasMatches = false;
        this.status = TaskStatus.FLOATING;
      }
    } catch (error) {
      console.error("Error auto-matching providers:", error);
      // Default to floating if matching fails
      this.status = TaskStatus.FLOATING;
      this.hasMatches = false;
    }
  }
});

/**
 * Instance Methods
 */
taskSchema.methods.softDelete = function (
  this: HydratedDocument<Task, TaskMethods>,
  deletedBy?: any
) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  if (deletedBy) this.deletedBy = deletedBy;
  return this.save();
};

taskSchema.methods.restore = function (
  this: HydratedDocument<Task, TaskMethods>
) {
  this.isDeleted = false;
  this.deletedAt = undefined;
  this.deletedBy = undefined;
  return this.save();
};

taskSchema.methods.requestProvider = function (
  this: HydratedDocument<Task, TaskMethods>,
  providerId: any
) {
  // Client requests a provider (from matched list or interested providers)
  this.requestedProviderId = providerId;
  this.requestedAt = new Date();
  this.status = TaskStatus.REQUESTED;
  return this.save();
};

taskSchema.methods.acceptRequest = function (
  this: HydratedDocument<Task, TaskMethods>,
  providerId: any
) {
  // Provider accepts the client's request
  if (this.requestedProviderId?.toString() !== providerId.toString()) {
    throw new Error("Only the requested provider can accept this task");
  }

  this.assignedProviderId = providerId;
  this.assignedAt = new Date();
  this.status = TaskStatus.ASSIGNED;
  return this.save();
};

taskSchema.methods.markAsCompleted = function (
  this: HydratedDocument<Task, TaskMethods>
) {
  this.status = TaskStatus.COMPLETED;
  this.completedAt = new Date();
  return this.save();
};

taskSchema.methods.cancel = function (
  this: HydratedDocument<Task, TaskMethods>,
  reason?: string
) {
  this.status = TaskStatus.CANCELLED;
  this.cancelledAt = new Date();
  if (reason) this.cancellationReason = reason;
  return this.save();
};

taskSchema.methods.addInterestedProvider = function (
  this: HydratedDocument<Task, TaskMethods>,
  providerId: any
) {
  // Only for floating tasks
  if (this.status !== TaskStatus.FLOATING) {
    throw new Error("Only floating tasks can receive provider interest");
  }

  if (!this.interestedProviders) {
    this.interestedProviders = [];
  }
  if (!this.interestedProviders.includes(providerId)) {
    this.interestedProviders.push(providerId);
  }
  return this.save();
};

taskSchema.methods.removeInterestedProvider = function (
  this: HydratedDocument<Task, TaskMethods>,
  providerId: any
) {
  if (this.interestedProviders) {
    this.interestedProviders = this.interestedProviders.filter(
      (id) => id.toString() !== providerId.toString()
    );
  }
  return this.save();
};

taskSchema.methods.findMatchingProviders = async function (
  this: HydratedDocument<Task, TaskMethods>
) {
  // Import models dynamically to avoid circular dependencies
  const { ProviderModel } = await import("./profiles/provider.model");
  const { ServiceModel } = await import("./service.model");

  // Extract keywords from task title
  const keywords = this.title
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2); // Filter out short words

  if (keywords.length === 0) {
    return []; // No keywords to match
  }

  // Find services that match the keywords
  const matchingServices = await ServiceModel.find({
    $text: { $search: keywords.join(" ") },
    isActive: true,
    deletedAt: null,
  }).populate("providerId");

  // Filter services and get unique provider IDs
  const providerIdsSet = new Set<string>();
  const servicesByProvider = new Map<string, any[]>();

  for (const service of matchingServices) {
    // providerId is an array in Service model
    if (service.providerId && Array.isArray(service.providerId)) {
      for (const providerRef of service.providerId) {
        const provider = providerRef as any;
        if (provider && provider._id) {
          const providerId = provider._id.toString();
          providerIdsSet.add(providerId);

          if (!servicesByProvider.has(providerId)) {
            servicesByProvider.set(providerId, []);
          }
          servicesByProvider.get(providerId)!.push(service);
        }
      }
    }
  }

  if (providerIdsSet.size === 0) {
    return []; // No providers found
  }

  // Fetch full provider profiles matching the locality
  const providers = await ProviderModel.find({
    _id: { $in: Array.from(providerIdsSet) },
    "locationData.locality": this.location.providerLocality,
    isDeleted: { $ne: true },
  }).populate("profile");

  // Calculate match scores
  const matches = providers.map((provider) => {
    const relevantServices =
      servicesByProvider.get(provider._id.toString()) || [];

    return {
      provider: provider._id,
      matchScore: this.calculateMatchScore(provider, relevantServices),
      matchReasons: this.getMatchReasons(provider, relevantServices),
      availability: provider.isAlwaysAvailable || false,
      relevantServices,
      providerRating: (provider as any).averageRating || 0,
      completedTasksCount: (provider as any).completedTasks || 0,
      responseTime: (provider as any).averageResponseTime,
    };
  });

  // Sort by match score (highest first)
  return matches.sort((a, b) => b.matchScore - a.matchScore);
};

// Helper method to calculate match score
taskSchema.methods.calculateMatchScore = function (
  provider: any,
  relevantServices: any[] = []
) {
  let score = 0;

  // Provider locality match (40 points) - CRITICAL
  // Must match locationData.locality since that's what ProviderProfile uses
  if (provider.locationData?.locality === this.location.providerLocality) {
    score += 40;
  }

  // Service relevance (30 points)
  if (relevantServices.length > 0) {
    score += 30;
  }

  // Rating bonus (15 points max)
  const profile = provider.profile || provider;
  if (profile.averageRating) {
    score += (profile.averageRating / 5) * 15;
  }

  // Experience bonus (10 points max)
  if (profile.completedTasks) {
    const experienceScore = Math.min(profile.completedTasks / 10, 1) * 10;
    score += experienceScore;
  }

  // Availability match (5 points)
  if (provider.isAlwaysAvailable) {
    score += 5;
  } else if (provider.workingHours && this.schedule.timeSlot) {
    // Check if provider's working hours overlap with task time slot
    // Simple check for now - can be enhanced
    score += 3;
  }

  return Math.min(Math.round(score), 100);
};

// Helper method to get match reasons
taskSchema.methods.getMatchReasons = function (provider: any, services: any[]) {
  const reasons: string[] = [];

  // Check locality match
  if (provider.locationData?.locality === this.location.providerLocality) {
    reasons.push(`Located in ${this.location.providerLocality}`);
  }

  // Service offerings
  if (services.length > 0) {
    reasons.push(`Offers ${services.length} relevant service(s)`);
  }

  // Rating - check both provider and profile
  const profile = provider.profile || provider;
  const rating = profile.averageRating || provider.averageRating;

  if (rating >= 4.5) {
    reasons.push("Highly rated provider");
  } else if (rating >= 4.0) {
    reasons.push("Well-rated provider");
  }

  // Experience
  const completedTasks = profile.completedTasks || provider.completedTasks;
  if (completedTasks >= 50) {
    reasons.push("Very experienced provider");
  } else if (completedTasks >= 10) {
    reasons.push("Experienced provider");
  }

  // Availability
  if (provider.isAlwaysAvailable) {
    reasons.push("Available anytime");
  } else if (provider.workingHours) {
    reasons.push("Has set working hours");
  }

  // Company trained
  if (provider.isCompanyTrained) {
    reasons.push("Company trained");
  }

  // Verified address
  if (provider.locationData?.isAddressVerified) {
    reasons.push("Verified address");
  }

  return reasons.length > 0 ? reasons : ["Available in your area"];
};

/**
 * Static Methods - ALL UPDATED WITH PROPER POPULATION
 */
taskSchema.statics.findActive = function () {
  return this.find({ isDeleted: { $ne: true } })
    .populate("customerId", "name email")
    .populate("matchedProviders", "businessName locationData profile")
    .populate("interestedProviders", "businessName locationData profile")
    .populate("requestedProviderId", "businessName locationData profile")
    .populate("assignedProviderId", "businessName locationData profile");
};

taskSchema.statics.findByCustomer = function (customerId: string) {
  return this.find({
    customerId,
    isDeleted: { $ne: true },
  })
    .sort({ createdAt: -1 })
    .populate("customerId", "name email")
    .populate("matchedProviders", "businessName locationData profile")
    .populate("interestedProviders", "businessName locationData profile")
    .populate("requestedProviderId", "businessName locationData profile")
    .populate("assignedProviderId", "businessName locationData profile");
};

taskSchema.statics.findFloatingTasks = function () {
  return this.find({
    status: TaskStatus.FLOATING,
    hasMatches: false,
    isDeleted: { $ne: true },
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .populate("customerId", "name email")
    .populate("interestedProviders", "businessName locationData profile");
};

taskSchema.statics.findTasksWithMatches = function () {
  return this.find({
    status: TaskStatus.OPEN,
    hasMatches: true,
    isDeleted: { $ne: true },
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .populate("customerId", "name email")
    .populate("matchedProviders", "businessName locationData profile");
};

taskSchema.statics.findByProviderInMatches = function (providerId: string) {
  return this.find({
    matchedProviders: providerId,
    status: TaskStatus.OPEN,
    isDeleted: { $ne: true },
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .populate("customerId", "name email")
    .populate("matchedProviders", "businessName locationData profile")
    .populate("interestedProviders", "businessName locationData profile")
    .populate("requestedProviderId", "businessName locationData profile")
    .populate("assignedProviderId", "businessName locationData profile");
};

taskSchema.statics.searchTasks = function (searchTerm: string) {
  return this.find({
    $text: { $search: searchTerm },
    $or: [{ status: TaskStatus.OPEN }, { status: TaskStatus.FLOATING }],
    isDeleted: { $ne: true },
    expiresAt: { $gt: new Date() },
  })
    .sort({ score: { $meta: "textScore" }, createdAt: -1 })
    .populate("customerId", "name email")
    .populate("matchedProviders", "businessName locationData profile")
    .populate("interestedProviders", "businessName locationData profile")
    .populate("requestedProviderId", "businessName locationData profile")
    .populate("assignedProviderId", "businessName locationData profile");
};

/**
 * Virtuals
 */
taskSchema.virtual("isExpired").get(function () {
  return this.expiresAt ? this.expiresAt < new Date() : false;
});

taskSchema.virtual("isActive").get(function () {
  return (
    (this.status === TaskStatus.OPEN || this.status === TaskStatus.FLOATING) &&
    !this.isDeleted &&
    (!this.expiresAt || this.expiresAt > new Date())
  );
});

taskSchema.virtual("isFloating").get(function () {
  return this.status === TaskStatus.FLOATING && !this.hasMatches;
});

taskSchema.virtual("hasAssignedProvider").get(function () {
  return !!this.assignedProviderId;
});

taskSchema.virtual("daysUntilExpiry").get(function () {
  if (!this.expiresAt) return -1;
  const now = new Date();
  const diff = this.expiresAt.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

taskSchema.virtual("matchCount").get(function () {
  return this.matchedProviders?.length || 0;
});

taskSchema.virtual("interestCount").get(function () {
  return this.interestedProviders?.length || 0;
});

/**
 * Export the model
 */
export const TaskModel = model<Task, ITaskModel>("Task", taskSchema);