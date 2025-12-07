// services/task.service.ts
import { Types } from "mongoose";
import { TaskModel } from "../models/task.model";
import { ProviderModel } from "../models/profiles/provider.model";
import {
  CreateTaskRequestBody,
  TaskResponse,
  TaskStatus,
  TaskWithMatchesResponse,
  TaskListResponse,
  ExpressInterestRequestBody,
  RequestProviderRequestBody,
  UpdateTaskRequestBody,
} from "../types/tasks.types";

/**
 * Task Service
 * Handles all business logic for task operations
 */
export class TaskService {
  /**
   * Create a new task
   * Auto-matches providers on creation
   */
  async createTask(
    customerId: string,
    data: CreateTaskRequestBody
  ): Promise<TaskResponse> {
    try {
      const task = await TaskModel.create({
        ...data,
        customerId: new Types.ObjectId(customerId),
        status: TaskStatus.DRAFT,
      });

      // Populate the created task
      await task.populate([
        { path: "customerId", select: "name email" },
        { path: "matchedProviders", select: "businessName locationData profile" },
        { path: "interestedProviders", select: "businessName locationData profile" },
        { path: "requestedProviderId", select: "businessName locationData profile" },
        { path: "assignedProviderId", select: "businessName locationData profile" },
      ]);

      return {
        message: "Task created successfully",
        task: task.toJSON(),
      };
    } catch (error: any) {
      return {
        message: "Failed to create task",
        error: error.message,
      };
    }
  }

  /**
   * Publish a task (moves from DRAFT to OPEN/FLOATING)
   * Triggers auto-matching
   */
  async publishTask(
    taskId: string,
    customerId: string
  ): Promise<TaskWithMatchesResponse> {
    try {
      const task = await TaskModel.findOne({
        _id: taskId,
        customerId,
        isDeleted: { $ne: true },
      });

      if (!task) {
        return {
          message: "Task not found",
          error: "Task not found or you don't have permission",
        };
      }

      if (task.status !== TaskStatus.DRAFT) {
        return {
          message: "Task already published",
          error: "Task is not in draft status",
        };
      }

      // Change status to trigger auto-matching in pre-save hook
      task.status = TaskStatus.OPEN;
      await task.save();

      // Populate after save
      await task.populate([
        { path: "customerId", select: "name email" },
        { path: "matchedProviders", select: "businessName locationData profile" },
        { path: "interestedProviders", select: "businessName locationData profile" },
        { path: "requestedProviderId", select: "businessName locationData profile" },
        { path: "assignedProviderId", select: "businessName locationData profile" },
      ]);

      // Get the matches
      const matches = task.hasMatches ? await task.findMatchingProviders() : [];

      return {
        message: task.hasMatches
          ? `Task published with ${matches.length} matching providers`
          : "Task published as floating (no matches found)",
        task: task.toJSON(),
        matches,
        totalMatches: matches.length,
      };
    } catch (error: any) {
      return {
        message: "Failed to publish task",
        error: error.message,
      };
    }
  }

  /**
   * Get task by ID with matches
   */
  async getTaskById(
    taskId: string,
    userId?: string
  ): Promise<TaskWithMatchesResponse> {
    try {
      const task = await TaskModel.findOne({
        _id: taskId,
        isDeleted: { $ne: true },
      })
        .populate("customerId", "name email")
        .populate("matchedProviders", "businessName locationData profile")
        .populate("interestedProviders", "businessName locationData profile")
        .populate("requestedProviderId", "businessName locationData profile")
        .populate("assignedProviderId", "businessName locationData profile");

      if (!task) {
        return {
          message: "Task not found",
          error: "Task not found",
        };
      }

      // Increment view count if not the owner
      if (userId && task.customerId.toString() !== userId) {
        task.viewCount += 1;
        await task.save();
      }

      // Get matches if task has them
      const matches = task.hasMatches ? await task.findMatchingProviders() : [];

      return {
        message: "Task retrieved successfully",
        task: task.toJSON(),
        matches: matches.length > 0 ? matches : undefined,
        totalMatches: matches.length,
      };
    } catch (error: any) {
      return {
        message: "Failed to retrieve task",
        error: error.message,
      };
    }
  }

  /**
   * Get all tasks by customer
   * Uses findByCustomer static method which now has population
   */
  async getCustomerTasks(customerId: string): Promise<TaskListResponse> {
    try {
      const tasks = await TaskModel.findByCustomer(customerId);
      return {
        message: "Tasks retrieved successfully",
        tasks: tasks.map((t) => t.toJSON()),
        total: tasks.length,
      };
    } catch (error: any) {
      return {
        message: "Failed to retrieve tasks",
        error: error.message,
      };
    }
  }

  /**
   * Get floating tasks (no matches, visible to all providers)
   * Uses findFloatingTasks static method which now has population
   */
  async getFloatingTasks(): Promise<TaskListResponse> {
    try {
      const tasks = await TaskModel.findFloatingTasks();

      return {
        message: "Floating tasks retrieved successfully",
        tasks: tasks.map((t) => t.toJSON()),
        total: tasks.length,
      };
    } catch (error: any) {
      return {
        message: "Failed to retrieve floating tasks",
        error: error.message,
      };
    }
  }

  /**
   * Get recently posted tasks (within last 7 days)
   * @param daysBack - Number of days to look back (default: 7)
   */
  async getRecentlyPostedTasks(daysBack: number = 7): Promise<TaskListResponse> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      const tasks = await TaskModel.find({
        isDeleted: { $ne: true },
        status: { 
          $in: [
            TaskStatus.OPEN, 
            TaskStatus.FLOATING, 
            TaskStatus.REQUESTED,
            TaskStatus.ASSIGNED,
            TaskStatus.IN_PROGRESS
          ] 
        },
        createdAt: { $gte: cutoffDate },
      })
        .sort({ createdAt: -1 })
        .populate("customerId", "name email")
        .populate("matchedProviders", "businessName locationData profile")
        .populate("interestedProviders", "businessName locationData profile")
        .populate("requestedProviderId", "businessName locationData profile")
        .populate("assignedProviderId", "businessName locationData profile");

      return {
        message: `Recently posted tasks (last ${daysBack} days) retrieved successfully`,
        tasks: tasks.map((t) => t.toJSON()),
        total: tasks.length,
      };
    } catch (error: any) {
      return {
        message: "Failed to retrieve recently posted tasks",
        error: error.message,
      };
    }
  }

  /**
   * Get all unmatched posted tasks (FLOATING tasks without any matches)
   * These are tasks that are available for any provider to express interest in
   */
  async getAllUnmatchedPostedTasks(): Promise<TaskListResponse> {
    try {
      const tasks = await TaskModel.find({
        isDeleted: { $ne: true },
        status: TaskStatus.FLOATING,
        hasMatches: false,
        $or: [
          { matchedProviders: { $exists: false } },
          { matchedProviders: { $size: 0 } },
        ],
      })
        .sort({ createdAt: -1 })
        .populate("customerId", "name email")
        .populate("interestedProviders", "businessName locationData profile");

      return {
        message: "All unmatched posted tasks retrieved successfully",
        tasks: tasks.map((t) => t.toJSON()),
        total: tasks.length,
      };
    } catch (error: any) {
      return {
        message: "Failed to retrieve unmatched posted tasks",
        error: error.message,
      };
    }
  }

  /**
   * Get tasks where provider was matched
   * Uses findByProviderInMatches static method which now has population
   */
  async getProviderMatchedTasks(providerId: string): Promise<TaskListResponse> {
    try {
      const tasks = await TaskModel.findByProviderInMatches(providerId);

      return {
        message: "Matched tasks retrieved successfully",
        tasks: tasks.map((t) => t.toJSON()),
        total: tasks.length,
      };
    } catch (error: any) {
      return {
        message: "Failed to retrieve matched tasks",
        error: error.message,
      };
    }
  }

  /**
   * Provider expresses interest in floating task
   */
  async expressInterest(
    providerId: string,
    data: ExpressInterestRequestBody
  ): Promise<TaskResponse> {
    try {
      const task = await TaskModel.findOne({
        _id: data.taskId,
        isDeleted: { $ne: true },
      });

      if (!task) {
        return {
          message: "Task not found",
          error: "Task not found",
        };
      }

      if (task.status !== TaskStatus.FLOATING) {
        return {
          message: "Cannot express interest",
          error: "Only floating tasks accept provider interest",
        };
      }

      await task.addInterestedProvider(new Types.ObjectId(providerId));

      // Populate after update
      await task.populate([
        { path: "customerId", select: "name email" },
        { path: "matchedProviders", select: "businessName locationData profile" },
        { path: "interestedProviders", select: "businessName locationData profile" },
        { path: "requestedProviderId", select: "businessName locationData profile" },
        { path: "assignedProviderId", select: "businessName locationData profile" },
      ]);

      // TODO: Send notification to customer with provider's message

      return {
        message: "Interest expressed successfully",
        task: task.toJSON(),
      };
    } catch (error: any) {
      return {
        message: "Failed to express interest",
        error: error.message,
      };
    }
  }

  /**
   * Client requests a provider (from matched list or interested providers)
   */
  async requestProvider(
    customerId: string,
    data: RequestProviderRequestBody
  ): Promise<TaskResponse> {
    try {
      const task = await TaskModel.findOne({
        _id: data.taskId,
        customerId,
        isDeleted: { $ne: true },
      });

      if (!task) {
        return {
          message: "Task not found",
          error: "Task not found or you don't have permission",
        };
      }

      if (
        task.status !== TaskStatus.OPEN &&
        task.status !== TaskStatus.FLOATING
      ) {
        return {
          message: "Cannot request provider",
          error: "Task is not in open or floating status",
        };
      }

      // Verify provider is either in matched list or interested list
      const providerIdObj = new Types.ObjectId(data.providerId);
      const isMatched = task.matchedProviders?.some(
        (id) => id.toString() === data.providerId
      );
      const isInterested = task.interestedProviders?.some(
        (id) => id.toString() === data.providerId
      );

      if (!isMatched && !isInterested) {
        return {
          message: "Invalid provider",
          error: "Provider is not matched or interested in this task",
        };
      }

      // Verify provider exists
      const provider = await ProviderModel.findOne({
        _id: providerIdObj,
        isDeleted: { $ne: true },
      });

      if (!provider) {
        return {
          message: "Provider not found",
          error: "Provider not found",
        };
      }

      await task.requestProvider(providerIdObj);

      // Populate after update
      await task.populate([
        { path: "customerId", select: "name email" },
        { path: "matchedProviders", select: "businessName locationData profile" },
        { path: "interestedProviders", select: "businessName locationData profile" },
        { path: "requestedProviderId", select: "businessName locationData profile" },
        { path: "assignedProviderId", select: "businessName locationData profile" },
      ]);

      // TODO: Send notification to provider with customer's message

      return {
        message: "Provider requested successfully",
        task: task.toJSON(),
      };
    } catch (error: any) {
      return {
        message: "Failed to request provider",
        error: error.message,
      };
    }
  }

  /**
   * Provider accepts client's request
   */
  async acceptRequest(
    providerId: string,
    taskId: string
  ): Promise<TaskResponse> {
    try {
      const task = await TaskModel.findOne({
        _id: taskId,
        requestedProviderId: providerId,
        status: TaskStatus.REQUESTED,
        isDeleted: { $ne: true },
      });

      if (!task) {
        return {
          message: "Task not found",
          error: "Task not found or you're not the requested provider",
        };
      }

      await task.acceptRequest(new Types.ObjectId(providerId));

      // Populate after update
      await task.populate([
        { path: "customerId", select: "name email" },
        { path: "matchedProviders", select: "businessName locationData profile" },
        { path: "interestedProviders", select: "businessName locationData profile" },
        { path: "requestedProviderId", select: "businessName locationData profile" },
        { path: "assignedProviderId", select: "businessName locationData profile" },
      ]);

      // TODO: Send notification to customer

      return {
        message: "Request accepted successfully",
        task: task.toJSON(),
      };
    } catch (error: any) {
      return {
        message: "Failed to accept request",
        error: error.message,
      };
    }
  }

  /**
   * Provider declines client's request
   */
  async declineRequest(
    providerId: string,
    taskId: string,
    reason?: string
  ): Promise<TaskResponse> {
    try {
      const task = await TaskModel.findOne({
        _id: taskId,
        requestedProviderId: providerId,
        status: TaskStatus.REQUESTED,
        isDeleted: { $ne: true },
      });

      if (!task) {
        return {
          message: "Task not found",
          error: "Task not found or you're not the requested provider",
        };
      }

      // Reset task to previous status
      task.status = task.hasMatches ? TaskStatus.OPEN : TaskStatus.FLOATING;
      task.requestedProviderId = undefined;
      task.requestedAt = undefined;
      await task.save();

      // Populate after update
      await task.populate([
        { path: "customerId", select: "name email" },
        { path: "matchedProviders", select: "businessName locationData profile" },
        { path: "interestedProviders", select: "businessName locationData profile" },
        { path: "requestedProviderId", select: "businessName locationData profile" },
        { path: "assignedProviderId", select: "businessName locationData profile" },
      ]);

      // TODO: Send notification to customer with reason

      return {
        message: "Request declined successfully",
        task: task.toJSON(),
      };
    } catch (error: any) {
      return {
        message: "Failed to decline request",
        error: error.message,
      };
    }
  }

  /**
   * Update task status to IN_PROGRESS
   */
  async startTask(providerId: string, taskId: string): Promise<TaskResponse> {
    try {
      const task = await TaskModel.findOne({
        _id: taskId,
        assignedProviderId: providerId,
        status: TaskStatus.ASSIGNED,
        isDeleted: { $ne: true },
      });

      if (!task) {
        return {
          message: "Task not found",
          error: "Task not found or you're not assigned to it",
        };
      }

      task.status = TaskStatus.IN_PROGRESS;
      await task.save();

      // Populate after update
      await task.populate([
        { path: "customerId", select: "name email" },
        { path: "matchedProviders", select: "businessName locationData profile" },
        { path: "interestedProviders", select: "businessName locationData profile" },
        { path: "requestedProviderId", select: "businessName locationData profile" },
        { path: "assignedProviderId", select: "businessName locationData profile" },
      ]);

      return {
        message: "Task started successfully",
        task: task.toJSON(),
      };
    } catch (error: any) {
      return {
        message: "Failed to start task",
        error: error.message,
      };
    }
  }

  /**
   * Mark task as completed
   */
  async completeTask(
    providerId: string,
    taskId: string
  ): Promise<TaskResponse> {
    try {
      const task = await TaskModel.findOne({
        _id: taskId,
        assignedProviderId: providerId,
        isDeleted: { $ne: true },
      });

      if (!task) {
        return {
          message: "Task not found",
          error: "Task not found or you're not assigned to it",
        };
      }

      if (
        task.status !== TaskStatus.IN_PROGRESS &&
        task.status !== TaskStatus.ASSIGNED
      ) {
        return {
          message: "Cannot complete task",
          error: "Task must be in progress or assigned status",
        };
      }

      await task.markAsCompleted();

      // Populate after update
      await task.populate([
        { path: "customerId", select: "name email" },
        { path: "matchedProviders", select: "businessName locationData profile" },
        { path: "interestedProviders", select: "businessName locationData profile" },
        { path: "requestedProviderId", select: "businessName locationData profile" },
        { path: "assignedProviderId", select: "businessName locationData profile" },
      ]);

      // TODO: Trigger review/rating request to customer

      return {
        message: "Task completed successfully",
        task: task.toJSON(),
      };
    } catch (error: any) {
      return {
        message: "Failed to complete task",
        error: error.message,
      };
    }
  }

  /**
   * Cancel task
   * Can be called by either the customer who created the task or the assigned provider
   */
  async cancelTask(
    userId: string,
    taskId: string,
    reason?: string,
    providerProfileId?: string
  ): Promise<TaskResponse> {
    try {
      const task = await TaskModel.findOne({
        _id: taskId,
        isDeleted: { $ne: true },
      });

      if (!task) {
        return {
          message: "Task not found",
          error: "Task not found",
        };
      }

      // Check if user is customer (owner of the task)
      const isCustomer = task.customerId.toString() === userId;
      
      // Check if user is the assigned provider
      const isAssignedProvider = providerProfileId
        ? task.assignedProviderId?.toString() === providerProfileId
        : task.assignedProviderId?.toString() === userId;

      if (!isCustomer && !isAssignedProvider) {
        return {
          message: "Permission denied",
          error: "You don't have permission to cancel this task. Only the task creator or assigned provider can cancel.",
        };
      }

      // Additional business rules
      if (task.status === TaskStatus.COMPLETED) {
        return {
          message: "Cannot cancel task",
          error: "Completed tasks cannot be cancelled",
        };
      }

      if (task.status === TaskStatus.CANCELLED) {
        return {
          message: "Task already cancelled",
          error: "This task has already been cancelled",
        };
      }

      await task.cancel(reason);

      // Populate after update
      await task.populate([
        { path: "customerId", select: "name email" },
        { path: "matchedProviders", select: "businessName locationData profile" },
        { path: "interestedProviders", select: "businessName locationData profile" },
        { path: "requestedProviderId", select: "businessName locationData profile" },
        { path: "assignedProviderId", select: "businessName locationData profile" },
      ]);

      // TODO: Send notification to other party

      return {
        message: "Task cancelled successfully",
        task: task.toJSON(),
      };
    } catch (error: any) {
      return {
        message: "Failed to cancel task",
        error: error.message,
      };
    }
  }

  /**
   * Update task (only in DRAFT status)
   */
  async updateTask(
    customerId: string,
    taskId: string,
    data: UpdateTaskRequestBody
  ): Promise<TaskResponse> {
    try {
      const task = await TaskModel.findOne({
        _id: taskId,
        customerId,
        isDeleted: { $ne: true },
      });

      if (!task) {
        return {
          message: "Task not found",
          error: "Task not found or you don't have permission",
        };
      }

      if (task.status !== TaskStatus.DRAFT) {
        return {
          message: "Cannot update task",
          error: "Only draft tasks can be updated",
        };
      }

      Object.assign(task, data);
      await task.save();

      // Populate after update
      await task.populate([
        { path: "customerId", select: "name email" },
        { path: "matchedProviders", select: "businessName locationData profile" },
        { path: "interestedProviders", select: "businessName locationData profile" },
        { path: "requestedProviderId", select: "businessName locationData profile" },
        { path: "assignedProviderId", select: "businessName locationData profile" },
      ]);

      return {
        message: "Task updated successfully",
        task: task.toJSON(),
      };
    } catch (error: any) {
      return {
        message: "Failed to update task",
        error: error.message,
      };
    }
  }

  /**
   * Delete task (soft delete)
   */
  async deleteTask(customerId: string, taskId: string): Promise<TaskResponse> {
    try {
      const task = await TaskModel.findOne({
        _id: taskId,
        customerId,
        isDeleted: { $ne: true },
      });

      if (!task) {
        return {
          message: "Task not found",
          error: "Task not found or you don't have permission",
        };
      }

      if (
        task.status !== TaskStatus.DRAFT &&
        task.status !== TaskStatus.OPEN &&
        task.status !== TaskStatus.FLOATING
      ) {
        return {
          message: "Cannot delete task",
          error: "Task cannot be deleted in current status",
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
   * Search tasks
   * Uses searchTasks static method which now has population
   */
  async searchTasks(searchTerm: string): Promise<TaskListResponse> {
    try {
      const tasks = await TaskModel.searchTasks(searchTerm);

      return {
        message: "Search completed successfully",
        tasks: tasks.map((t) => t.toJSON()),
        total: tasks.length,
      };
    } catch (error: any) {
      return {
        message: "Search failed",
        error: error.message,
      };
    }
  }

  /**
   * Get task statistics for customer
   */
  async getCustomerStats(customerId: string) {
    try {
      const tasks = await TaskModel.find({
        customerId,
        isDeleted: { $ne: true },
      });

      const stats = {
        total: tasks.length,
        draft: tasks.filter((t) => t.status === TaskStatus.DRAFT).length,
        open: tasks.filter((t) => t.status === TaskStatus.OPEN).length,
        floating: tasks.filter((t) => t.status === TaskStatus.FLOATING).length,
        requested: tasks.filter((t) => t.status === TaskStatus.REQUESTED)
          .length,
        assigned: tasks.filter((t) => t.status === TaskStatus.ASSIGNED).length,
        inProgress: tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS)
          .length,
        completed: tasks.filter((t) => t.status === TaskStatus.COMPLETED)
          .length,
        cancelled: tasks.filter((t) => t.status === TaskStatus.CANCELLED)
          .length,
      };

      return {
        message: "Statistics retrieved successfully",
        stats,
      };
    } catch (error: any) {
      return {
        message: "Failed to retrieve statistics",
        error: error.message,
      };
    }
  }

  /**
   * Get task statistics for provider
   */
  async getProviderStats(providerId: string) {
    try {
      const tasks = await TaskModel.find({
        assignedProviderId: providerId,
        isDeleted: { $ne: true },
      });

      const matchedTasks = await TaskModel.findByProviderInMatches(providerId);

      const stats = {
        totalAssigned: tasks.length,
        matched: matchedTasks.length,
        assigned: tasks.filter((t) => t.status === TaskStatus.ASSIGNED).length,
        inProgress: tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS)
          .length,
        completed: tasks.filter((t) => t.status === TaskStatus.COMPLETED)
          .length,
        cancelled: tasks.filter((t) => t.status === TaskStatus.CANCELLED)
          .length,
      };

      return {
        message: "Statistics retrieved successfully",
        stats,
      };
    } catch (error: any) {
      return {
        message: "Failed to retrieve statistics",
        error: error.message,
      };
    }
  }
}

export default new TaskService();