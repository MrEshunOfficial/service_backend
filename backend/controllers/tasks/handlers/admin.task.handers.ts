// handlers/admin-task.handlers.ts - REFACTORED

import { Response } from "express";
import { TaskStatus } from "../../../types/tasks.types";
import { BookingStatus } from "../../../types/booking.types";
import { AuthenticatedRequest } from "../../../types/user.types";
import { handleError } from "../../../utils/controller-utils/controller.utils";

/**
 * Admin Task & Booking Handlers - REFACTORED
 * Handles administrative operations for both tasks and bookings
 */
export class AdminTaskHandlers {
  /**
   * Get all tasks (admin only)
   * GET /api/admin/tasks
   */
  static async getAllTasks(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Admin access required",
        });
      }

      const { status, page = "1", limit = "20" } = req.query;

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
        .populate("convertedToBookingId") // ✅ NEW: Populate booking reference
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
   * ✅ UPDATED: Get task statistics (admin only)
   * GET /api/admin/tasks/statistics
   * Now includes both task and booking stats
   */
  static async getTaskStatistics(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Admin access required",
        });
      }

      const TaskModel = (await import("../../../models/task.model")).default;

      // Task statistics
      const taskStatistics = await TaskModel.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

      const totalTasks = await TaskModel.countDocuments();
      const activeTasksCount = await TaskModel.countDocuments({
        status: {
          $in: [
            TaskStatus.PENDING,
            TaskStatus.MATCHED,
            TaskStatus.FLOATING,
            TaskStatus.REQUESTED,
          ],
        },
      });

      const convertedTasksCount = await TaskModel.countDocuments({
        status: TaskStatus.CONVERTED,
      });

      return res.status(200).json({
        success: true,
        message: "Task statistics retrieved successfully",
        data: {
          total: totalTasks,
          active: activeTasksCount,
          converted: convertedTasksCount,
          byStatus: taskStatistics,
        },
      });
    } catch (error) {
      return handleError(res, error, "Failed to retrieve task statistics");
    }
  }

  /**
   * ✅ NEW: Get all bookings (admin only)
   * GET /api/admin/bookings
   */
  static async getAllBookings(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Admin access required",
        });
      }

      const { status, page = "1", limit = "20" } = req.query;

      const { BookingModel } = await import("../../../models/booking.model");

      const query: any = {};
      if (status) {
        query.status = status;
      }

      const pageNum = Number(page);
      const limitNum = Number(limit);
      const skip = (pageNum - 1) * limitNum;

      const bookings = await BookingModel.find(query)
        .populate("taskId", "title description")
        .populate("clientId", "name email")
        .populate("providerId", "businessName locationData")
        .populate("serviceId", "title")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

      const total = await BookingModel.countDocuments(query);

      return res.status(200).json({
        success: true,
        message: "Bookings retrieved successfully",
        data: {
          bookings,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      return handleError(res, error, "Failed to retrieve bookings");
    }
  }

  /**
   * ✅ NEW: Get booking statistics (admin only)
   * GET /api/admin/bookings/statistics
   */
  static async getBookingStatistics(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Admin access required",
        });
      }

      const { BookingModel } = await import("../../../models/booking.model");

      // Booking statistics
      const bookingStatistics = await BookingModel.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

      const totalBookings = await BookingModel.countDocuments();
      const activeBookingsCount = await BookingModel.countDocuments({
        status: {
          $in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS],
        },
      });

      const completedBookingsCount = await BookingModel.countDocuments({
        status: BookingStatus.COMPLETED,
      });

      // Revenue statistics (if prices are set)
      const revenueStats = await BookingModel.aggregate([
        {
          $match: {
            status: BookingStatus.COMPLETED,
            finalPrice: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$finalPrice" },
            averageBookingValue: { $avg: "$finalPrice" },
            count: { $sum: 1 },
          },
        },
      ]);

      return res.status(200).json({
        success: true,
        message: "Booking statistics retrieved successfully",
        data: {
          total: totalBookings,
          active: activeBookingsCount,
          completed: completedBookingsCount,
          byStatus: bookingStatistics,
          revenue: revenueStats[0] || {
            totalRevenue: 0,
            averageBookingValue: 0,
            count: 0,
          },
        },
      });
    } catch (error) {
      return handleError(res, error, "Failed to retrieve booking statistics");
    }
  }

  /**
   * ✅ NEW: Get comprehensive platform statistics (admin only)
   * GET /api/admin/statistics
   */
  static async getPlatformStatistics(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Admin access required",
        });
      }

      const TaskModel = (await import("../../../models/task.model")).default;
      const { BookingModel } = await import("../../../models/booking.model");

      // Get all stats in parallel
      const [
        totalTasks,
        activeTasks,
        convertedTasks,
        cancelledTasks,
        totalBookings,
        activeBookings,
        completedBookings,
        cancelledBookings,
        tasksByStatus,
        bookingsByStatus,
      ] = await Promise.all([
        TaskModel.countDocuments(),
        TaskModel.countDocuments({
          status: {
            $in: [
              TaskStatus.PENDING,
              TaskStatus.MATCHED,
              TaskStatus.FLOATING,
              TaskStatus.REQUESTED,
            ],
          },
        }),
        TaskModel.countDocuments({ status: TaskStatus.CONVERTED }),
        TaskModel.countDocuments({ status: TaskStatus.CANCELLED }),
        BookingModel.countDocuments(),
        BookingModel.countDocuments({
          status: {
            $in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS],
          },
        }),
        BookingModel.countDocuments({ status: BookingStatus.COMPLETED }),
        BookingModel.countDocuments({ status: BookingStatus.CANCELLED }),
        TaskModel.aggregate([
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ]),
        BookingModel.aggregate([
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

      // Conversion rate: (converted tasks / total tasks) * 100
      const conversionRate =
        totalTasks > 0 ? (convertedTasks / totalTasks) * 100 : 0;

      // Completion rate: (completed bookings / total bookings) * 100
      const completionRate =
        totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;

      return res.status(200).json({
        success: true,
        message: "Platform statistics retrieved successfully",
        data: {
          tasks: {
            total: totalTasks,
            active: activeTasks,
            converted: convertedTasks,
            cancelled: cancelledTasks,
            byStatus: tasksByStatus,
          },
          bookings: {
            total: totalBookings,
            active: activeBookings,
            completed: completedBookings,
            cancelled: cancelledBookings,
            byStatus: bookingsByStatus,
          },
          metrics: {
            conversionRate: Number(conversionRate.toFixed(2)),
            completionRate: Number(completionRate.toFixed(2)),
          },
        },
      });
    } catch (error) {
      return handleError(res, error, "Failed to retrieve platform statistics");
    }
  }

  /**
   * ✅ NEW: Get task-to-booking funnel analysis (admin only)
   * GET /api/admin/funnel-analysis
   */
  static async getFunnelAnalysis(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Admin access required",
        });
      }

      const TaskModel = (await import("../../../models/task.model")).default;
      const { BookingModel } = await import("../../../models/booking.model");

      // Funnel stages
      const [
        totalTasksCreated,
        tasksMatched,
        tasksRequested,
        tasksConverted,
        bookingsStarted,
        bookingsCompleted,
      ] = await Promise.all([
        TaskModel.countDocuments(),
        TaskModel.countDocuments({ status: TaskStatus.MATCHED }),
        TaskModel.countDocuments({ status: TaskStatus.REQUESTED }),
        TaskModel.countDocuments({ status: TaskStatus.CONVERTED }),
        BookingModel.countDocuments({ status: BookingStatus.IN_PROGRESS }),
        BookingModel.countDocuments({ status: BookingStatus.COMPLETED }),
      ]);

      // Calculate drop-off rates
      const matchRate =
        totalTasksCreated > 0 ? (tasksMatched / totalTasksCreated) * 100 : 0;
      const requestRate =
        tasksMatched > 0 ? (tasksRequested / tasksMatched) * 100 : 0;
      const conversionRate =
        tasksRequested > 0 ? (tasksConverted / tasksRequested) * 100 : 0;
      const startRate =
        tasksConverted > 0 ? (bookingsStarted / tasksConverted) * 100 : 0;
      const completionRate =
        bookingsStarted > 0 ? (bookingsCompleted / bookingsStarted) * 100 : 0;

      return res.status(200).json({
        success: true,
        message: "Funnel analysis retrieved successfully",
        data: {
          funnel: {
            tasksCreated: totalTasksCreated,
            tasksMatched: tasksMatched,
            tasksRequested: tasksRequested,
            tasksConverted: tasksConverted,
            bookingsStarted: bookingsStarted,
            bookingsCompleted: bookingsCompleted,
          },
          rates: {
            matchRate: Number(matchRate.toFixed(2)),
            requestRate: Number(requestRate.toFixed(2)),
            conversionRate: Number(conversionRate.toFixed(2)),
            startRate: Number(startRate.toFixed(2)),
            completionRate: Number(completionRate.toFixed(2)),
          },
        },
      });
    } catch (error) {
      return handleError(res, error, "Failed to retrieve funnel analysis");
    }
  }
}
