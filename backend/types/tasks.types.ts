// types/task.types.ts
import { Types, HydratedDocument, Model } from "mongoose";
import {
  BaseEntity,
  SoftDeletable,
  UserLocation,
  UserRole,
} from "./base.types";

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
 * Task Status - Simplified workflow
 */
export enum TaskStatus {
  PENDING = "pending", // Just posted, system searching for matches
  MATCHED = "matched", // Has matched providers - client can select
  FLOATING = "floating", // No matches found - visible to all providers
  REQUESTED = "requested", // Client selected and requested a provider
  ACCEPTED = "accepted", // Provider accepted the request
  IN_PROGRESS = "in_progress", // Work started
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

/**
 * Task Schedule
 */
export interface TaskSchedule {
  priority: TaskPriority;
  preferredDate?: Date;
  flexibleDates?: boolean; // Can the date be adjusted?
  timeSlot?: {
    start: string; // e.g., "09:00"
    end: string; // e.g., "17:00"
  };
}

/**
 * Main Task Interface
 */
export interface Task extends BaseEntity, SoftDeletable {
  // Basic Information
  title: string;
  description: string; // Detailed description of what they need
  category?: Types.ObjectId; // Optional: helps narrow matching (e.g., "Home Services", "Repairs")
  tags?: string[]; // Keywords like ["plumbing", "leak", "urgent"]

  // Customer Information
  customerId: Types.ObjectId;
  customerLocation: UserLocation; // Where the service is needed

  // Scheduling
  schedule: TaskSchedule;

  // Budget (optional - helps providers decide)
  estimatedBudget?: {
    min?: number;
    max?: number;
    currency: string; // 'GHS' or 'USD'
  };

  // Status & Flow
  status: TaskStatus;
  expiresAt?: Date; // Auto-expire after X days

  // Matching Phase (MATCHED status)
  matchedProviders?: {
    providerId: Types.ObjectId;
    matchScore: number; // 0-100 based on relevance
    matchedServices: Types.ObjectId[]; // Which of their services matched
    matchReasons: string[]; // e.g., ["Location match", "Service title match", "Tag match"]
    distance?: number; // Distance in km from customer location
  }[];

  // Matching metadata
  matchingAttemptedAt?: Date;
  matchingCriteria?: {
    useLocationOnly: boolean; // If true, matched all providers in location
    searchTerms: string[]; // Keywords extracted from title/description
    categoryMatch: boolean; // Did we use category for matching?
  };

  // Floating Phase (FLOATING status - no matches found)
  interestedProviders?: {
    providerId: Types.ObjectId;
    expressedAt: Date;
    message?: string;
  }[];

  // Request Phase (REQUESTED status)
  requestedProvider?: {
    providerId: Types.ObjectId;
    requestedAt: Date;
    clientMessage?: string;
  };

  // Acceptance Phase (ACCEPTED status onwards)
  assignedProvider?: {
    providerId: Types.ObjectId;
    acceptedAt: Date;
    providerMessage?: string;
  };

  // Completion
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  cancelledBy?: UserRole.CUSTOMER | UserRole.PROVIDER;

  // Metadata
  viewCount: number;
}

/**
 * Provider Interest (for floating tasks)
 */
export interface ProviderInterest {
  providerId: Types.ObjectId;
  expressedAt: Date;
  message?: string;
}

/**
 * Task Matching Configuration
 * Defines how the system matches tasks to providers
 */
export interface TaskMatchingConfig {
  // Location matching
  maxDistanceKm?: number; // Max distance for location-based matching (default: 20km)
  prioritizeNearby?: boolean; // Give higher scores to closer providers

  // Intelligent matching weights (when using "intelligent" strategy)
  weights?: {
    titleMatch: number; // e.g., 30 - matching task title to service title
    descriptionMatch: number; // e.g., 25 - matching description keywords
    tagMatch: number; // e.g., 25 - matching tags
    categoryMatch: number; // e.g., 15 - matching category
    locationProximity: number; // e.g., 5 - distance factor
  };

  // Matching thresholds
  minimumMatchScore?: number; // Minimum score to include provider (default: 40)
  maxProvidersToReturn?: number; // Max number of matches to return (default: 20)

  // Fallback behavior
  fallbackToLocationOnly?: boolean; // If intelligent matching finds < X matches, use location-only
  fallbackThreshold?: number; // Number of matches before fallback (default: 3)
}

/**
 * Matching result for a single provider
 */
export interface ProviderMatchResult {
  providerId: Types.ObjectId;
  matchScore: number; // 0-100
  matchedServices: Types.ObjectId[]; // Which services matched
  matchReasons: string[]; // Human-readable reasons
  distance?: number; // Distance in km
  scoreBreakdown?: {
    titleScore: number;
    descriptionScore: number;
    tagScore: number;
    categoryScore: number;
    locationScore: number;
  };
}

/**
 * Matching result for a single provider
 */
export interface ProviderMatchResult {
  providerId: Types.ObjectId;
  matchScore: number; // 0-100
  matchedServices: Types.ObjectId[]; // Which services matched
  matchReasons: string[]; // Human-readable reasons
  distance?: number; // Distance in km
  scoreBreakdown?: {
    titleScore: number;
    descriptionScore: number;
    tagScore: number;
    categoryScore: number;
    locationScore: number;
  };
}

/**
 * Instance Methods Interface
 */
export interface TaskMethods {
  softDelete(deletedBy?: Types.ObjectId): Promise<this>;
  restore(): Promise<this>;

  // Matching workflow
  findMatches(strategy?: "intelligent" | "location-only"): Promise<this>;
  // - "intelligent": Match based on service descriptions, titles, tags, category
  // - "location-only": Show all providers in customer's location
  makeFloating(): Promise<this>; // Convert to floating if no matches

  // Scoring helpers
  calculateIntelligentMatchScore(
    provider: any,
    relevantServices: any[]
  ): ProviderMatchResult;
  calculateLocationMatchScore(provider: any): ProviderMatchResult;
  buildMatchReasons(provider: any, services: any[], scores: any): string[];

  // Provider interest (floating tasks only)
  addProviderInterest(
    providerId: Types.ObjectId,
    message?: string
  ): Promise<this>;
  removeProviderInterest(providerId: Types.ObjectId): Promise<this>;

  // Client requests provider
  requestProvider(providerId: Types.ObjectId, message?: string): Promise<this>;

  // Provider accepts request
  acceptTask(providerId: Types.ObjectId, message?: string): Promise<this>;

  // Provider rejects request
  rejectTask(providerId: Types.ObjectId, reason?: string): Promise<this>;

  // Task progression
  startTask(): Promise<this>; // Mark as in progress
  completeTask(): Promise<this>;
  cancelTask(
    reason?: string,
    cancelledBy?: UserRole.CUSTOMER | UserRole.PROVIDER
  ): Promise<this>;
}

/**
 * Virtuals Interface
 */
export interface TaskVirtuals {
  isExpired: boolean;
  isActive: boolean;
  hasMatches: boolean; // Has matched providers
  isFloating: boolean; // No matches, open to all
  isAssigned: boolean; // Has assigned provider
  matchCount: number;
  interestCount: number;
  daysUntilExpiry: number;
}

/**
 * Static Methods Interface
 */
export interface TaskModel extends Model<Task, {}, TaskMethods, TaskVirtuals> {
  findActive(): Promise<TaskDocument[]>;
  findByCustomer(customerId: string): Promise<TaskDocument[]>;
  findByService(serviceId: string): Promise<TaskDocument[]>;

  // For providers to see
  findFloatingTasks(): Promise<TaskDocument[]>; // All floating tasks
  findMatchedForProvider(providerId: string): Promise<TaskDocument[]>; // Tasks where they're matched
  findByAssignedProvider(providerId: string): Promise<TaskDocument[]>; // Their active tasks

  // Search & filter
  searchTasks(
    searchTerm: string,
    filters?: {
      status?: TaskStatus;
      serviceId?: string;
      location?: string;
    }
  ): Promise<TaskDocument[]>;
}

/**
 * Complete Task Document Type
 */
export type TaskDocument = HydratedDocument<Task, TaskMethods & TaskVirtuals>;

/**
 * Request Body: Create Task (Customer posts a task)
 */
export interface CreateTaskRequestBody {
  title: string;
  description: string; // What they need done
  category?: string; // Optional category to help matching
  tags?: string[]; // Keywords
  customerLocation: UserLocation; // Where service is needed
  schedule: TaskSchedule;
  estimatedBudget?: {
    min?: number;
    max?: number;
    currency: string;
  };
  matchingStrategy?: "intelligent" | "location-only"; // How to find providers
}

/**
 * Request Body: Update Task
 */
export interface UpdateTaskRequestBody {
  title?: string;
  description?: string;
  customerLocation?: UserLocation;
  schedule?: TaskSchedule;
}

/**
 * Request Body: Express Interest (Provider for floating task)
 */
export interface ExpressInterestRequestBody {
  taskId: string;
  message?: string;
}

/**
 * Request Body: Request Provider (Customer selects provider)
 */
export interface RequestProviderRequestBody {
  taskId: string;
  providerId: string; // From matched list or interested providers
  message?: string;
}

/**
 * Request Body: Accept/Reject Task (Provider response)
 */
export interface ProviderResponseRequestBody {
  taskId: string;
  action: "accept" | "reject";
  message?: string; // Optional message to customer
}

/**
 * Response: Task with matched/interested providers
 */
export interface TaskWithProvidersResponse {
  message: string;
  task?: Partial<Task>;
  matchedProviders?: {
    providerId: Types.ObjectId;
    matchScore: number;
    matchedServices: Types.ObjectId[];
    matchReasons: string[];
    distance?: number;
  }[];
  interestedProviders?: ProviderInterest[];
  matchingSummary?: {
    strategy: "intelligent" | "location-only";
    totalMatches: number;
    averageMatchScore?: number;
    searchTermsUsed?: string[];
  };
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
 * Response: Task List
 */
export interface TaskListResponse {
  message: string;
  tasks?: Partial<Task>[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  error?: string;
}

/**
 * Notification payload for task updates
 */
export interface TaskNotification {
  taskId: Types.ObjectId;
  recipientId: Types.ObjectId;
  type:
    | "task_matched" // Task found matches
    | "task_floating" // Task has no matches
    | "provider_interested" // Provider expressed interest
    | "task_requested" // Customer requested you
    | "task_accepted" // Provider accepted
    | "task_rejected" // Provider rejected
    | "task_started" // Work started
    | "task_completed" // Task completed
    | "task_cancelled"; // Task cancelled
  message: string;
  data?: Record<string, any>;
}
