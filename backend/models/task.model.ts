// models/task.model.ts
import { Schema, model, HydratedDocument } from "mongoose";
import { UserLocation } from "../types/base.types";
import { TaskPriority, BudgetType, Task, TaskMethods, TaskStatus, ITaskModel } from "../types/tasks.types";

/**
 * Coordinates Sub-Schema
 */
const coordinatesSchema = new Schema(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  { _id: false }
);

/**
 * User Location Sub-Schema
 */
const userLocationSchema = new Schema(
  {
    ghanaPostGPS: { type: String, required: true, trim: true },
    nearbyLandmark: { type: String, trim: true },
    region: { type: String, trim: true },
    city: { type: String, trim: true },
    district: { type: String, trim: true },
    locality: { type: String, trim: true },
    streetName: { type: String, trim: true },
    houseNumber: { type: String, trim: true },
    gpsCoordinates: { type: coordinatesSchema },
    isAddressVerified: { type: Boolean, default: false },
    sourceProvider: {
      type: String,
      enum: ["openstreetmap", "google", "ghanapost"],
    },
  },
  { _id: false }
);

/**
 * Task Schedule Sub-Schema
 */
const taskScheduleSchema = new Schema(
  {
    preferredStartDate: { type: Date },
    preferredEndDate: { type: Date },
    isFlexible: { type: Boolean, default: true },
    urgency: {
      type: String,
      enum: Object.values(TaskPriority),
      default: TaskPriority.MEDIUM,
    },
    estimatedDuration: { type: Number, min: 0 },
    specificTimeSlots: [
      {
        date: { type: Date, required: true },
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
      },
    ],
  },
  { _id: false }
);

/**
 * Task Budget Sub-Schema
 */
const taskBudgetSchema = new Schema(
  {
    type: {
      type: String,
      enum: Object.values(BudgetType),
      required: true,
      default: BudgetType.FIXED,
    },
    amount: { type: Number, min: 0 },
    minAmount: { type: Number, min: 0 },
    maxAmount: { type: Number, min: 0 },
    hourlyRate: { type: Number, min: 0 },
    currency: {
      type: String,
      required: true,
      default: "GHS",
      enum: ["GHS", "USD"],
    },
    includesMaterials: { type: Boolean, default: false },
    additionalCosts: [
      {
        description: { type: String, required: true, trim: true },
        amount: { type: Number, required: true, min: 0 },
      },
    ],
  },
  { _id: false }
);

/**
 * Task Requirements Sub-Schema
 */
const taskRequirementsSchema = new Schema(
  {
    skillsNeeded: {
      type: [String],
      default: [],
      validate: {
        validator: (skills: string[]) => skills.length <= 20,
        message: "Maximum 20 skills allowed",
      },
    },
    experienceLevel: {
      type: String,
      enum: ["beginner", "intermediate", "expert", "any"],
      default: "any",
    },
    certificationRequired: { type: Boolean, default: false },
    specificTools: { type: [String], default: [] },
    languagePreference: { type: [String], default: [] },
    minRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 1,
    },
  },
  { _id: false }
);

/**
 * Task Media Sub-Schema
 */
const taskMediaSchema = new Schema(
  {
    images: [{ type: Schema.Types.ObjectId, ref: "File" }],
    documents: [{ type: Schema.Types.ObjectId, ref: "File" }],
    videos: [{ type: Schema.Types.ObjectId, ref: "File" }],
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
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
      index: "text",
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    relatedServices: [
      {
        type: Schema.Types.ObjectId,
        ref: "Service",
      },
    ],
    tags: {
      type: [String],
      default: [],
      index: "text",
      validate: {
        validator: (tags: string[]) => tags.length <= 20,
        message: "Maximum 20 tags allowed",
      },
    },

    // Customer Information
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    customerProfileId: {
      type: Schema.Types.ObjectId,
      ref: "UserProfile",
    },

    // Location
    taskLocation: {
      type: userLocationSchema,
      required: true,
    },
    isRemoteTask: {
      type: Boolean,
      default: false,
      index: true,
    },
    maxTravelDistance: {
      type: Number,
      min: 0,
      max: 500, // Max 500km
    },

    // Budget & Pricing
    budget: {
      type: taskBudgetSchema,
      required: true,
    },

    // Scheduling
    schedule: {
      type: taskScheduleSchema,
      required: true,
    },

    // Requirements
    requirements: {
      type: taskRequirementsSchema,
      required: true,
    },

    // Media
    media: {
      type: taskMediaSchema,
    },

    // Status & Visibility
    status: {
      type: String,
      enum: Object.values(TaskStatus),
      default: TaskStatus.DRAFT,
      index: true,
    },
    isPublic: {
      type: Boolean,
      default: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      index: true,
    },

    // Matching & Assignment
    interestedProviders: [
      {
        type: Schema.Types.ObjectId,
        ref: "ProviderProfile",
      },
    ],
    invitedProviders: [
      {
        type: Schema.Types.ObjectId,
        ref: "ProviderProfile",
      },
    ],
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
    matchScore: {
      type: Number,
      min: 0,
      max: 100,
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
taskSchema.index({ title: "text", description: "text", tags: "text" });
taskSchema.index({ categoryId: 1, status: 1, isDeleted: 1 });
taskSchema.index({ customerId: 1, status: 1, isDeleted: 1 });
taskSchema.index({ status: 1, isPublic: 1, expiresAt: 1, isDeleted: 1 });
taskSchema.index({ "taskLocation.region": 1, "taskLocation.city": 1 });
taskSchema.index({ "taskLocation.gpsCoordinates": "2dsphere" }); // Geospatial index
taskSchema.index({ assignedProviderId: 1, status: 1 });
taskSchema.index({ createdAt: -1, status: 1 });
taskSchema.index({ "budget.minAmount": 1, "budget.maxAmount": 1 });

/**
 * Pre-save middleware for validation
 */
taskSchema.pre("save", async function () {
  // Validate budget based on type
  if (this.budget.type === BudgetType.FIXED && !this.budget.amount) {
    throw new Error("Fixed budget requires an amount");
  }

  if (
    this.budget.type === BudgetType.RANGE &&
    (!this.budget.minAmount || !this.budget.maxAmount)
  ) {
    throw new Error("Range budget requires min and max amounts");
  }

  if (
    this.budget.type === BudgetType.RANGE &&
    this.budget.minAmount! > this.budget.maxAmount!
  ) {
    throw new Error("Min amount cannot be greater than max amount");
  }

  if (this.budget.type === BudgetType.HOURLY && !this.budget.hourlyRate) {
    throw new Error("Hourly budget requires an hourly rate");
  }

  // Auto-set expiration if not set (default: 30 days)
  if (!this.expiresAt && this.status === TaskStatus.OPEN) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    this.expiresAt = expiryDate;
  }

  // Validate schedule dates
  if (
    this.schedule.preferredStartDate &&
    this.schedule.preferredEndDate &&
    this.schedule.preferredStartDate > this.schedule.preferredEndDate
  ) {
    throw new Error("Start date cannot be after end date");
  }

  // Set status to OPEN if publishing from DRAFT
  if (
    this.isModified("status") &&
    this.status === TaskStatus.OPEN &&
    !this.isNew
  ) {
    this.isPublic = true;
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

taskSchema.methods.assignToProvider = function (
  this: HydratedDocument<Task, TaskMethods>,
  providerId: any
) {
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

taskSchema.methods.inviteProvider = function (
  this: HydratedDocument<Task, TaskMethods>,
  providerId: any
) {
  if (!this.invitedProviders) {
    this.invitedProviders = [];
  }
  if (!this.invitedProviders.includes(providerId)) {
    this.invitedProviders.push(providerId);
  }
  return this.save();
};

taskSchema.methods.calculateMatchScore = function (
  this: HydratedDocument<Task, TaskMethods>,
  provider: any
) {
  let score = 0;

  // Category match (30 points)
  if (provider.serviceOfferings) {
    const hasMatchingService = provider.serviceOfferings.some(
      (service: any) =>
        service.categoryId?.toString() === this.categoryId.toString()
    );
    if (hasMatchingService) score += 30;
  }

  // Location proximity (25 points)
  if (
    !this.isRemoteTask &&
    provider.locationData?.region === this.taskLocation.region
  ) {
    score += 15;
    if (provider.locationData?.city === this.taskLocation.city) {
      score += 10;
    }
  } else if (this.isRemoteTask) {
    score += 25; // Remote tasks don't require location match
  }

  // Skills match (20 points)
  if (this.requirements.skillsNeeded.length > 0 && provider.serviceOfferings) {
    const providerSkills = provider.serviceOfferings.flatMap(
      (service: any) => service.tags || []
    );
    const matchingSkills = this.requirements.skillsNeeded.filter((skill) =>
      providerSkills.includes(skill)
    );
    const skillMatchPercentage =
      matchingSkills.length / this.requirements.skillsNeeded.length;
    score += Math.round(skillMatchPercentage * 20);
  }

  // Availability match (15 points)
  if (provider.isAlwaysAvailable) {
    score += 15;
  } else if (provider.workingHours && this.schedule.specificTimeSlots) {
    // Basic availability check - can be enhanced
    score += 10;
  }

  // Budget compatibility (10 points)
  // This would require checking provider's typical pricing
  score += 10;

  return Math.min(score, 100);
};

/**
 * Static Methods
 */
taskSchema.statics.findActive = function () {
  return this.find({ isDeleted: { $ne: true } });
};

taskSchema.statics.findByCustomer = function (customerId: string) {
  return this.find({
    customerId,
    isDeleted: { $ne: true },
  }).sort({ createdAt: -1 });
};

taskSchema.statics.findByCategory = function (categoryId: string) {
  return this.find({
    categoryId,
    status: TaskStatus.OPEN,
    isPublic: true,
    isDeleted: { $ne: true },
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
};

taskSchema.statics.findByLocation = function (
  location: UserLocation,
  maxDistance?: number
) {
  const query: any = {
    status: TaskStatus.OPEN,
    isPublic: true,
    isDeleted: { $ne: true },
    expiresAt: { $gt: new Date() },
  };

  // Location-based filtering
  if (location.region) {
    query["taskLocation.region"] = location.region;
    if (location.city) {
      query["taskLocation.city"] = location.city;
    }
  }

  return this.find(query).sort({ createdAt: -1 });
};

taskSchema.statics.findOpenTasks = function () {
  return this.find({
    status: TaskStatus.OPEN,
    isPublic: true,
    isDeleted: { $ne: true },
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
};

taskSchema.statics.findMatchingTasks = function (providerId: string) {
  return this.find({
    $or: [
      { interestedProviders: providerId },
      { invitedProviders: providerId },
      { assignedProviderId: providerId },
    ],
    isDeleted: { $ne: true },
  }).sort({ createdAt: -1 });
};

taskSchema.statics.searchTasks = function (
  searchTerm: string,
  filters?: {
    categoryId?: string;
    minBudget?: number;
    maxBudget?: number;
    location?: UserLocation;
    status?: TaskStatus;
  }
) {
  const query: any = {
    $text: { $search: searchTerm },
    isDeleted: { $ne: true },
  };

  if (filters?.categoryId) {
    query.categoryId = filters.categoryId;
  }

  if (filters?.status) {
    query.status = filters.status;
  } else {
    query.status = TaskStatus.OPEN;
    query.isPublic = true;
    query.expiresAt = { $gt: new Date() };
  }

  if (filters?.minBudget || filters?.maxBudget) {
    query.$or = [];

    if (filters.minBudget) {
      query.$or.push({
        "budget.amount": { $gte: filters.minBudget },
        "budget.minAmount": { $gte: filters.minBudget },
      });
    }

    if (filters.maxBudget) {
      query.$or.push({
        "budget.amount": { $lte: filters.maxBudget },
        "budget.maxAmount": { $lte: filters.maxBudget },
      });
    }
  }

  if (filters?.location?.region) {
    query["taskLocation.region"] = filters.location.region;
    if (filters.location.city) {
      query["taskLocation.city"] = filters.location.city;
    }
  }

  return this.find(query).sort({ score: { $meta: "textScore" }, createdAt: -1 });
};

/**
 * Virtuals
 */
taskSchema.virtual("isExpired").get(function () {
  return this.expiresAt ? this.expiresAt < new Date() : false;
});

taskSchema.virtual("isActive").get(function () {
  return (
    this.status === TaskStatus.OPEN &&
    !this.isDeleted &&
    (!this.expiresAt || this.expiresAt > new Date())
  );
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

taskSchema.virtual("interestCount").get(function () {
  return this.interestedProviders?.length || 0;
});

/**
 * Export the model
 */
export const TaskModel = model<Task, ITaskModel>("Task", taskSchema);