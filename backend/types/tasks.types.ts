// types/task.types.ts
import { Types, HydratedDocument, Model } from "mongoose";
import { BaseEntity, SoftDeletable, UserLocation } from "./base.types";
import { Service } from "./service.types";
import { ProviderProfile } from "./providerProfile.types";

/**
 * Task Priority Levels
 */
export enum TaskPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

/**
 * Task Status
 */
export enum TaskStatus {
  DRAFT = "draft",
  OPEN = "open",
  ASSIGNED = "assigned",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

/**
 * Budget Type
 */
export enum BudgetType {
  FIXED = "fixed",
  HOURLY = "hourly",
  RANGE = "range",
  NEGOTIABLE = "negotiable",
}

/**
 * Task Scheduling Preferences
 */
export interface TaskSchedule {
  preferredStartDate?: Date;
  preferredEndDate?: Date;
  isFlexible: boolean;
  urgency: TaskPriority;
  estimatedDuration?: number; // in hours
  specificTimeSlots?: {
    date: Date;
    startTime: string; // e.g., "09:00"
    endTime: string; // e.g., "17:00"
  }[];
}

/**
 * Budget Details
 */
export interface TaskBudget {
  type: BudgetType;
  amount?: number; // for fixed
  minAmount?: number; // for range
  maxAmount?: number; // for range
  hourlyRate?: number; // for hourly
  currency: string; // 'GHS' or 'USD'
  includesMaterials: boolean;
  additionalCosts?: {
    description: string;
    amount: number;
  }[];
}

/**
 * Task Requirements
 */
export interface TaskRequirements {
  skillsNeeded: string[];
  experienceLevel?: "beginner" | "intermediate" | "expert" | "any";
  certificationRequired: boolean;
  specificTools?: string[];
  languagePreference?: string[];
  minRating?: number; // minimum provider rating (1-5)
}

/**
 * Task Media
 */
export interface TaskMedia {
  images?: Types.ObjectId[]; // Reference to File model
  documents?: Types.ObjectId[]; // Reference to File model
  videos?: Types.ObjectId[];
}

/**
 * Main Task Interface
 */
export interface Task extends BaseEntity, SoftDeletable {
  // Basic Information
  title: string;
  description: string;
  categoryId: Types.ObjectId; // Link to Category
  relatedServices?: Types.ObjectId[]; // Optional: suggested services
  tags: string[];

  // Customer Information
  customerId: Types.ObjectId; // User who posted the task
  customerProfileId?: Types.ObjectId; // Optional: customer profile reference

  // Location
  taskLocation: UserLocation;
  isRemoteTask: boolean; // Can be done remotely
  maxTravelDistance?: number; // in kilometers

  // Budget & Pricing
  budget: TaskBudget;

  // Scheduling
  schedule: TaskSchedule;

  // Requirements
  requirements: TaskRequirements;

  // Media
  media?: TaskMedia;

  // Status & Visibility
  status: TaskStatus;
  isPublic: boolean; // Public tasks visible to all, private only to invited
  expiresAt?: Date; // When task auto-expires if not assigned

  // Matching & Assignment
  interestedProviders?: Types.ObjectId[]; // Providers who expressed interest
  invitedProviders?: Types.ObjectId[]; // Providers invited by customer
  assignedProviderId?: Types.ObjectId; // Final assigned provider
  assignedAt?: Date;

  // Task Completion
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;

  // Metadata
  viewCount: number;
  matchScore?: number; // Internal matching algorithm score
}

/**
 * Provider Match Result
 */
export interface ProviderMatch {
  provider: ProviderProfile | Types.ObjectId;
  matchScore: number; // 0-100
  matchReasons: string[]; // Why this provider matches
  distance?: number; // Distance from task location in km
  estimatedCost?: number; // Provider's estimated cost
  availability: boolean;
  relevantServices: Service[]; // Services that match the task
  providerRating?: number;
  completedTasksCount?: number;
  responseTime?: number; // Average response time in hours
}

/**
 * Task Matching Criteria
 */
export interface TaskMatchingCriteria {
  taskId: Types.ObjectId;
  categoryId: Types.ObjectId;
  location: UserLocation;
  maxDistance?: number;
  budget: TaskBudget;
  requirements: TaskRequirements;
  schedule: TaskSchedule;
  preferredProviderIds?: Types.ObjectId[]; // Providers customer has worked with before
}

/**
 * Matching Result
 */
export interface TaskMatchingResult {
  task: Task;
  matches: ProviderMatch[];
  totalMatches: number;
  searchRadius: number; // in km
  executedAt: Date;
}

/**
 * Provider Interest in Task
 */
export interface TaskInterest extends BaseEntity {
  taskId: Types.ObjectId;
  providerId: Types.ObjectId;
  message?: string; // Provider's pitch/message to customer
  proposedBudget?: number;
  proposedSchedule?: {
    startDate: Date;
    endDate: Date;
  };
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  respondedAt?: Date;
}

/**
 * Task Notification Preferences
 */
export interface TaskNotificationPreferences {
  notifyOnNewMatch: boolean;
  notifyOnProviderInterest: boolean;
  notifyOnStatusChange: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
}

/**
 * Instance Methods Interface
 */
export interface TaskMethods {
  softDelete(deletedBy?: Types.ObjectId): Promise<this>;
  restore(): Promise<this>;
  assignToProvider(providerId: Types.ObjectId): Promise<this>;
  markAsCompleted(): Promise<this>;
  cancel(reason?: string): Promise<this>;
  addInterestedProvider(providerId: Types.ObjectId): Promise<this>;
  removeInterestedProvider(providerId: Types.ObjectId): Promise<this>;
  inviteProvider(providerId: Types.ObjectId): Promise<this>;
  calculateMatchScore(provider: ProviderProfile): number;
}

/**
 * Virtuals Interface
 */
export interface TaskVirtuals {
  isExpired: boolean;
  isActive: boolean;
  hasAssignedProvider: boolean;
  daysUntilExpiry: number;
  interestCount: number;
}

/**
 * Static Methods Interface
 */
export interface ITaskModel extends Model<Task, {}, TaskMethods, TaskVirtuals> {
  findActive(): Promise<TaskDocument[]>;
  findByCustomer(customerId: string): Promise<TaskDocument[]>;
  findByCategory(categoryId: string): Promise<TaskDocument[]>;
  findByLocation(
    location: UserLocation,
    maxDistance?: number
  ): Promise<TaskDocument[]>;
  findOpenTasks(): Promise<TaskDocument[]>;
  findMatchingTasks(providerId: string): Promise<TaskDocument[]>;
  searchTasks(
    searchTerm: string,
    filters?: {
      categoryId?: string;
      minBudget?: number;
      maxBudget?: number;
      location?: UserLocation;
      status?: TaskStatus;
    }
  ): Promise<TaskDocument[]>;
}

/**
 * Complete Task Document Type
 */
export type TaskDocument = HydratedDocument<Task, ITaskModel & TaskVirtuals>;

/**
 * Request Body: Create Task
 */
export interface CreateTaskRequestBody {
  title: string;
  description: string;
  categoryId: string;
  relatedServices?: string[];
  tags?: string[];
  taskLocation: UserLocation;
  isRemoteTask: boolean;
  maxTravelDistance?: number;
  budget: TaskBudget;
  schedule: TaskSchedule;
  requirements: TaskRequirements;
  isPublic: boolean;
  expiresAt?: Date;
}

/**
 * Request Body: Update Task
 */
export interface UpdateTaskRequestBody
  extends Partial<Omit<CreateTaskRequestBody, "categoryId" | "customerId">> {
  status?: TaskStatus;
}

/**
 * Request Body: Express Interest in Task
 */
export interface ExpressInterestRequestBody {
  taskId: string;
  message?: string;
  proposedBudget?: number;
  proposedSchedule?: {
    startDate: Date;
    endDate: Date;
  };
}

/**
 * Request Body: Invite Provider to Task
 */
export interface InviteProviderRequestBody {
  taskId: string;
  providerId: string;
  message?: string;
}

/**
 * Request Body: Task Matching Query
 */
export interface TaskMatchingRequestBody {
  taskId: string;
  maxResults?: number;
  minMatchScore?: number;
  maxDistance?: number;
  sortBy?: "matchScore" | "distance" | "rating" | "price";
}

/**
 * Response: Task with Matches
 */
export interface TaskWithMatchesResponse {
  message: string;
  task?: Partial<Task>;
  matches?: ProviderMatch[];
  totalMatches?: number;
  error?: string;
}

/**
 * Response: Standard Task Response
 */
export interface TaskResponse {
  message: string;
  task?: Partial<Task>;
  error?: string;
}

/**
 * Response: Task List Response
 */
export interface TaskListResponse {
  message: string;
  tasks?: Partial<Task>[];
  total?: number;
  page?: number;
  limit?: number;
  error?: string;
}