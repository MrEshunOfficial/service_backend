// types/tasks.types.ts - COMPLETE WITH API TYPES

import { Types, Model, HydratedDocument } from "mongoose";
import { UserLocation } from "./base.types";

/**
 * Task Priority Levels
 */
export enum TaskPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

/**
 * Task Status - DISCOVERY PHASE ONLY
 */
export enum TaskStatus {
  PENDING = "PENDING", // Just created, awaiting matching
  MATCHED = "MATCHED", // Providers matched by system
  FLOATING = "FLOATING", // Open to all providers
  REQUESTED = "REQUESTED", // Customer selected a provider
  ACCEPTED = "ACCEPTED", // Provider accepted (temp state before conversion)
  CONVERTED = "CONVERTED", // ✅ NEW: Converted to booking
  EXPIRED = "EXPIRED", // Task expired
  CANCELLED = "CANCELLED", // Cancelled during discovery
}

/**
 * Provider Match Result
 */
export interface ProviderMatchResult {
  providerId: Types.ObjectId;
  matchScore: number;
  matchedServices: Types.ObjectId[];
  matchReasons: string[];
  distance?: number;
  scoreBreakdown?: {
    titleScore: number;
    descriptionScore: number;
    tagScore: number;
    categoryScore: number;
    locationScore: number;
  };
}

/**
 * Task Matching Configuration
 */
export interface TaskMatchingConfig {
  maxDistanceKm: number;
  prioritizeNearby: boolean;
  weights: {
    titleMatch: number;
    descriptionMatch: number;
    tagMatch: number;
    categoryMatch: number;
    locationProximity: number;
  };
  minimumMatchScore: number;
  maxProvidersToReturn: number;
  fallbackToLocationOnly: boolean;
  fallbackThreshold?: number;
}

/**
 * Task Interface (Model)
 */
export interface Task {
  _id: Types.ObjectId;
  title: string;
  description: string;
  category?: Types.ObjectId;
  tags?: string[];
  customerId: Types.ObjectId;
  customerLocation: UserLocation;
  schedule: {
    priority: TaskPriority;
    preferredDate?: Date;
    flexibleDates?: boolean;
    timeSlot?: {
      start: string;
      end?: string;
    };
  };
  estimatedBudget?: {
    min?: number;
    max?: number;
    currency: string;
  };
  status: TaskStatus;
  expiresAt?: Date;
  matchedProviders?: Array<{
    providerId: Types.ObjectId;
    matchScore: number;
    matchedServices: Types.ObjectId[];
    matchReasons: string[];
    distance?: number;
  }>;
  matchingAttemptedAt?: Date;
  matchingCriteria?: {
    useLocationOnly: boolean;
    searchTerms: string[];
    categoryMatch: boolean;
  };
  interestedProviders?: Array<{
    providerId: Types.ObjectId;
    expressedAt: Date;
    message?: string;
  }>;
  requestedProvider?: {
    providerId: Types.ObjectId;
    requestedAt: Date;
    clientMessage?: string;
  };
  acceptedProvider?: {
    providerId: Types.ObjectId;
    acceptedAt: Date;
    providerMessage?: string;
  };
  convertedToBookingId?: Types.ObjectId;
  convertedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  cancelledBy?: string;
  viewCount: number;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Task Instance Methods
 */
export interface TaskMethods {
  softDelete(
    deletedBy?: Types.ObjectId
  ): Promise<HydratedDocument<Task, TaskMethods>>;
  restore(): Promise<HydratedDocument<Task, TaskMethods>>;
  findMatches(
    strategy?: "intelligent" | "location-only"
  ): Promise<HydratedDocument<Task, TaskMethods>>;
  calculateIntelligentMatchScore(
    provider: any,
    services: any[]
  ): ProviderMatchResult;
  calculateLocationMatchScore(provider: any): ProviderMatchResult;
  buildMatchReasons(provider: any, services: any[], scores: any): string[];
  makeFloating(): Promise<HydratedDocument<Task, TaskMethods>>;
  addProviderInterest(
    providerId: Types.ObjectId,
    message?: string
  ): Promise<HydratedDocument<Task, TaskMethods>>;
  removeProviderInterest(
    providerId: Types.ObjectId
  ): Promise<HydratedDocument<Task, TaskMethods>>;
  requestProvider(
    providerId: Types.ObjectId,
    message?: string
  ): Promise<HydratedDocument<Task, TaskMethods>>;
  acceptTask(providerId: Types.ObjectId, message?: string): Promise<any>;
  rejectTask(
    providerId: Types.ObjectId,
    reason?: string
  ): Promise<HydratedDocument<Task, TaskMethods>>;
  cancelTask(
    reason?: string,
    cancelledBy?: string
  ): Promise<HydratedDocument<Task, TaskMethods>>;
}

/**
 * Task Static Methods
 */
export interface TaskModel extends Model<Task, {}, TaskMethods> {
  findActive(): any;
  findByCustomer(customerId: string): any;
  findByService(serviceId: string): any;
  findFloatingTasks(): any;
  findMatchedForProvider(providerId: string): any;
  findConverted(filters?: any): any;
  searchTasks(searchTerm: string, filters?: any): any;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES (Service Layer)
// ============================================================================

/**
 * Create Task Request Body
 */
export interface CreateTaskRequestBody {
  title: string;
  description: string;
  category?: Types.ObjectId | string;
  tags?: string[];
  customerLocation: UserLocation;
  schedule: {
    priority: TaskPriority;
    preferredDate?: Date;
    flexibleDates?: boolean;
    timeSlot?: {
      start: string;
      end: string;
    };
  };
  estimatedBudget?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  matchingStrategy?: "intelligent" | "location-only";
}

/**
 * Update Task Request Body
 */
export interface UpdateTaskRequestBody {
  title?: string;
  description?: string;
  customerLocation?: UserLocation;
  schedule?: Partial<{
    priority: TaskPriority;
    preferredDate?: Date;
    flexibleDates?: boolean;
    timeSlot?: {
      start: string;
      end: string;
    };
  }>;
  estimatedBudget?: {
    min?: number;
    max?: number;
    currency?: string;
  };
}

/**
 * Express Interest Request Body
 */
export interface ExpressInterestRequestBody {
  taskId: string;
  message?: string;
}

/**
 * Request Provider Request Body
 */
export interface RequestProviderRequestBody {
  taskId: string;
  providerId: string;
  message?: string;
}

/**
 * Provider Response Request Body
 */
export interface ProviderResponseRequestBody {
  taskId: string;
  action: "accept" | "reject";
  message?: string;
}

/**
 * Matching Summary
 */
export interface MatchingSummary {
  strategy: "intelligent" | "location-only";
  totalMatches: number;
  averageMatchScore: number;
  searchTermsUsed: string[];
}

/**
 * Task Response (Single Task)
 */
export interface TaskResponse {
  message: string;
  task?: Task;
  booking?: any; // Can include booking if task was accepted
  error?: string;
}

/**
 * Task List Response
 */
export interface TaskListResponse {
  message: string;
  tasks?: Task[] | Partial<Task>[];
  error?: string;
}

/**
 * Task With Providers Response (Create/Rematch)
 */
export interface TaskWithProvidersResponse {
  message: string;
  task?: Task;
  matchedProviders?: Array<{
    providerId: Types.ObjectId;
    matchScore: number;
    matchedServices: Types.ObjectId[];
    matchReasons: string[];
    distance?: number;
  }>;
  matchingSummary?: MatchingSummary;
  error?: string;
}
