// handlers/customer-task.handlers.ts

import { Response } from "express";
import { Types } from "mongoose";
import { taskService } from "../../../services/tasks/task.service";
import { UserRole } from "../../../types/base.types";
import {
  CreateTaskRequestBody,
  TaskStatus,
  UpdateTaskRequestBody,
} from "../../../types/tasks.types";
import { AuthenticatedRequest } from "../../../types/user.types";
import {
  validateObjectId,
  handleError,
} from "../../../utils/controller-utils/controller.utils";

/**
 * Customer Task Handlers
 * Handles all task operations from the customer's perspective
 */
export class CustomerTaskHandlers {
  /**
   * Create a new task
   * POST /api/tasks
   */
  static async createTask(req: AuthenticatedRequest, res: Response) {
    try {
      const customerId = req.userId;

      if (!customerId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User not authenticated",
        });
      }

      // Validate request body
      const {
        title,
        description,
        customerLocation,
        schedule,
        category,
        tags,
        estimatedBudget,
        matchingStrategy,
      } = req.body as CreateTaskRequestBody;

      // Required field validation
      if (!title || !description || !customerLocation || !schedule) {
        return res.status(400).json({
          success: false,
          message:
            "Missing required fields: title, description, customerLocation, schedule",
        });
      }

      // Validate schedule
      if (!schedule.priority) {
        return res.status(400).json({
          success: false,
          message: "Schedule priority is required",
        });
      }

      // Validate customer location
      if (!customerLocation.ghanaPostGPS) {
        return res.status(400).json({
          success: false,
          message: "Ghana Post GPS address is required",
        });
      }

      // Validate category if provided
      if (category && !validateObjectId(category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }

      // Create task
      const result = await taskService.createTask(
        new Types.ObjectId(customerId),
        {
          title,
          description,
          customerLocation,
          schedule,
          category,
          tags,
          estimatedBudget,
          matchingStrategy: matchingStrategy || "intelligent",
        }
      );

      if (result.error) {
        return res.status(400).json({
          success: false,
          message: result.message,
          error: result.error,
        });
      }

      return res.status(201).json({
        success: true,
        message: result.message,
        data: {
          task: result.task,
          matchedProviders: result.matchedProviders,
          matchingSummary: result.matchingSummary,
        },
      });
    } catch (error) {
      return handleError(res, error, "Failed to create task");
    }
  }

  /**
   * Get all tasks for the authenticated customer
   * GET /api/tasks/my-tasks
   */
  static async getMyTasks(req: AuthenticatedRequest, res: Response) {
    try {
      const customerId = req.userId;

      if (!customerId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User not authenticated",
        });
      }

      // Extract query parameters
      const { status, includeDeleted } = req.query;

      const result = await taskService.getCustomerTasks(customerId, {
        status: status as TaskStatus | undefined,
        includeDeleted: includeDeleted === "true",
      });

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
      return handleError(res, error, "Failed to retrieve tasks");
    }
  }

  /**
   * Get a specific task by ID
   * GET /api/tasks/:taskId
   */
  static async getTaskById(req: AuthenticatedRequest, res: Response) {
    try {
      const { taskId } = req.params;
      const customerId = req.userId;

      if (!customerId) {
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

      const result = await taskService.getTaskById(taskId);

      if (result.error || !result.task) {
        return res.status(404).json({
          success: false,
          message: result.message,
        });
      }

      // Verify ownership
      const taskCustomerId = result.task.customerId;
      if (taskCustomerId && taskCustomerId.toString() !== customerId) {
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
      return handleError(res, error, "Failed to retrieve task");
    }
  }

  /**
   * Update a task
   * PATCH /api/tasks/:taskId
   */
  static async updateTask(req: AuthenticatedRequest, res: Response) {
    try {
      const { taskId } = req.params;
      const customerId = req.userId;

      if (!customerId) {
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

      const updateData = req.body as UpdateTaskRequestBody;

      // Validate if at least one field is provided
      if (
        !updateData.title &&
        !updateData.description &&
        !updateData.customerLocation &&
        !updateData.schedule
      ) {
        return res.status(400).json({
          success: false,
          message: "No update fields provided",
        });
      }

      const result = await taskService.updateTask(
        taskId,
        customerId,
        updateData
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
      return handleError(res, error, "Failed to update task");
    }
  }

  /**
   * Request a specific provider for a task
   * POST /api/tasks/:taskId/request-provider
   */
  static async requestProvider(req: AuthenticatedRequest, res: Response) {
    try {
      const { taskId } = req.params;
      const customerId = req.userId;

      if (!customerId) {
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

      const { providerId, message } = req.body;

      if (!providerId) {
        return res.status(400).json({
          success: false,
          message: "Provider ID is required",
        });
      }

      if (!validateObjectId(providerId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid provider ID",
        });
      }

      const result = await taskService.requestProvider(
        {
          taskId,
          providerId,
          message,
        },
        customerId
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
      return handleError(res, error, "Failed to request provider");
    }
  }

  /**
   * Cancel a task
   * POST /api/tasks/:taskId/cancel
   */
  static async cancelTask(req: AuthenticatedRequest, res: Response) {
    try {
      const { taskId } = req.params;
      const customerId = req.userId;
      const { reason } = req.body;

      if (!customerId) {
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

      const result = await taskService.cancelTask(
        taskId,
        customerId,
        UserRole.CUSTOMER,
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
   * Delete a task (soft delete)
   * DELETE /api/tasks/:taskId
   */
  static async deleteTask(req: AuthenticatedRequest, res: Response) {
    try {
      const { taskId } = req.params;
      const customerId = req.userId;

      if (!customerId) {
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

      const result = await taskService.deleteTask(taskId, customerId);

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
      });
    } catch (error) {
      return handleError(res, error, "Failed to delete task");
    }
  }

  /**
   * Re-run matching for a task
   * POST /api/tasks/:taskId/rematch
   */
  static async rematchTask(req: AuthenticatedRequest, res: Response) {
    try {
      const { taskId } = req.params;
      const customerId = req.userId;
      const { strategy } = req.body;

      if (!customerId) {
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

      if (strategy && !["intelligent", "location-only"].includes(strategy)) {
        return res.status(400).json({
          success: false,
          message: "Invalid strategy. Must be 'intelligent' or 'location-only'",
        });
      }

      const result = await taskService.rematchTask(
        taskId,
        customerId,
        strategy as "intelligent" | "location-only" | undefined
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
          matchedProviders: result.matchedProviders,
          matchingSummary: result.matchingSummary,
        },
      });
    } catch (error) {
      return handleError(res, error, "Failed to rematch task");
    }
  }
}
