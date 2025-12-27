// types/task.types.ts
import { Types, HydratedDocument, Model } from "mongoose";
import { BaseEntity, SoftDeletable } from "./base.types";
import { Service } from "./service.types";
import { ProviderProfile } from "./profiles/providerProfile.types";

/**
 * Task Priority Levels (Urgency)
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
  OPEN = "open", // Has matches - client selecting provider
  FLOATING = "floating", // No matches - visible to all providers
  REQUESTED = "requested", // Client requested a specific provider
  ASSIGNED = "assigned", // Provider accepted the request
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

/**
 * Task Location (Simplified)
 * - Client's locality (where they are)
 * - Provider's locality (where they want provider to be from)
 * - Client's GPS address
 */
export interface TaskLocation {
  // Client's location
  clientLocality: string; // e.g., "Dansoman", "Osu"
  clientGPSAddress: string; // Ghana Post GPS

  // Where provider should be from
  providerLocality: string; // e.g., "Accra", "Tema"
}

/**
 * Task Schedule (Simplified)
 */
export interface TaskSchedule {
  urgency: TaskPriority;
  preferredDate?: Date;
  timeSlot?: {
    startTime: string; // e.g., "09:00"
    endTime: string; // e.g., "17:00"
  };
}

/**
 * Main Task Interface
 */
export interface Task extends BaseEntity, SoftDeletable {
  // Basic Information
  title: string;

  // Customer Information
  customerId: Types.ObjectId;

  // Location
  location: TaskLocation;

  // Scheduling
  schedule: TaskSchedule;

  // Status & Visibility
  status: TaskStatus;
  expiresAt?: Date;

  // Matching Results
  matchedProviders?: Types.ObjectId[]; // Auto-matched providers on creation
  hasMatches: boolean; // True if system found matching services

  // Provider Interest (for floating tasks with no matches)
  interestedProviders?: Types.ObjectId[]; // Providers who contacted client for floating tasks

  // Assignment
  requestedProviderId?: Types.ObjectId; // Provider client requested
  requestedAt?: Date;
  assignedProviderId?: Types.ObjectId; // Final assigned provider (after provider accepts)
  assignedAt?: Date;

  // Task Completion
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;

  // Metadata
  viewCount: number;
}

/**
 * Provider Match Result
 */
export interface ProviderMatch {
  provider: ProviderProfile | Types.ObjectId;
  matchScore: number; // 0-100
  matchReasons: string[];
  distance?: number; // Distance from task location in km
  availability: boolean;
  relevantServices: Service[];
  providerRating?: number;
  completedTasksCount?: number;
  responseTime?: number;
}

/**
 * Task Matching Criteria
 */
export interface TaskMatchingCriteria {
  taskId: Types.ObjectId;
  location: TaskLocation;
  schedule: TaskSchedule;
  preferredProviderIds?: Types.ObjectId[];
}

/**
 * Matching Result
 */
export interface TaskMatchingResult {
  task: Task;
  matches: ProviderMatch[];
  totalMatches: number;
  executedAt: Date;
}

/**
 * Provider Interest in Task
 */
export interface TaskInterest extends BaseEntity {
  taskId: Types.ObjectId;
  providerId: Types.ObjectId;
  message?: string;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  respondedAt?: Date;
}

/**
 * Instance Methods Interface
 */
export interface TaskMethods {
  softDelete(deletedBy?: Types.ObjectId): Promise<this>;
  restore(): Promise<this>;
  requestProvider(providerId: Types.ObjectId): Promise<this>; // Client requests a provider
  acceptRequest(providerId: Types.ObjectId): Promise<this>; // Provider accepts client's request
  markAsCompleted(): Promise<this>;
  cancel(reason?: string): Promise<this>;
  addInterestedProvider(providerId: Types.ObjectId): Promise<this>; // For floating tasks
  removeInterestedProvider(providerId: Types.ObjectId): Promise<this>;
  findMatchingProviders(): Promise<ProviderMatch[]>; // Auto-match on creation
  calculateMatchScore(provider: any, relevantServices?: any[]): number; // Helper for scoring
  getMatchReasons(provider: any, services: any[]): string[]; // Helper for match reasons
}

/**
 * Virtuals Interface
 */
export interface TaskVirtuals {
  isExpired: boolean;
  isActive: boolean;
  isFloating: boolean; // Task has no matches
  hasAssignedProvider: boolean;
  daysUntilExpiry: number;
  matchCount: number; // Number of matched providers
  interestCount: number; // Number of providers who contacted for floating tasks
}

/**
 * Static Methods Interface
 */
export interface ITaskModel extends Model<Task, {}, TaskMethods, TaskVirtuals> {
  findActive(): Promise<TaskDocument[]>;
  findByCustomer(customerId: string): Promise<TaskDocument[]>;
  findFloatingTasks(): Promise<TaskDocument[]>; // Tasks with no matches, visible to all
  findTasksWithMatches(): Promise<TaskDocument[]>; // Tasks with matched providers
  findByProviderInMatches(providerId: string): Promise<TaskDocument[]>; // Tasks where provider was matched
  searchTasks(searchTerm: string): Promise<TaskDocument[]>;
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
  location: TaskLocation;
  schedule: TaskSchedule;
}

/**
 * Request Body: Update Task
 */
export interface UpdateTaskRequestBody {
  title?: string;
  location?: TaskLocation;
  schedule?: TaskSchedule;
  status?: TaskStatus;
}

/**
 * Request Body: Express Interest in Floating Task
 */
export interface ExpressInterestRequestBody {
  taskId: string;
  message?: string; // Provider's message to client
}

/**
 * Request Body: Client Requests a Provider
 */
export interface RequestProviderRequestBody {
  taskId: string;
  providerId: string; // From matched list or from interested providers
  message?: string;
}

/**
 * Request Body: Task Matching Query
 */
export interface TaskMatchingRequestBody {
  taskId: string;
  maxResults?: number;
  minMatchScore?: number;
  sortBy?: "matchScore" | "distance" | "rating";
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
