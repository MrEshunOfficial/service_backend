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
        .populate("matchedProviders", "businessName locationData")
        .populate("interestedProviders", "businessName locationData")
        .populate("requestedProviderId", "businessName locationData")
        .populate("assignedProviderId", "businessName locationData");

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
   * Get tasks where provider was matched
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
   */
  async cancelTask(
    userId: string,
    taskId: string,
    reason?: string
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

      // Check if user is customer or assigned provider
      const isCustomer = task.customerId.toString() === userId;
      const isProvider = task.assignedProviderId?.toString() === userId;

      if (!isCustomer && !isProvider) {
        return {
          message: "Permission denied",
          error: "You don't have permission to cancel this task",
        };
      }

      await task.cancel(reason);

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
