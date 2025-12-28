// handlers/admin-task.handlers.ts

import { Response } from "express";
import { TaskStatus } from "../../../types/tasks.types";
import { AuthenticatedRequest } from "../../../types/user.types";
import { handleError } from "../../../utils/controller-utils/controller.utils";

/**
 * Admin Task Handlers
 * Handles administrative task operations and statistics
 */
export class AdminTaskHandlers {
  /**
   * Get all tasks (admin only)
   * GET /api/admin/tasks
   */
  static async getAllTasks(req: AuthenticatedRequest, res: Response) {
    try {
      // Check if user is admin (implement your admin check logic)
      if (!req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Admin access required",
        });
      }

      const { status, page = "1", limit = "20" } = req.query;

      // Implement pagination and filtering logic here
      const TaskModel = (await import("../../../models/task.model")).default;

      const query: any = {};
      if (status) {
        query.status = status;
      }

      const pageNum = Number(page);
      const limitNum = Number(limit);
      const skip = (pageNum - 1) * limitNum;

      const tasks = await TaskModel.find(query)
        .populate("customerId", "name email")
        .populate("matchedProviders.providerId", "businessName locationData")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

      const total = await TaskModel.countDocuments(query);

      return res.status(200).json({
        success: true,
        message: "Tasks retrieved successfully",
        data: {
          tasks,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      return handleError(res, error, "Failed to retrieve tasks");
    }
  }

  /**
   * Get task statistics (admin only)
   * GET /api/admin/tasks/statistics
   */
  static async getTaskStatistics(req: AuthenticatedRequest, res: Response) {
    try {
      // Check if user is admin
      if (!req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Admin access required",
        });
      }

      const TaskModel = (await import("../../../models/task.model")).default;

      const statistics = await TaskModel.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

      const total = await TaskModel.countDocuments();
      const activeCount = await TaskModel.countDocuments({
        status: {
          $nin: [
            TaskStatus.COMPLETED,
            TaskStatus.CANCELLED,
            TaskStatus.EXPIRED,
          ],
        },
      });

      return res.status(200).json({
        success: true,
        message: "Statistics retrieved successfully",
        data: {
          total,
          active: activeCount,
          byStatus: statistics,
        },
      });
    } catch (error) {
      return handleError(res, error, "Failed to retrieve statistics");
    }
  }
}
