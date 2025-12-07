// controllers/task.controller.ts
import { Request, Response } from "express";
import taskService from "../services/task.service";
import {
  CreateTaskRequestBody,
  ExpressInterestRequestBody,
  RequestProviderRequestBody,
  UpdateTaskRequestBody,
} from "../types/tasks.types";
import {
  handleError,
  validateObjectId,
} from "../utils/controller-utils/controller.utils";
import { getUserProfileId } from "../middleware/role.middleware";

/**
 * Task Controller
 * Handles HTTP requests for task operations
 */
export class TaskController {
  /**
   * Create a new task
   * POST /api/tasks
   */
  async createTask(req: Request, res: Response) {
    try {
      const userId = req.user?._id.toString();
      if (!userId) {
        return res.status(401).json({
          message: "Unauthorized",
          error: "User not authenticated",
        });
      }

      const data: CreateTaskRequestBody = req.body;

      // Validate required fields
      if (!data.title || !data.location || !data.schedule) {
        return res.status(400).json({
          message: "Validation error",
          error: "Title, location, and schedule are required",
        });
      }

      const result = await taskService.createTask(userId, data);

      if (result.error) {
        return res.status(400).json(result);
      }

      return res.status(201).json(result);
    } catch (error: any) {
      return handleError(res, error);
    }
  }

  /**
   * Publish a task (triggers auto-matching)
   * POST /api/tasks/:taskId/publish
   */
  async publishTask(req: Request, res: Response) {
    try {
      const userId = req.user?._id.toString();
      if (!userId) {
        return res.status(401).json({
          message: "Unauthorized",
          error: "User not authenticated",
        });
      }

      const { taskId } = req.params;

      if (!validateObjectId(taskId)) {
        return res.status(400).json({
          message: "Validation error",
          error: "Invalid task ID",
        });
      }

      const result = await taskService.publishTask(taskId, userId);

      if (result.error) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error: any) {
      return handleError(res, error);
    }
  }

  /**
   * Get task by ID
   * GET /api/tasks/:taskId
   */
  async getTask(req: Request, res: Response) {
    try {
      const { taskId } = req.params;
      const userId = req.user?._id.toString();

      if (!validateObjectId(taskId)) {
        return res.status(400).json({
          message: "Validation error",
          error: "Invalid task ID",
        });
      }

      const result = await taskService.getTaskById(taskId, userId);

      if (result.error) {
        return res.status(404).json(result);
      }

      return res.status(200).json(result);
    } catch (error: any) {
      return handleError(res, error);
    }
  }

  /**
   * Get customer's tasks
   * GET /api/tasks/customer/my-tasks
   */
  async getMyTasks(req: Request, res: Response) {
    try {
      const userId = req.user?._id.toString();
      if (!userId) {
        return res.status(401).json({
          message: "Unauthorized",
          error: "User not authenticated",
        });
      }

      const result = await taskService.getCustomerTasks(userId);

      return res.status(200).json(result);
    } catch (error: any) {
      return handleError(res, error);
    }
  }

  /**
   * Get floating tasks (for providers)
   * GET /api/tasks/floating
   */
  async getFloatingTasks(req: Request, res: Response) {
    try {
      const result = await taskService.getFloatingTasks();

      return res.status(200).json(result);
    } catch (error: any) {
      return handleError(res, error);
    }
  }

  /**
   * Get recently posted tasks
   * GET /api/tasks/recent?days=7
   */
  async getRecentlyPostedTasks(req: Request, res: Response) {
    try {
      const { days } = req.query;
      const daysBack = days && typeof days === "string" ? parseInt(days, 10) : 7;

      if (isNaN(daysBack) || daysBack < 1 || daysBack > 365) {
        return res.status(400).json({
          message: "Validation error",
          error: "Days must be a number between 1 and 365",
        });
      }

      const result = await taskService.getRecentlyPostedTasks(daysBack);

      return res.status(200).json(result);
    } catch (error: any) {
      return handleError(res, error);
    }
  }

  /**
   * Get all unmatched posted tasks
   * GET /api/tasks/unmatched
   */
  async getAllUnmatchedPostedTasks(req: Request, res: Response) {
    try {
      const result = await taskService.getAllUnmatchedPostedTasks();

      return res.status(200).json(result);
    } catch (error: any) {
      return handleError(res, error);
    }
  }

  /**
   * Get tasks where provider was matched
   * GET /api/tasks/provider/matched
   */
  async getMatchedTasks(req: Request, res: Response) {
    try {
      // Get provider profile ID from middleware
      const providerProfileId = getUserProfileId(req);
      if (!providerProfileId) {
        return res.status(401).json({
          message: "Unauthorized",
          error: "Provider profile not found",
        });
      }

      const result = await taskService.getProviderMatchedTasks(providerProfileId);

      return res.status(200).json(result);
    } catch (error: any) {
      return handleError(res, error);
    }
  }

  /**
   * Provider expresses interest in floating task
   * POST /api/tasks/express-interest
   */
  async expressInterest(req: Request, res: Response) {
    try {
      // Get provider profile ID from middleware
      const providerProfileId = getUserProfileId(req);
      if (!providerProfileId) {
        return res.status(401).json({
          message: "Unauthorized",
          error: "Provider profile not found",
        });
      }

      const data: ExpressInterestRequestBody = req.body;

      if (!data.taskId) {
        return res.status(400).json({
          message: "Validation error",
          error: "Task ID is required",
        });
      }

      if (!validateObjectId(data.taskId)) {
        return res.status(400).json({
          message: "Validation error",
          error: "Invalid task ID",
        });
      }

      const result = await taskService.expressInterest(providerProfileId, data);

      if (result.error) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error: any) {
      return handleError(res, error);
    }
  }

  /**
   * Customer requests a provider
   * POST /api/tasks/request-provider
   */
  async requestProvider(req: Request, res: Response) {
    try {
      const userId = req.user?._id.toString();
      if (!userId) {
        return res.status(401).json({
          message: "Unauthorized",
          error: "User not authenticated",
        });
      }

      const data: RequestProviderRequestBody = req.body;

      if (!data.taskId || !data.providerId) {
        return res.status(400).json({
          message: "Validation error",
          error: "Task ID and Provider ID are required",
        });
      }

      if (
        !validateObjectId(data.taskId) ||
        !validateObjectId(data.providerId)
      ) {
        return res.status(400).json({
          message: "Validation error",
          error: "Invalid task ID or provider ID",
        });
      }

      const result = await taskService.requestProvider(userId, data);

      if (result.error) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error: any) {
      return handleError(res, error);
    }
  }

  /**
   * Provider accepts customer's request
   * POST /api/tasks/:taskId/accept
   */
  async acceptRequest(req: Request, res: Response) {
    try {
      // Get provider profile ID from middleware
      const providerProfileId = getUserProfileId(req);
      if (!providerProfileId) {
        return res.status(401).json({
          message: "Unauthorized",
          error: "Provider profile not found",
        });
      }

      const { taskId } = req.params;

      if (!validateObjectId(taskId)) {
        return res.status(400).json({
          message: "Validation error",
          error: "Invalid task ID",
        });
      }

      const result = await taskService.acceptRequest(providerProfileId, taskId);

      if (result.error) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error: any) {
      return handleError(res, error);
    }
  }

  /**
   * Provider declines customer's request
   * POST /api/tasks/:taskId/decline
   */
  async declineRequest(req: Request, res: Response) {
    try {
      // Get provider profile ID from middleware
      const providerProfileId = getUserProfileId(req);
      if (!providerProfileId) {
        return res.status(401).json({
          message: "Unauthorized",
          error: "Provider profile not found",
        });
      }

      const { taskId } = req.params;
      const { reason } = req.body;

      if (!validateObjectId(taskId)) {
        return res.status(400).json({
          message: "Validation error",
          error: "Invalid task ID",
        });
      }

      const result = await taskService.declineRequest(
        providerProfileId,
        taskId,
        reason
      );

      if (result.error) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error: any) {
      return handleError(res, error);
    }
  }

  /**
   * Provider starts task
   * POST /api/tasks/:taskId/start
   */
  async startTask(req: Request, res: Response) {
    try {
      // Get provider profile ID from middleware
      const providerProfileId = getUserProfileId(req);
      if (!providerProfileId) {
        return res.status(401).json({
          message: "Unauthorized",
          error: "Provider profile not found",
        });
      }

      const { taskId } = req.params;

      if (!validateObjectId(taskId)) {
        return res.status(400).json({
          message: "Validation error",
          error: "Invalid task ID",
        });
      }

      const result = await taskService.startTask(providerProfileId, taskId);

      if (result.error) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error: any) {
      return handleError(res, error);
    }
  }

  /**
   * Provider completes task
   * POST /api/tasks/:taskId/complete
   */
  async completeTask(req: Request, res: Response) {
    try {
      // Get provider profile ID from middleware
      const providerProfileId = getUserProfileId(req);
      if (!providerProfileId) {
        return res.status(401).json({
          message: "Unauthorized",
          error: "Provider profile not found",
        });
      }

      const { taskId } = req.params;

      if (!validateObjectId(taskId)) {
        return res.status(400).json({
          message: "Validation error",
          error: "Invalid task ID",
        });
      }

      const result = await taskService.completeTask(providerProfileId, taskId);

      if (result.error) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error: any) {
      return handleError(res, error);
    }
  }

  /**
   * Cancel task
   * POST /api/tasks/:taskId/cancel
   * Accessible by both customers and providers
   */
  async cancelTask(req: Request, res: Response) {
    try {
      const userId = req.user?._id.toString();
      if (!userId) {
        return res.status(401).json({
          message: "Unauthorized",
          error: "User not authenticated",
        });
      }

      const { taskId } = req.params;
      const { reason } = req.body;

      if (!validateObjectId(taskId)) {
        return res.status(400).json({
          message: "Validation error",
          error: "Invalid task ID",
        });
      }

      // Get provider profile ID if user is a provider
      const providerProfileId = getUserProfileId(req);

      const result = await taskService.cancelTask(
        userId,
        taskId,
        reason,
        providerProfileId
      );

      if (result.error) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error: any) {
      return handleError(res, error);
    }
  }

  /**
   * Update task
   * PUT /api/tasks/:taskId
   */
  async updateTask(req: Request, res: Response) {
    try {
      const userId = req.user?._id.toString();
      if (!userId) {
        return res.status(401).json({
          message: "Unauthorized",
          error: "User not authenticated",
        });
      }

      const { taskId } = req.params;
      const data: UpdateTaskRequestBody = req.body;

      if (!validateObjectId(taskId)) {
        return res.status(400).json({
          message: "Validation error",
          error: "Invalid task ID",
        });
      }

      const result = await taskService.updateTask(userId, taskId, data);

      if (result.error) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error: any) {
      return handleError(res, error);
    }
  }

  /**
   * Delete task
   * DELETE /api/tasks/:taskId
   */
  async deleteTask(req: Request, res: Response) {
    try {
      const userId = req.user?._id.toString();
      if (!userId) {
        return res.status(401).json({
          message: "Unauthorized",
          error: "User not authenticated",
        });
      }

      const { taskId } = req.params;

      if (!validateObjectId(taskId)) {
        return res.status(400).json({
          message: "Validation error",
          error: "Invalid task ID",
        });
      }

      const result = await taskService.deleteTask(userId, taskId);

      if (result.error) {
        return res.status(404).json(result);
      }

      return res.status(200).json(result);
    } catch (error: any) {
      return handleError(res, error);
    }
  }

  /**
   * Search tasks
   * GET /api/tasks/search?q=query
   */
  async searchTasks(req: Request, res: Response) {
    try {
      const { q } = req.query;

      if (!q || typeof q !== "string") {
        return res.status(400).json({
          message: "Validation error",
          error: "Search query is required",
        });
      }

      const result = await taskService.searchTasks(q);

      return res.status(200).json(result);
    } catch (error: any) {
      return handleError(res, error);
    }
  }

  /**
   * Get customer statistics
   * GET /api/tasks/customer/stats
   */
  async getCustomerStats(req: Request, res: Response) {
    try {
      const userId = req.user?._id.toString();
      if (!userId) {
        return res.status(401).json({
          message: "Unauthorized",
          error: "User not authenticated",
        });
      }

      const result = await taskService.getCustomerStats(userId);

      return res.status(200).json(result);
    } catch (error: any) {
      return handleError(res, error);
    }
  }

  /**
   * Get provider statistics
   * GET /api/tasks/provider/stats
   */
  async getProviderStats(req: Request, res: Response) {
    try {
      // Get provider profile ID from middleware
      const providerProfileId = getUserProfileId(req);
      if (!providerProfileId) {
        return res.status(401).json({
          message: "Unauthorized",
          error: "Provider profile not found",
        });
      }

      const result = await taskService.getProviderStats(providerProfileId);

      return res.status(200).json(result);
    } catch (error: any) {
      return handleError(res, error);
    }
  }
}

export default new TaskController();