// services/task.service.ts

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

export class TaskService {
  /**
   * Create a new task and automatically attempt matching
   */
  async createTask(
    customerId: Types.ObjectId,
    data: CreateTaskRequestBody
  ): Promise<TaskWithProvidersResponse> {
    try {
      // Create the task
      const task = new TaskModelInstance({
        ...data,
        customerId,
        status: TaskStatus.PENDING,
      });

      await task.save();

      // Attempt to find matches
      const matchingStrategy = data.matchingStrategy || "intelligent";
      const matchingResult = await taskMatchingService.findMatchesForTask(
        task,
        matchingStrategy
      );

      // Update task with matching results
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

      // Populate task data for response
      await task.populate([
        { path: "customerId", select: "name email" },
        {
          path: "matchedProviders.providerId",
          select: "businessName locationData profile",
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
        );

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
   * Get all tasks for a customer
   */
  async getCustomerTasks(
    customerId: string,
    filters?: {
      status?: TaskStatus;
      includeDeleted?: boolean;
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

      const tasks = await TaskModelInstance.find(query)
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
   * Get matched tasks for a provider (tasks where they were algorithmically matched)
   */
  async getMatchedTasksForProvider(
    providerId: string
  ): Promise<TaskListResponse> {
    try {
      const tasks = await TaskModelInstance.find({
        "matchedProviders.providerId": providerId,
        status: TaskStatus.MATCHED,
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
   * Get floating tasks for a provider (tasks they can express interest in)
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
   * Get active tasks for a provider (tasks they're working on)
   */
  async getActiveTasksForProvider(
    providerId: string
  ): Promise<TaskListResponse> {
    try {
      const tasks = await TaskModelInstance.find({
        "assignedProvider.providerId": providerId,
        status: { $in: [TaskStatus.ACCEPTED, TaskStatus.IN_PROGRESS] },
        isDeleted: { $ne: true },
      })
        .populate("customerId", "name email")
        .sort({ createdAt: -1 });

      return {
        message: "Active tasks retrieved successfully",
        tasks: tasks.map((t) => t.toObject()),
      };
    } catch (error: any) {
      return {
        message: "Failed to retrieve active tasks",
        error: error.message,
      };
    }
  }

  /**
   * Update a task (only before it's accepted)
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

      // Can only update tasks that haven't been accepted yet
      if (
        task.status === TaskStatus.ACCEPTED ||
        task.status === TaskStatus.IN_PROGRESS ||
        task.status === TaskStatus.COMPLETED
      ) {
        return {
          message: "Cannot update task in current status",
        };
      }

      // Update fields
      if (data.title) task.title = data.title;
      if (data.description) task.description = data.description;
      if (data.customerLocation) task.customerLocation = data.customerLocation;
      if (data.schedule) task.schedule = { ...task.schedule, ...data.schedule };

      await task.save();

      // Re-run matching if significant changes were made
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
          select: "businessName locationData profile",
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

      // Check if provider is suitable for the task
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

      // Add interest
      await task.addProviderInterest(providerId, data.message);

      await task.populate([
        { path: "customerId", select: "name email" },
        {
          path: "interestedProviders.providerId",
          select: "businessName locationData profile",
        },
      ]);

      // TODO: Send notification to customer

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
   * Customer requests a specific provider (from matched or interested list)
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

      // Request the provider
      await task.requestProvider(
        new Types.ObjectId(data.providerId),
        data.message
      );

      await task.populate([
        { path: "customerId", select: "name email" },
        {
          path: "requestedProvider.providerId",
          select: "businessName locationData profile",
        },
      ]);

      // TODO: Send notification to provider

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
   * Provider responds to a request (accept or reject)
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
        await task.acceptTask(new Types.ObjectId(providerId), data.message);

        await task.populate([
          { path: "customerId", select: "name email" },
          {
            path: "assignedProvider.providerId",
            select: "businessName locationData profile",
          },
        ]);

        // TODO: Send notification to customer

        return {
          message: "Task accepted successfully",
          task: task.toObject(),
        };
      } else {
        await task.rejectTask(new Types.ObjectId(providerId), data.message);

        await task.populate([
          { path: "customerId", select: "name email" },
          {
            path: "matchedProviders.providerId",
            select: "businessName locationData profile",
          },
          {
            path: "interestedProviders.providerId",
            select: "businessName locationData profile",
          },
        ]);

        // TODO: Send notification to customer

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
   * Start working on an accepted task
   */
  async startTask(taskId: string, providerId: string): Promise<TaskResponse> {
    try {
      const task = await TaskModelInstance.findById(taskId);

      if (!task || task.isDeleted) {
        return {
          message: "Task not found",
        };
      }

      if (task.assignedProvider?.providerId.toString() !== providerId) {
        return {
          message: "Only the assigned provider can start this task",
        };
      }

      await task.startTask();

      await task.populate([
        { path: "customerId", select: "name email" },
        {
          path: "assignedProvider.providerId",
          select: "businessName locationData profile",
        },
      ]);

      // TODO: Send notification to customer

      return {
        message: "Task started successfully",
        task: task.toObject(),
      };
    } catch (error: any) {
      return {
        message: "Failed to start task",
        error: error.message,
      };
    }
  }

  /**
   * Complete a task
   */
  async completeTask(
    taskId: string,
    providerId: string
  ): Promise<TaskResponse> {
    try {
      const task = await TaskModelInstance.findById(taskId);

      if (!task || task.isDeleted) {
        return {
          message: "Task not found",
        };
      }

      if (task.assignedProvider?.providerId.toString() !== providerId) {
        return {
          message: "Only the assigned provider can complete this task",
        };
      }

      await task.completeTask();

      await task.populate([
        { path: "customerId", select: "name email" },
        {
          path: "assignedProvider.providerId",
          select: "businessName locationData profile",
        },
      ]);

      // TODO: Send notification to customer and trigger review flow

      return {
        message: "Task completed successfully",
        task: task.toObject(),
      };
    } catch (error: any) {
      return {
        message: "Failed to complete task",
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

      // Verify authorization
      if (userRole === UserRole.CUSTOMER) {
        if (task.customerId.toString() !== userId) {
          return {
            message: "Unauthorized to cancel this task",
          };
        }
      } else if (userRole === UserRole.PROVIDER) {
        if (task.assignedProvider?.providerId.toString() !== userId) {
          return {
            message: "Only the assigned provider can cancel this task",
          };
        }
      }

      await task.cancelTask(reason, userRole);

      await task.populate([
        { path: "customerId", select: "name email" },
        {
          path: "assignedProvider.providerId",
          select: "businessName locationData profile",
        },
      ]);

      // TODO: Send notification to the other party

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
   * Delete a task (soft delete)
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

      // Can only delete tasks that haven't been accepted yet
      if (
        task.status === TaskStatus.ACCEPTED ||
        task.status === TaskStatus.IN_PROGRESS
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
   * Re-run matching for a task (if customer wants to try again)
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

      // Can only rematch pending, matched, or floating tasks
      if (
        ![TaskStatus.PENDING, TaskStatus.MATCHED, TaskStatus.FLOATING].includes(
          task.status
        )
      ) {
        return {
          message: "Cannot rematch task in current status",
        };
      }

      // Re-run matching
      const matchingResult = await taskMatchingService.findMatchesForTask(
        task,
        strategy || "intelligent"
      );

      // Update task
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
          select: "businessName locationData profile",
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

// Export singleton instance
export const taskService = new TaskService();
