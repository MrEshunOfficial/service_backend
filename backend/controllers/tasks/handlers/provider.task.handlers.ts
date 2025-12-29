// handlers/provider-task.handlers.ts

import { Response } from "express";
import { ProviderModel } from "../../../models/profiles/provider.model";
import { taskService } from "../../../services/tasks/task.service";
import { UserRole } from "../../../types/base.types";
import { TaskStatus } from "../../../types/tasks.types";
import { AuthenticatedRequest } from "../../../types/user.types";
import {
  handleError,
  validateObjectId,
} from "../../../utils/controller-utils/controller.utils";

/**
 * Provider Task Handlers
 * Handles all task operations from the provider's perspective
 */
export class ProviderTaskHandlers {
  /**
   * Helper method to get provider profile
   * First finds UserProfile by userId, then finds ProviderProfile by UserProfile._id
   */
  private static async getProviderProfile(userId: string) {
    // Import UserProfileModel (adjust the path as needed)
    const UserProfile = (await import("../../../models/profiles/userProfile.model")).default;
    
    // First, get the UserProfile using the User's ID
    const userProfile = await UserProfile.findOne({
      userId: userId,
      isDeleted: { $ne: true },
    });

    if (!userProfile) {
      throw new Error("User profile not found");
    }

    // Then, get the ProviderProfile using the UserProfile's ID
    const provider = await ProviderModel.findOne({
      profile: userProfile._id,
      isDeleted: { $ne: true },
    });

    if (!provider) {
      throw new Error("Provider profile not found");
    }

    return provider;
  }

  /**
   * Get matched tasks for the provider
   * GET /api/tasks/provider/matched
   */
  static async getMatchedTasks(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User not authenticated",
        });
      }

      // Get the provider profile
      const provider = await ProviderTaskHandlers.getProviderProfile(userId);

      // Use the provider's _id, not the user's _id
      const result = await taskService.getMatchedTasksForProvider(
        provider._id.toString()
      );

      if (result.error) {
        return res.status(400).json({
          success: false,
          message: result.message,
          error: result.error,
        });
      }

      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          tasks: result.tasks,
          count: result.tasks?.length || 0,
        },
      });
    } catch (error) {
      return handleError(res, error, "Failed to retrieve matched tasks");
    }
  }

  /**
   * Get floating tasks that provider can express interest in
   * GET /api/tasks/provider/floating
   */
  static async getFloatingTasks(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User not authenticated",
        });
      }

      // Get the provider profile from the database
      const provider = await ProviderTaskHandlers.getProviderProfile(userId);

      // Check if provider has location data
      if (!provider.locationData || !provider.locationData.ghanaPostGPS) {
        return res.status(400).json({
          success: false,
          message: "Provider location not set. Please update your profile.",
        });
      }

      // Use the provider's _id and locationData
      const result = await taskService.getFloatingTasksForProvider(
        provider._id, // This is the actual provider profile ObjectId
        provider.locationData
      );

      if (result.error) {
        return res.status(400).json({
          success: false,
          message: result.message,
          error: result.error,
        });
      }

      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          tasks: result.tasks,
          count: result.tasks?.length || 0,
        },
      });
    } catch (error) {
      return handleError(res, error, "Failed to retrieve floating tasks");
    }
  }

  /**
   * Get active tasks (tasks provider is working on)
   * GET /api/tasks/provider/active
   */
  static async getActiveTasks(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User not authenticated",
        });
      }

      // Get the provider profile
      const provider = await ProviderTaskHandlers.getProviderProfile(userId);

      // Use the provider's _id
      const result = await taskService.getActiveTasksForProvider(
        provider._id.toString()
      );

      if (result.error) {
        return res.status(400).json({
          success: false,
          message: result.message,
          error: result.error,
        });
      }

      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          tasks: result.tasks,
          count: result.tasks?.length || 0,
        },
      });
    } catch (error) {
      return handleError(res, error, "Failed to retrieve active tasks");
    }
  }

  /**
   * Express interest in a floating task
   * POST /api/tasks/:taskId/express-interest
   */
  static async expressInterest(req: AuthenticatedRequest, res: Response) {
    try {
      const { taskId } = req.params;
      const userId = req.userId;
      const { message } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User not authenticated",
        });
      }

      if (!validateObjectId(taskId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid task ID",
        });
      }

      // Get the provider profile
      const provider = await ProviderTaskHandlers.getProviderProfile(userId);

      // Use the provider's _id
      const result = await taskService.expressInterest(
        {
          taskId,
          message,
        },
        provider._id // Provider profile ObjectId, not user ObjectId
      );

      if (result.error) {
        return res.status(400).json({
          success: false,
          message: result.message,
          error: result.error,
        });
      }

      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          task: result.task,
        },
      });
    } catch (error) {
      return handleError(res, error, "Failed to express interest");
    }
  }

  /**
   * Respond to a task request (accept or reject)
   * POST /api/tasks/:taskId/respond
   */
  static async respondToRequest(req: AuthenticatedRequest, res: Response) {
    try {
      const { taskId } = req.params;
      const userId = req.userId;
      const { action, message } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User not authenticated",
        });
      }

      if (!validateObjectId(taskId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid task ID",
        });
      }

      if (!action || !["accept", "reject"].includes(action)) {
        return res.status(400).json({
          success: false,
          message: "Invalid action. Must be 'accept' or 'reject'",
        });
      }

      // Get the provider profile
      const provider = await ProviderTaskHandlers.getProviderProfile(userId);

      // Use the provider's _id
      const result = await taskService.respondToRequest(
        {
          taskId,
          action: action as "accept" | "reject",
          message,
        },
        provider._id.toString() // Provider profile ID
      );

      if (result.error) {
        return res.status(400).json({
          success: false,
          message: result.message,
          error: result.error,
        });
      }

      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          task: result.task,
        },
      });
    } catch (error) {
      return handleError(res, error, "Failed to respond to request");
    }
  }

  /**
   * Start working on an accepted task
   * POST /api/tasks/:taskId/start
   */
  static async startTask(req: AuthenticatedRequest, res: Response) {
    try {
      const { taskId } = req.params;
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User not authenticated",
        });
      }

      if (!validateObjectId(taskId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid task ID",
        });
      }

      // Get the provider profile
      const provider = await ProviderTaskHandlers.getProviderProfile(userId);

      // Use the provider's _id
      const result = await taskService.startTask(
        taskId,
        provider._id.toString()
      );

      if (result.error) {
        return res.status(400).json({
          success: false,
          message: result.message,
          error: result.error,
        });
      }

      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          task: result.task,
        },
      });
    } catch (error) {
      return handleError(res, error, "Failed to start task");
    }
  }

  /**
   * Complete a task
   * POST /api/tasks/:taskId/complete
   */
  static async completeTask(req: AuthenticatedRequest, res: Response) {
    try {
      const { taskId } = req.params;
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User not authenticated",
        });
      }

      if (!validateObjectId(taskId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid task ID",
        });
      }

      // Get the provider profile
      const provider = await ProviderTaskHandlers.getProviderProfile(userId);

      // Use the provider's _id
      const result = await taskService.completeTask(
        taskId,
        provider._id.toString()
      );

      if (result.error) {
        return res.status(400).json({
          success: false,
          message: result.message,
          error: result.error,
        });
      }

      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          task: result.task,
        },
      });
    } catch (error) {
      return handleError(res, error, "Failed to complete task");
    }
  }

  /**
   * Cancel a task (provider side)
   * POST /api/tasks/:taskId/provider-cancel
   */
  static async cancelTask(req: AuthenticatedRequest, res: Response) {
    try {
      const { taskId } = req.params;
      const userId = req.userId;
      const { reason } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User not authenticated",
        });
      }

      if (!validateObjectId(taskId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid task ID",
        });
      }

      // Get the provider profile
      const provider = await ProviderTaskHandlers.getProviderProfile(userId);

      // Use the provider's _id
      const result = await taskService.cancelTask(
        taskId,
        provider._id.toString(),
        UserRole.PROVIDER,
        reason
      );

      if (result.error) {
        return res.status(400).json({
          success: false,
          message: result.message,
          error: result.error,
        });
      }

      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          task: result.task,
        },
      });
    } catch (error) {
      return handleError(res, error, "Failed to cancel task");
    }
  }

  /**
   * Get a specific task details (provider view)
   * GET /api/tasks/provider/:taskId
   */
  static async getTaskDetails(req: AuthenticatedRequest, res: Response) {
    try {
      const { taskId } = req.params;
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User not authenticated",
        });
      }

      if (!validateObjectId(taskId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid task ID",
        });
      }

      // Get the provider profile
      const provider = await ProviderTaskHandlers.getProviderProfile(userId);
      const providerId = provider._id.toString();

      const result = await taskService.getTaskById(taskId);

      if (result.error || !result.task) {
        return res.status(404).json({
          success: false,
          message: result.message,
        });
      }

      // Check if provider has access to this task
      const task = result.task;
      const hasAccess =
        task.matchedProviders?.some(
          (mp: any) => mp.providerId?.toString() === providerId
        ) ||
        task.interestedProviders?.some(
          (ip: any) => ip.providerId?.toString() === providerId
        ) ||
        (task.requestedProvider &&
          task.requestedProvider.providerId?.toString() === providerId) ||
        (task.assignedProvider &&
          task.assignedProvider.providerId?.toString() === providerId) ||
        task.status === TaskStatus.FLOATING;

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You don't have access to this task",
        });
      }

      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          task: result.task,
        },
      });
    } catch (error) {
      return handleError(res, error, "Failed to retrieve task details");
    }
  }
}