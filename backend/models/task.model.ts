// models/task.model.ts

import { Schema, HydratedDocument, model } from "mongoose";
import {
  TaskPriority,
  Task,
  TaskModel,
  TaskMethods,
  TaskStatus,
  ProviderMatchResult,
} from "../types/tasks.types";
import { ProviderModel, userLocationSchema } from "./profiles/provider.model";
import { ServiceModel } from "./service.model";
import { UserRole } from "../types/base.types";

/**
 * Task Schedule Sub-Schema
 */
const taskScheduleSchema = new Schema(
  {
    priority: {
      type: String,
      enum: Object.values(TaskPriority),
      required: true,
      default: TaskPriority.MEDIUM,
    },
    preferredDate: { type: Date },
    flexibleDates: {
      type: Boolean,
      default: false,
    },
    timeSlot: {
      start: { type: String, trim: true },
      end: { type: String, trim: true },
    },
  },
  { _id: false }
);

/**
 * Estimated Budget Sub-Schema
 */
const estimatedBudgetSchema = new Schema(
  {
    min: { type: Number, min: 0 },
    max: { type: Number, min: 0 },
    currency: {
      type: String,
    },
  },
  { _id: false }
);

/**
 * Matched Provider Sub-Schema
 */
const matchedProviderSchema = new Schema(
  {
    providerId: {
      type: Schema.Types.ObjectId,
      ref: "ProviderProfile",
      required: true,
    },
    matchScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    matchedServices: [
      {
        type: Schema.Types.ObjectId,
        ref: "Service",
      },
    ],
    matchReasons: [
      {
        type: String,
        trim: true,
      },
    ],
    distance: {
      type: Number,
      min: 0,
    },
  },
  { _id: false }
);

/**
 * Interested Provider Sub-Schema (for floating tasks)
 */
const interestedProviderSchema = new Schema(
  {
    providerId: {
      type: Schema.Types.ObjectId,
      ref: "ProviderProfile",
      required: true,
    },
    expressedAt: {
      type: Date,
      default: Date.now,
      required: true,
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
 * Requested Provider Sub-Schema
 */
const requestedProviderSchema = new Schema(
  {
    providerId: {
      type: Schema.Types.ObjectId,
      ref: "ProviderProfile",
      required: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    clientMessage: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { _id: false }
);

/**
 * Assigned Provider Sub-Schema
 */
const assignedProviderSchema = new Schema(
  {
    providerId: {
      type: Schema.Types.ObjectId,
      ref: "ProviderProfile",
      required: true,
    },
    acceptedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    providerMessage: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { _id: false }
);

/**
 * Matching Criteria Sub-Schema
 */
const matchingCriteriaSchema = new Schema(
  {
    useLocationOnly: {
      type: Boolean,
      default: false,
    },
    searchTerms: [
      {
        type: String,
        trim: true,
      },
    ],
    categoryMatch: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

/**
 * Main Task Schema
 */
const taskSchema = new Schema<Task, TaskModel, TaskMethods>(
  {
    // Basic Information
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      index: "text",
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
      index: "text",
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      index: true,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],

    // Customer Information
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    customerLocation: {
      type: userLocationSchema,
      required: true,
    },

    // Scheduling
    schedule: {
      type: taskScheduleSchema,
      required: true,
    },

    // Budget
    estimatedBudget: {
      type: estimatedBudgetSchema,
    },

    // Status & Flow
    status: {
      type: String,
      enum: Object.values(TaskStatus),
      default: TaskStatus.PENDING,
      index: true,
    },
    expiresAt: {
      type: Date,
      index: true,
    },

    // Matching Phase
    matchedProviders: [matchedProviderSchema],

    // Matching metadata
    matchingAttemptedAt: {
      type: Date,
    },
    matchingCriteria: matchingCriteriaSchema,

    // Floating Phase
    interestedProviders: [interestedProviderSchema],

    // Request Phase
    requestedProvider: requestedProviderSchema,

    // Acceptance Phase
    assignedProvider: assignedProviderSchema,

    // Completion
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
    cancelledBy: {
      type: String,
      enum: [UserRole.CUSTOMER, UserRole.PROVIDER],
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
taskSchema.index({ title: "text", description: "text" });
taskSchema.index({ tags: 1 });
taskSchema.index({ customerId: 1, status: 1, isDeleted: 1 });
taskSchema.index({ status: 1, expiresAt: 1, isDeleted: 1 });
taskSchema.index({ "customerLocation.locality": 1 });
taskSchema.index({ "customerLocation.region": 1 });
taskSchema.index({ "matchedProviders.providerId": 1, status: 1 });
taskSchema.index({ "interestedProviders.providerId": 1, status: 1 });
taskSchema.index({ "requestedProvider.providerId": 1 });
taskSchema.index({ "assignedProvider.providerId": 1 });
taskSchema.index({ createdAt: -1, status: 1 });
taskSchema.index({ category: 1, status: 1 });

/**
 * Pre-save middleware
 * ✅ FIXED: Removed auto-matching to prevent parallel saves
 */
taskSchema.pre("save", async function () {
  // Auto-set expiration if not set (default: 30 days)
  if (
    !this.expiresAt &&
    this.status !== TaskStatus.COMPLETED &&
    this.status !== TaskStatus.CANCELLED
  ) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    this.expiresAt = expiryDate;
  }

  // Validate time slot if provided
  if (this.schedule.timeSlot) {
    const { start, end } = this.schedule.timeSlot;
    if (start && end && start >= end) {
      throw new Error("Start time must be before end time");
    }
  }

  // Validate budget
  if (this.estimatedBudget) {
    const { min, max } = this.estimatedBudget;
    if (min && max && min > max) {
      throw new Error("Minimum budget cannot be greater than maximum budget");
    }
  }

  // ✅ REMOVED: Auto-matching moved to service layer to prevent parallel saves
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

/**
 * Find Matches - Intelligent or Location-only matching
 * ✅ FIXED: Handles providerId as array, no text search dependency
 */
taskSchema.methods.findMatches = async function (
  this: HydratedDocument<Task, TaskMethods>,
  strategy: "intelligent" | "location-only" = "intelligent"
) {
  this.matchingAttemptedAt = new Date();

  // Initialize matching criteria
  this.matchingCriteria = {
    useLocationOnly: strategy === "location-only",
    searchTerms: [],
    categoryMatch: false,
  };

  let matches: ProviderMatchResult[] = [];

  if (strategy === "intelligent") {
    // Extract search terms from title and description
    const searchText = `${this.title} ${this.description}`.toLowerCase();
    const keywords = searchText
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .filter((word) => !["the", "and", "for", "with", "need"].includes(word));

    this.matchingCriteria.searchTerms = keywords;

    if (keywords.length > 0) {
      // Build service query without text search dependency
      const serviceQuery: any = {
        isActive: true,
        deletedAt: null,
      };

      // Build $or conditions
      const orConditions: any[] = [];

      // Add tag matching
      if (this.tags && this.tags.length > 0) {
        orConditions.push({ tags: { $in: this.tags } });
      }

      // Add category matching
      if (this.category) {
        orConditions.push({ categoryId: this.category });
        this.matchingCriteria.categoryMatch = true;
      }

      // Add keyword matching using regex (fallback for text search)
      if (keywords.length > 0) {
        const keywordRegex = keywords.map(k => new RegExp(k, 'i'));
        orConditions.push(
          { title: { $in: keywordRegex } },
          { description: { $in: keywordRegex } },
          { tags: { $in: keywords } }
        );
      }

      // Only add $or if we have conditions
      if (orConditions.length > 0) {
        serviceQuery.$or = orConditions;
      } else {
        // If no conditions, just find active services
        console.log("No search criteria, finding all active services");
      }

      // ✅ DON'T populate providerId - keep them as ObjectIds
      const matchingServices = await ServiceModel.find(serviceQuery).lean();

      // Group services by provider
      const servicesByProvider = new Map<string, any[]>();

      // ✅ FIXED: Handle providerId as an array of ObjectIds
      for (const service of matchingServices) {
        if (service.providerId && Array.isArray(service.providerId)) {
          // Loop through each provider ID in the array
          for (const pid of service.providerId) {
            // Validate each provider ID (check for null/undefined and valid length)
            if (
              pid && 
              typeof pid === 'object' && 
              pid.toString &&
              pid.toString().length === 24
            ) {
              const providerIdString = pid.toString();
              if (!servicesByProvider.has(providerIdString)) {
                servicesByProvider.set(providerIdString, []);
              }
              servicesByProvider.get(providerIdString)!.push(service);
            }
          }
        }
      }

      if (servicesByProvider.size > 0) {
        // ✅ Filter out any invalid IDs before querying
        const validProviderIds = Array.from(servicesByProvider.keys()).filter(
          id => id && id.length === 24
        );

        if (validProviderIds.length === 0) {
          console.log("No valid provider IDs found after filtering");
          // Fallback to location-only
          strategy = "location-only";
          this.matchingCriteria.useLocationOnly = true;
        } else {
          // Get providers in customer's location
          const providers = await ProviderModel.find({
            _id: { $in: validProviderIds },
            $or: [
              { "locationData.locality": this.customerLocation.locality },
              { "locationData.city": this.customerLocation.city },
              { "locationData.region": this.customerLocation.region },
            ],
            isDeleted: { $ne: true },
          }).lean();

          // Calculate match scores
          matches = providers.map((provider: any) => {
            const relevantServices =
              servicesByProvider.get(provider._id.toString()) || [];
            return this.calculateIntelligentMatchScore(
              provider,
              relevantServices
            );
          });

          // Sort by match score
          matches.sort((a, b) => b.matchScore - a.matchScore);

          // Filter out low scores
          matches = matches.filter((m) => m.matchScore >= 40);
        }
      } else {
        console.log("No services matched, falling back to location-only");
        strategy = "location-only";
        this.matchingCriteria.useLocationOnly = true;
      }
    }

    // Fallback to location-only if too few matches
    if (matches.length < 3) {
      strategy = "location-only";
      this.matchingCriteria.useLocationOnly = true;
    }
  }

  // Location-only matching
  if (strategy === "location-only") {
    const providers = await ProviderModel.find({
      $or: [
        { "locationData.locality": this.customerLocation.locality },
        { "locationData.city": this.customerLocation.city },
        { "locationData.region": this.customerLocation.region },
      ],
      isDeleted: { $ne: true },
    }).lean();

    matches = providers.map((provider: any) =>
      this.calculateLocationMatchScore(provider)
    );

    // Sort by match score
    matches.sort((a, b) => b.matchScore - a.matchScore);
  }

  // Update task with matches
  if (matches.length > 0) {
    this.matchedProviders = matches.slice(0, 20).map((m) => ({
      providerId: m.providerId,
      matchScore: m.matchScore,
      matchedServices: m.matchedServices,
      matchReasons: m.matchReasons,
      distance: m.distance,
    }));
    this.status = TaskStatus.MATCHED;
  } else {
    this.matchedProviders = [];
    this.status = TaskStatus.FLOATING;
  }

  await this.save();
  return this;
};

/**
 * Calculate intelligent match score
 */
taskSchema.methods.calculateIntelligentMatchScore = function (
  provider: any,
  relevantServices: any[]
): ProviderMatchResult {
  const scores = {
    titleScore: 0,
    descriptionScore: 0,
    tagScore: 0,
    categoryScore: 0,
    locationScore: 0,
  };

  // Service relevance (40 points)
  if (relevantServices.length > 0) {
    scores.titleScore = 20;
    scores.descriptionScore = 20;
  }

  // Tag matching (20 points)
  if (this.tags && this.tags.length > 0) {
    const serviceTags = relevantServices.flatMap((s) => s.tags || []);
    const matchingTags = this.tags.filter((tag: string) =>
      serviceTags.some((st: string) => st.toLowerCase() === tag.toLowerCase())
    );
    scores.tagScore = (matchingTags.length / this.tags.length) * 20;
  }

  // Category match (15 points)
  if (
    this.category &&
    relevantServices.some(
      (s) => s.categoryId?.toString() === this.category?.toString()
    )
  ) {
    scores.categoryScore = 15;
  }

  // Location proximity (25 points)
  if (provider.locationData?.locality === this.customerLocation.locality) {
    scores.locationScore = 25;
  } else if (provider.locationData?.city === this.customerLocation.city) {
    scores.locationScore = 15;
  } else if (provider.locationData?.region === this.customerLocation.region) {
    scores.locationScore = 10;
  }

  const matchScore = Math.round(
    scores.titleScore +
      scores.descriptionScore +
      scores.tagScore +
      scores.categoryScore +
      scores.locationScore
  );

  const matchReasons = this.buildMatchReasons(
    provider,
    relevantServices,
    scores
  );

  return {
    providerId: provider._id,
    matchScore: Math.min(matchScore, 100),
    matchedServices: relevantServices.map((s) => s._id),
    matchReasons,
    distance: undefined,
    scoreBreakdown: scores,
  };
};

/**
 * Calculate location-only match score
 */
taskSchema.methods.calculateLocationMatchScore = function (
  provider: any
): ProviderMatchResult {
  const scores = {
    titleScore: 0,
    descriptionScore: 0,
    tagScore: 0,
    categoryScore: 0,
    locationScore: 0,
  };

  // Location match (100 points distributed)
  if (provider.locationData?.locality === this.customerLocation.locality) {
    scores.locationScore = 100;
  } else if (provider.locationData?.city === this.customerLocation.city) {
    scores.locationScore = 70;
  } else if (provider.locationData?.region === this.customerLocation.region) {
    scores.locationScore = 50;
  }

  const matchReasons = ["Available in your area"];

  if (provider.isCompanyTrained) {
    matchReasons.push("Company trained");
  }

  if (provider.isAlwaysAvailable) {
    matchReasons.push("Available anytime");
  }

  return {
    providerId: provider._id,
    matchScore: Math.round(scores.locationScore),
    matchedServices: [],
    matchReasons,
    distance: undefined,
    scoreBreakdown: scores,
  };
};

/**
 * Build match reasons
 */
taskSchema.methods.buildMatchReasons = function (
  provider: any,
  services: any[],
  scores: any
): string[] {
  const reasons: string[] = [];

  if (services.length > 0) {
    reasons.push(`Offers ${services.length} relevant service(s)`);
  }

  if (scores.tagScore > 10) {
    reasons.push("Service tags match your needs");
  }

  if (scores.categoryScore > 0) {
    reasons.push("Service category matches");
  }

  if (provider.locationData?.locality === this.customerLocation.locality) {
    reasons.push(`Located in ${this.customerLocation.locality}`);
  } else if (provider.locationData?.city === this.customerLocation.city) {
    reasons.push(`Located in ${this.customerLocation.city}`);
  }

  if (provider.isCompanyTrained) {
    reasons.push("Company trained");
  }

  if (provider.isAlwaysAvailable) {
    reasons.push("Available anytime");
  }

  if (provider.locationData?.isAddressVerified) {
    reasons.push("Verified address");
  }

  return reasons.length > 0 ? reasons : ["Available in your area"];
};

/**
 * Make Floating
 */
taskSchema.methods.makeFloating = function (
  this: HydratedDocument<Task, TaskMethods>
) {
  this.status = TaskStatus.FLOATING;
  this.matchedProviders = [];
  return this.save();
};

/**
 * Add Provider Interest (for floating tasks)
 */
taskSchema.methods.addProviderInterest = function (
  this: HydratedDocument<Task, TaskMethods>,
  providerId: any,
  message?: string
) {
  if (this.status !== TaskStatus.FLOATING) {
    throw new Error("Only floating tasks can receive provider interest");
  }

  if (!this.interestedProviders) {
    this.interestedProviders = [];
  }

  const alreadyInterested = this.interestedProviders.some(
    (ip) => ip.providerId.toString() === providerId.toString()
  );

  if (!alreadyInterested) {
    this.interestedProviders.push({
      providerId,
      expressedAt: new Date(),
      message,
    });
  }

  return this.save();
};

/**
 * Remove Provider Interest
 */
taskSchema.methods.removeProviderInterest = function (
  this: HydratedDocument<Task, TaskMethods>,
  providerId: any
) {
  if (this.interestedProviders) {
    this.interestedProviders = this.interestedProviders.filter(
      (ip) => ip.providerId.toString() !== providerId.toString()
    );
  }
  return this.save();
};

/**
 * Request Provider (Customer selects a provider)
 */
taskSchema.methods.requestProvider = function (
  this: HydratedDocument<Task, TaskMethods>,
  providerId: any,
  message?: string
) {
  // Check if provider is in matched list or interested list
  const isMatched = this.matchedProviders?.some(
    (mp) => mp.providerId.toString() === providerId.toString()
  );

  const isInterested = this.interestedProviders?.some(
    (ip) => ip.providerId.toString() === providerId.toString()
  );

  if (!isMatched && !isInterested) {
    throw new Error("Provider must be in matched or interested list");
  }

  this.requestedProvider = {
    providerId,
    requestedAt: new Date(),
    clientMessage: message,
  };
  this.status = TaskStatus.REQUESTED;

  return this.save();
};

/**
 * Accept Task (Provider accepts the request)
 */
taskSchema.methods.acceptTask = function (
  this: HydratedDocument<Task, TaskMethods>,
  providerId: any,
  message?: string
) {
  if (this.requestedProvider?.providerId.toString() !== providerId.toString()) {
    throw new Error("Only the requested provider can accept this task");
  }

  this.assignedProvider = {
    providerId,
    acceptedAt: new Date(),
    providerMessage: message,
  };
  this.status = TaskStatus.ACCEPTED;

  return this.save();
};

/**
 * Reject Task (Provider rejects the request)
 */
taskSchema.methods.rejectTask = function (
  this: HydratedDocument<Task, TaskMethods>,
  providerId: any,
  reason?: string
) {
  if (this.requestedProvider?.providerId.toString() !== providerId.toString()) {
    throw new Error("Only the requested provider can reject this task");
  }

  // Move back to previous status
  if (this.matchedProviders && this.matchedProviders.length > 0) {
    this.status = TaskStatus.MATCHED;
  } else if (this.interestedProviders && this.interestedProviders.length > 0) {
    this.status = TaskStatus.FLOATING;
  } else {
    this.status = TaskStatus.PENDING;
  }

  this.requestedProvider = undefined;
  this.cancellationReason = reason;

  return this.save();
};

/**
 * Start Task
 */
taskSchema.methods.startTask = function (
  this: HydratedDocument<Task, TaskMethods>
) {
  if (this.status !== TaskStatus.ACCEPTED) {
    throw new Error("Task must be accepted before starting");
  }

  this.status = TaskStatus.IN_PROGRESS;
  return this.save();
};

/**
 * Complete Task
 */
taskSchema.methods.completeTask = function (
  this: HydratedDocument<Task, TaskMethods>
) {
  this.status = TaskStatus.COMPLETED;
  this.completedAt = new Date();
  return this.save();
};

/**
 * Cancel Task
 */
taskSchema.methods.cancelTask = function (
  this: HydratedDocument<Task, TaskMethods>,
  reason?: string,
  cancelledBy?: UserRole.CUSTOMER | UserRole.PROVIDER
) {
  this.status = TaskStatus.CANCELLED;
  this.cancelledAt = new Date();
  this.cancellationReason = reason;
  this.cancelledBy = cancelledBy;
  return this.save();
};

/**
 * Static Methods
 */
taskSchema.statics.findActive = function () {
  return this.find({
    isDeleted: { $ne: true },
    status: {
      $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED, TaskStatus.EXPIRED],
    },
  })
    .populate("customerId", "name email")
    .populate(
      "matchedProviders.providerId",
      "businessName locationData profile"
    )
    .populate(
      "interestedProviders.providerId",
      "businessName locationData profile"
    )
    .populate(
      "requestedProvider.providerId",
      "businessName locationData profile"
    )
    .populate(
      "assignedProvider.providerId",
      "businessName locationData profile"
    )
    .sort({ createdAt: -1 });
};

taskSchema.statics.findByCustomer = function (customerId: string) {
  return this.find({
    customerId,
    isDeleted: { $ne: true },
  })
    .populate(
      "matchedProviders.providerId",
      "businessName locationData profile"
    )
    .populate(
      "interestedProviders.providerId",
      "businessName locationData profile"
    )
    .populate(
      "requestedProvider.providerId",
      "businessName locationData profile"
    )
    .populate(
      "assignedProvider.providerId",
      "businessName locationData profile"
    )
    .sort({ createdAt: -1 });
};

taskSchema.statics.findByService = function (serviceId: string) {
  return this.find({
    "matchedProviders.matchedServices": serviceId,
    isDeleted: { $ne: true },
  })
    .populate("customerId", "name email")
    .sort({ createdAt: -1 });
};

taskSchema.statics.findFloatingTasks = function () {
  return this.find({
    status: TaskStatus.FLOATING,
    isDeleted: { $ne: true },
    $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: null }],
  })
    .populate("customerId", "name email")
    .populate(
      "interestedProviders.providerId",
      "businessName locationData profile"
    )
    .sort({ createdAt: -1 });
};

taskSchema.statics.findMatchedForProvider = function (providerId: string) {
  return this.find({
    "matchedProviders.providerId": providerId,
    status: TaskStatus.MATCHED,
    isDeleted: { $ne: true },
    $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: null }],
  })
    .populate("customerId", "name email")
    .sort({ createdAt: -1 });
};

taskSchema.statics.findByAssignedProvider = function (providerId: string) {
  return this.find({
    "assignedProvider.providerId": providerId,
    status: { $in: [TaskStatus.ACCEPTED, TaskStatus.IN_PROGRESS] },
    isDeleted: { $ne: true },
  })
    .populate("customerId", "name email")
    .sort({ createdAt: -1 });
};

taskSchema.statics.searchTasks = function (searchTerm: string, filters?: any) {
  const query: any = {
    $text: { $search: searchTerm },
    isDeleted: { $ne: true },
  };

  if (filters?.status) {
    query.status = filters.status;
  }

  if (filters?.serviceId) {
    query["matchedProviders.matchedServices"] = filters.serviceId;
  }

  if (filters?.location) {
    query.$or = [
      { "customerLocation.locality": filters.location },
      { "customerLocation.city": filters.location },
      { "customerLocation.region": filters.location },
    ];
  }

  return this.find(query)
    .populate("customerId", "name email")
    .populate("matchedProviders.providerId", "businessName locationData")
    .sort({ score: { $meta: "textScore" }, createdAt: -1 });
};

/**
 * Virtuals
 */
taskSchema.virtual("isExpired").get(function () {
  return this.expiresAt ? this.expiresAt < new Date() : false;
});

taskSchema.virtual("isActive").get(function () {
  return (
    ![TaskStatus.COMPLETED, TaskStatus.CANCELLED, TaskStatus.EXPIRED].includes(
      this.status
    ) &&
    !this.isDeleted &&
    (!this.expiresAt || this.expiresAt > new Date())
  );
});

taskSchema.virtual("hasMatches").get(function () {
  return this.matchedProviders && this.matchedProviders.length > 0;
});

taskSchema.virtual("isFloating").get(function () {
  return this.status === TaskStatus.FLOATING;
});

taskSchema.virtual("isAssigned").get(function () {
  return !!this.assignedProvider;
});

taskSchema.virtual("matchCount").get(function () {
  return this.matchedProviders?.length || 0;
});

taskSchema.virtual("interestCount").get(function () {
  return this.interestedProviders?.length || 0;
});

taskSchema.virtual("daysUntilExpiry").get(function () {
  if (!this.expiresAt) return -1;
  const now = new Date();
  const diff = this.expiresAt.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

/**
 * Export the model
 */
export const TaskModelInstance = model<Task, TaskModel>("Task", taskSchema);
export default TaskModelInstance;