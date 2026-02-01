// services/task.service.ts - CORRECT FIX with proper schema understanding

import { Types } from "mongoose";
import TaskModelInstance from "../../models/task.model";
import { UserRole } from "../../types/base.types";
import {
  CreateTaskRequestBody,
  TaskWithProvidersResponse,
  TaskStatus,
  TaskResponse,
  TaskListResponse,
  UpdateTaskRequestBody,
  ExpressInterestRequestBody,
  RequestProviderRequestBody,
  ProviderResponseRequestBody,
} from "../../types/tasks.types";
import { taskMatchingService } from "./provider-matching.service";
import { TaskBookingService } from "./task-booking.service";

export class TaskService {
  /**
   * ✅ CORRECT: Populate provider with nested UserProfile AND User
   * Architecture: ProviderProfile -> UserProfile -> User
   */
  private getProviderPopulateConfig() {
    return {
      path: "providerId",
      select: "businessName locationData profile isActive hasVerifiedAddress providerContactInfo",
      populate: {
        path: "profile", // This gets UserProfile
        select: "userId bio mobileNumber profilePictureId role",
        populate: {
          path: "userId", // This gets the actual User with firstName, lastName, email
          select: "firstName lastName email phone",
        },
      },
    };
  }

  /**
   * Create a new task and automatically attempt matching
   */
  async createTask(
    customerId: Types.ObjectId,
    data: CreateTaskRequestBody
  ): Promise<TaskWithProvidersResponse> {
    try {
      const task = new TaskModelInstance({
        ...data,
        customerId,
        status: TaskStatus.PENDING,
      });

      await task.save();

      const matchingStrategy = data.matchingStrategy || "intelligent";
      const matchingResult = await taskMatchingService.findMatchesForTask(
        task,
        matchingStrategy
      );

      if (matchingResult.matches.length > 0) {
        task.matchedProviders = matchingResult.matches.map((m) => ({
          providerId: m.providerId,
          matchScore: m.matchScore,
          matchedServices: m.matchedServices,
          matchReasons: m.matchReasons,
          distance: m.distance,
        }));
        task.status = TaskStatus.MATCHED;
      } else {
        task.matchedProviders = [];
        task.status = TaskStatus.FLOATING;
      }

      task.matchingAttemptedAt = new Date();
      task.matchingCriteria = {
        useLocationOnly: matchingResult.strategy === "location-only",
        searchTerms: matchingResult.metadata.searchTermsUsed,
        categoryMatch: !!data.category,
      };

      await task.save();

      // ✅ FIXED: Three-level population
      await task.populate([
        { path: "customerId", select: "name email" },
        {
          path: "matchedProviders.providerId",
          select: "businessName locationData profile isActive hasVerifiedAddress",
          populate: {
            path: "profile",
            select: "userId bio mobileNumber profilePictureId role",
            populate: {
              path: "userId",
              select: "firstName lastName email phone",
            },
          },
        },
      ]);

      return {
        message:
          task.status === TaskStatus.MATCHED
            ? "Task created and matched successfully"
            : "Task created as floating - no immediate matches found",
        task: task.toObject(),
        matchedProviders: task.matchedProviders,
        matchingSummary: {
          strategy: matchingResult.strategy,
          totalMatches: matchingResult.metadata.totalMatches,
          averageMatchScore: matchingResult.metadata.averageMatchScore,
          searchTermsUsed: matchingResult.metadata.searchTermsUsed,
        },
      };
    } catch (error: any) {
      return {
        message: "Failed to create task",
        error: error.message,
      };
    }
  }

  /**
   * Get task by ID with full details
   */
  async getTaskById(taskId: string): Promise<TaskResponse> {
    try {
      const task = await TaskModelInstance.findById(taskId)
        .populate("customerId", "name email")
        .populate({
          path: "matchedProviders.providerId",
          select: "businessName locationData profile isActive hasVerifiedAddress",
          populate: {
            path: "profile",
            select: "userId bio mobileNumber profilePictureId role",
            populate: {
              path: "userId",
              select: "firstName lastName email phone",
            },
          },
        })
        .populate({
          path: "interestedProviders.providerId",
          select: "businessName locationData profile isActive hasVerifiedAddress",
          populate: {
            path: "profile",
            select: "userId bio mobileNumber profilePictureId role",
            populate: {
              path: "userId",
              select: "firstName lastName email phone",
            },
          },
        })
        .populate({
          path: "requestedProvider.providerId",
          select: "businessName locationData profile isActive hasVerifiedAddress",
          populate: {
            path: "profile",
            select: "userId bio mobileNumber profilePictureId role",
            populate: {
              path: "userId",
              select: "firstName lastName email phone",
            },
          },
        })
        .populate({
          path: "acceptedProvider.providerId",
          select: "businessName locationData profile isActive hasVerifiedAddress",
          populate: {
            path: "profile",
            select: "userId bio mobileNumber profilePictureId role",
            populate: {
              path: "userId",
              select: "firstName lastName email phone",
            },
          },
        })
        .populate("convertedToBookingId");

      if (!task || task.isDeleted) {
        return {
          message: "Task not found",
        };
      }

      return {
        message: "Task retrieved successfully",
        task: task.toObject(),
      };
    } catch (error: any) {
      return {
        message: "Failed to retrieve task",
        error: error.message,
      };
    }
  }

  /**
   * ✅ FIXED: Get all tasks for a customer with THREE-LEVEL population
   * ProviderProfile -> UserProfile -> User
   */
  async getCustomerTasks(
    customerId: string,
    filters?: {
      status?: TaskStatus;
      includeDeleted?: boolean;
      includeConverted?: boolean;
    }
  ): Promise<TaskListResponse> {
    try {
      const query: any = {
        customerId,
        isDeleted: filters?.includeDeleted ? undefined : { $ne: true },
      };

      if (filters?.status) {
        query.status = filters.status;
      }
      if (filters?.includeConverted === false) {
        query.status = { ...query.status, $ne: TaskStatus.CONVERTED };
      }

      const tasks = await TaskModelInstance.find(query)
        .populate({
          path: "matchedProviders.providerId",
          select: "businessName locationData profile isActive hasVerifiedAddress providerContactInfo",
          populate: {
            path: "profile",
            select: "userId bio mobileNumber role",
            populate: [
              {
                path: "userId",
                select: "name email phone",
              },
              {
                path: "profilePictureId",
                select: "url thumbnailUrl",
              },
            ],
          },
        })
        .populate({
          path: "interestedProviders.providerId",
          select: "businessName locationData profile isActive hasVerifiedAddress providerContactInfo",
          populate: {
            path: "profile",
            select: "userId bio mobileNumber profilePictureId role",
             populate: [
              {
                path: "userId",
                select: "name email phone",
              },
              {
                path: "profilePictureId",
                select: "url thumbnailUrl",
              },
            ],
          },
        })
        .populate({
          path: "requestedProvider.providerId",
          select: "businessName locationData profile isActive hasVerifiedAddress providerContactInfo",
          populate: {
            path: "profile",
            select: "userId bio mobileNumber profilePictureId role",
            populate: [
              {
                path: "userId",
                select: "name email phone",
              },
              {
                path: "profilePictureId",
                select: "url thumbnailUrl",
              },
            ],
          },
        })
        .populate({
          path: "acceptedProvider.providerId",
          select: "businessName locationData profile isActive hasVerifiedAddress providerContactInfo",
          populate: {
            path: "profile",
            select: "userId bio mobileNumber profilePictureId role",
            populate: [
              {
                path: "userId",
                select: "name email phone",
              },
              {
                path: "profilePictureId",
                select: "url thumbnailUrl",
              },
            ],
          },
        })
        .populate("convertedToBookingId")
        .sort({ createdAt: -1 });

      return {
        message: "Tasks retrieved successfully",
        tasks: tasks.map((t) => t.toObject()),
      };
    } catch (error: any) {
      return {
        message: "Failed to retrieve tasks",
        error: error.message,
      };
    }
  }

  /**
   * Get matched tasks for a provider
   */
  async getMatchedTasksForProvider(
    providerId: string
  ): Promise<TaskListResponse> {
    try {
      const tasks = await TaskModelInstance.find({
        "matchedProviders.providerId": providerId,
        status: {
          $in: [
            TaskStatus.MATCHED,
            TaskStatus.REQUESTED,
            TaskStatus.ACCEPTED,
            TaskStatus.CONVERTED,
          ],
        },
        isDeleted: { $ne: true },
        $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: null }],
      })
        .populate("customerId", "name email")
        .sort({ createdAt: -1 });

      return {
        message: "Matched tasks retrieved successfully",
        tasks: tasks.map((t) => t.toObject()),
      };
    } catch (error: any) {
      return {
        message: "Failed to retrieve matched tasks",
        error: error.message,
      };
    }
  }

  /**
   * Get floating tasks for a provider
   */
  async getFloatingTasksForProvider(
    providerId: Types.ObjectId,
    providerLocation: any
  ): Promise<TaskListResponse> {
    try {
      const tasks = await taskMatchingService.getFloatingTasksForProvider(
        providerId,
        providerLocation,
        50
      );

      return {
        message: "Floating tasks retrieved successfully",
        tasks,
      };
    } catch (error: any) {
      return {
        message: "Failed to retrieve floating tasks",
        error: error.message,
      };
    }
  }

  /**
   * Get converted tasks
   */
  async getConvertedTasks(
    customerId?: string,
    providerId?: string
  ): Promise<TaskListResponse> {
    try {
      const filters: any = {};
      if (customerId) filters.customerId = customerId;
      if (providerId) filters.providerId = providerId;

      const tasks = await TaskModelInstance.findConverted(filters);

      return {
        message: "Converted tasks retrieved successfully",
        tasks: tasks.map((t: any) => t.toObject()),
      };
    } catch (error: any) {
      return {
        message: "Failed to retrieve converted tasks",
        error: error.message,
      };
    }
  }

  /**
   * Get task with its booking
   */
  async getTaskWithBooking(taskId: string): Promise<any> {
    try {
      const result = await TaskBookingService.getTaskWithBooking(taskId);

      return {
        message: "Task with booking retrieved successfully",
        task: result,
      };
    } catch (error: any) {
      return {
        message: "Failed to retrieve task with booking",
        error: error.message,
      };
    }
  }

  /**
   * Update a task
   */
  async updateTask(
    taskId: string,
    customerId: string,
    data: UpdateTaskRequestBody
  ): Promise<TaskResponse> {
    try {
      const task = await TaskModelInstance.findById(taskId);

      if (!task || task.isDeleted) {
        return {
          message: "Task not found",
        };
      }

      if (task.customerId.toString() !== customerId) {
        return {
          message: "Unauthorized to update this task",
        };
      }

      if (
        task.status === TaskStatus.REQUESTED ||
        task.status === TaskStatus.ACCEPTED ||
        task.status === TaskStatus.CONVERTED
      ) {
        return {
          message: "Cannot update task in current status",
        };
      }

      if (data.title) task.title = data.title;
      if (data.description) task.description = data.description;
      if (data.customerLocation) task.customerLocation = data.customerLocation;
      if (data.schedule) task.schedule = { ...task.schedule, ...data.schedule };

      await task.save();

      if (data.title || data.description) {
        const matchingResult = await taskMatchingService.findMatchesForTask(
          task,
          "intelligent"
        );

        if (matchingResult.matches.length > 0) {
          task.matchedProviders = matchingResult.matches.map((m) => ({
            providerId: m.providerId,
            matchScore: m.matchScore,
            matchedServices: m.matchedServices,
            matchReasons: m.matchReasons,
            distance: m.distance,
          }));
          task.status = TaskStatus.MATCHED;
        } else {
          task.matchedProviders = [];
          task.status = TaskStatus.FLOATING;
        }

        await task.save();
      }

      await task.populate([
        { path: "customerId", select: "name email" },
        {
          path: "matchedProviders.providerId",
          select: "businessName locationData profile isActive hasVerifiedAddress",
          populate: {
            path: "profile",
            select: "userId bio mobileNumber profilePictureId role",
            populate: {
              path: "userId",
              select: "firstName lastName email phone",
            },
          },
        },
      ]);

      return {
        message: "Task updated successfully",
        task: task.toObject(),
      };
    } catch (error: any) {
      return {
        message: "Failed to update task",
        error: error.message,
      };
    }
  }

  /**
   * Provider expresses interest in a floating task
   */
  async expressInterest(
    data: ExpressInterestRequestBody,
    providerId: Types.ObjectId
  ): Promise<TaskResponse> {
    try {
      const task = await TaskModelInstance.findById(data.taskId);

      if (!task || task.isDeleted) {
        return {
          message: "Task not found",
        };
      }

      const suitabilityCheck =
        await taskMatchingService.isProviderSuitableForTask(
          providerId,
          new Types.ObjectId(data.taskId)
        );

      if (!suitabilityCheck.suitable) {
        return {
          message: "Provider not suitable for this task",
          error: suitabilityCheck.reasons.join(", "),
        };
      }

      await task.addProviderInterest(providerId, data.message);

      await task.populate([
        { path: "customerId", select: "name email" },
        {
          path: "interestedProviders.providerId",
          select: "businessName locationData profile isActive hasVerifiedAddress",
          populate: {
            path: "profile",
            select: "userId bio mobileNumber profilePictureId role",
            populate: {
              path: "userId",
              select: "firstName lastName email phone",
            },
          },
        },
      ]);

      return {
        message: "Interest expressed successfully",
        task: task.toObject(),
      };
    } catch (error: any) {
      return {
        message: "Failed to express interest",
        error: error.message,
      };
    }
  }

  /**
   * Customer requests a specific provider
   */
  async requestProvider(
    data: RequestProviderRequestBody,
    customerId: string
  ): Promise<TaskResponse> {
    try {
      const task = await TaskModelInstance.findById(data.taskId);

      if (!task || task.isDeleted) {
        return {
          message: "Task not found",
        };
      }

      if (task.customerId.toString() !== customerId) {
        return {
          message: "Unauthorized to request provider for this task",
        };
      }

      await task.requestProvider(
        new Types.ObjectId(data.providerId),
        data.message
      );

      await task.populate([
        { path: "customerId", select: "name email" },
        {
          path: "requestedProvider.providerId",
          select: "businessName locationData profile isActive hasVerifiedAddress",
          populate: {
            path: "profile",
            select: "userId bio mobileNumber profilePictureId role",
            populate: {
              path: "userId",
              select: "firstName lastName email phone",
            },
          },
        },
      ]);

      return {
        message: "Provider requested successfully",
        task: task.toObject(),
      };
    } catch (error: any) {
      return {
        message: "Failed to request provider",
        error: error.message,
      };
    }
  }

  /**
   * Provider responds to a request
   */
  async respondToRequest(
    data: ProviderResponseRequestBody,
    providerId: string
  ): Promise<TaskResponse> {
    try {
      const task = await TaskModelInstance.findById(data.taskId);

      if (!task || task.isDeleted) {
        return {
          message: "Task not found",
        };
      }

      if (data.action === "accept") {
        const result = await TaskBookingService.acceptTaskAndCreateBooking(
          data.taskId,
          providerId,
          data.message
        );

        return {
          message: "Task accepted and booking created successfully",
          task: result.task.toObject(),
          booking: result.booking.toObject(),
        };
      } else {
        await task.rejectTask(new Types.ObjectId(providerId), data.message);

        await task.populate([
          { path: "customerId", select: "name email" },
          {
            path: "matchedProviders.providerId",
            select: "businessName locationData profile isActive hasVerifiedAddress",
            populate: {
              path: "profile",
              select: "userId bio mobileNumber profilePictureId role",
              populate: {
                path: "userId",
                select: "firstName lastName email phone",
              },
            },
          },
          {
            path: "interestedProviders.providerId",
            select: "businessName locationData profile isActive hasVerifiedAddress",
            populate: {
              path: "profile",
              select: "userId bio mobileNumber profilePictureId role",
              populate: {
                path: "userId",
                select: "firstName lastName email phone",
              },
            },
          },
        ]);

        return {
          message: "Task rejected successfully",
          task: task.toObject(),
        };
      }
    } catch (error: any) {
      return {
        message: "Failed to respond to request",
        error: error.message,
      };
    }
  }

  /**
   * Cancel a task
   */
  async cancelTask(
    taskId: string,
    userId: string,
    userRole: UserRole,
    reason?: string
  ): Promise<TaskResponse> {
    try {
      const task = await TaskModelInstance.findById(taskId);

      if (!task || task.isDeleted) {
        return {
          message: "Task not found",
        };
      }

      if (task.status === TaskStatus.CONVERTED) {
        return {
          message:
            "Cannot cancel task after conversion to booking. Cancel the booking instead.",
        };
      }

      if (userRole === UserRole.CUSTOMER) {
        if (task.customerId.toString() !== userId) {
          return {
            message: "Unauthorized to cancel this task",
          };
        }
      } else if (userRole === UserRole.PROVIDER) {
        if (task.requestedProvider?.providerId.toString() !== userId) {
          return {
            message: "Only the requested provider can cancel this task",
          };
        }
      }

      await task.cancelTask(reason, userRole);

      await task.populate([
        { path: "customerId", select: "name email" },
        {
          path: "requestedProvider.providerId",
          select: "businessName locationData profile isActive hasVerifiedAddress",
          populate: {
            path: "profile",
            select: "userId bio mobileNumber profilePictureId role",
            populate: {
              path: "userId",
              select: "firstName lastName email phone",
            },
          },
        },
      ]);

      return {
        message: "Task cancelled successfully",
        task: task.toObject(),
      };
    } catch (error: any) {
      return {
        message: "Failed to cancel task",
        error: error.message,
      };
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string, customerId: string): Promise<TaskResponse> {
    try {
      const task = await TaskModelInstance.findById(taskId);

      if (!task || task.isDeleted) {
        return {
          message: "Task not found",
        };
      }

      if (task.customerId.toString() !== customerId) {
        return {
          message: "Unauthorized to delete this task",
        };
      }

      if (
        task.status === TaskStatus.ACCEPTED ||
        task.status === TaskStatus.CONVERTED
      ) {
        return {
          message:
            "Cannot delete task in current status. Please cancel instead.",
        };
      }

      await task.softDelete(new Types.ObjectId(customerId));

      return {
        message: "Task deleted successfully",
      };
    } catch (error: any) {
      return {
        message: "Failed to delete task",
        error: error.message,
      };
    }
  }

  /**
   * Get tasks where provider was specifically requested
   */
  async getRequestedTasksForProvider(
    providerId: string
  ): Promise<TaskListResponse> {
    try {
      const tasks = await TaskModelInstance.find({
        "requestedProvider.providerId": providerId,
        status: {
          $in: [
            TaskStatus.REQUESTED,
            TaskStatus.ACCEPTED,
            TaskStatus.CONVERTED,
          ],
        },
        isDeleted: { $ne: true },
        $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: null }],
      })
        .populate("customerId", "name email phone")
        .populate({
          path: "matchedProviders.providerId",
          select: "businessName locationData",
        })
        .sort({ "requestedProvider.requestedAt": -1 });

      return {
        message: "Requested tasks retrieved successfully",
        tasks: tasks.map((t) => t.toObject()),
      };
    } catch (error: any) {
      return {
        message: "Failed to retrieve requested tasks",
        error: error.message,
      };
    }
  }

  /**
   * Re-run matching for a task
   */
  async rematchTask(
    taskId: string,
    customerId: string,
    strategy?: "intelligent" | "location-only"
  ): Promise<TaskWithProvidersResponse> {
    try {
      const task = await TaskModelInstance.findById(taskId);

      if (!task || task.isDeleted) {
        return {
          message: "Task not found",
        };
      }

      if (task.customerId.toString() !== customerId) {
        return {
          message: "Unauthorized to rematch this task",
        };
      }

      if (
        ![TaskStatus.PENDING, TaskStatus.MATCHED, TaskStatus.FLOATING].includes(
          task.status
        )
      ) {
        return {
          message: "Cannot rematch task in current status",
        };
      }

      const matchingResult = await taskMatchingService.findMatchesForTask(
        task,
        strategy || "intelligent"
      );

      if (matchingResult.matches.length > 0) {
        task.matchedProviders = matchingResult.matches.map((m) => ({
          providerId: m.providerId,
          matchScore: m.matchScore,
          matchedServices: m.matchedServices,
          matchReasons: m.matchReasons,
          distance: m.distance,
        }));
        task.status = TaskStatus.MATCHED;
      } else {
        task.matchedProviders = [];
        task.status = TaskStatus.FLOATING;
      }

      task.matchingAttemptedAt = new Date();
      await task.save();

      await task.populate([
        { path: "customerId", select: "name email" },
        {
          path: "matchedProviders.providerId",
          select: "businessName locationData profile isActive hasVerifiedAddress",
          populate: {
            path: "profile",
            select: "userId bio mobileNumber profilePictureId role",
            populate: {
              path: "userId",
              select: "firstName lastName email phone",
            },
          },
        },
      ]);

      return {
        message: "Task rematched successfully",
        task: task.toObject(),
        matchedProviders: task.matchedProviders,
        matchingSummary: {
          strategy: matchingResult.strategy,
          totalMatches: matchingResult.metadata.totalMatches,
          averageMatchScore: matchingResult.metadata.averageMatchScore,
          searchTermsUsed: matchingResult.metadata.searchTermsUsed,
        },
      };
    } catch (error: any) {
      return {
        message: "Failed to rematch task",
        error: error.message,
      };
    }
  }
}

export const taskService = new TaskService();