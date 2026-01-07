// handlers/provider-task.handlers.ts - REFACTORED

import { Response } from "express";
import { ProviderModel } from "../../../models/profiles/provider.model";
import { taskService } from "../../../services/tasks/task.service";
import { TaskBookingService } from "../../../services/tasks/task-booking.service";
import { UserRole } from "../../../types/base.types";
import { TaskStatus } from "../../../types/tasks.types";
import { AuthenticatedRequest } from "../../../types/user.types";
import {
  handleError,
  validateObjectId,
} from "../../../utils/controller-utils/controller.utils";

/**
 * Provider Task Handlers - REFACTORED
 * Handles all task operations from the provider's perspective
 * Updated to work with Task (discovery) → Booking (execution) flow
 */
export class ProviderTaskHandlers {
  /**
   * Helper method to get provider profile
   * First finds UserProfile by userId, then finds ProviderProfile by UserProfile._id
   */
  private static async getProviderProfile(userId: string) {
    const UserProfile = (
      await import("../../../models/profiles/userProfile.model")
    ).default;

    const userProfile = await UserProfile.findOne({
      userId: userId,
      isDeleted: { $ne: true },
    });

    if (!userProfile) {
      throw new Error("User profile not found");
    }

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

      const provider = await ProviderTaskHandlers.getProviderProfile(userId);

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

      const provider = await ProviderTaskHandlers.getProviderProfile(userId);

      if (!provider.locationData || !provider.locationData.ghanaPostGPS) {
        return res.status(400).json({
          success: false,
          message: "Provider location not set. Please update your profile.",
        });
      }

      const result = await taskService.getFloatingTasksForProvider(
        provider._id,
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
   * ✅ UPDATED: Get active bookings (replaced getActiveTasks)
   * GET /api/tasks/provider/active
   * Now returns bookings instead of tasks
   */
  static async getActiveBookings(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User not authenticated",
        });
      }

      const provider = await ProviderTaskHandlers.getProviderProfile(userId);

      // Import BookingModel
      const { BookingModel } = await import("../../../models/booking.model");

      const bookings = await BookingModel.findByProvider(
        provider._id.toString()
      );

      return res.status(200).json({
        success: true,
        message: "Active bookings retrieved successfully",
        data: {
          bookings,
          count: bookings.length,
        },
      });
    } catch (error) {
      return handleError(res, error, "Failed to retrieve active bookings");
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

      const provider = await ProviderTaskHandlers.getProviderProfile(userId);

      const result = await taskService.expressInterest(
        {
          taskId,
          message,
        },
        provider._id
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
   * ✅ UPDATED: Respond to a task request (accept or reject)
   * POST /api/tasks/:taskId/respond
   * Accept now creates a booking automatically
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

      const provider = await ProviderTaskHandlers.getProviderProfile(userId);

      const result = await taskService.respondToRequest(
        {
          taskId,
          action: action as "accept" | "reject",
          message,
        },
        provider._id.toString()
      );

      if (result.error) {
        return res.status(400).json({
          success: false,
          message: result.message,
          error: result.error,
        });
      }

      // ✅ NEW: If accepted, result includes both task and booking
      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          task: result.task,
          booking: result.booking, // ✅ Include booking if action was 'accept'
        },
      });
    } catch (error) {
      return handleError(res, error, "Failed to respond to request");
    }
  }

  /**
   * ✅ NEW: Start a booking (replaces startTask)
   * POST /api/bookings/:bookingId/start
   */
  static async startBooking(req: AuthenticatedRequest, res: Response) {
    try {
      const { bookingId } = req.params;
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User not authenticated",
        });
      }

      if (!validateObjectId(bookingId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking ID",
        });
      }

      const provider = await ProviderTaskHandlers.getProviderProfile(userId);

      const booking = await TaskBookingService.startBooking(
        bookingId,
        provider._id.toString()
      );

      return res.status(200).json({
        success: true,
        message: "Booking started successfully",
        data: {
          booking,
        },
      });
    } catch (error: any) {
      return handleError(
        res,
        error,
        error.message || "Failed to start booking"
      );
    }
  }

  /**
   * ✅ NEW: Complete a booking (replaces completeTask)
   * POST /api/bookings/:bookingId/complete
   */
  static async completeBooking(req: AuthenticatedRequest, res: Response) {
    try {
      const { bookingId } = req.params;
      const userId = req.userId;
      const { finalPrice } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User not authenticated",
        });
      }

      if (!validateObjectId(bookingId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking ID",
        });
      }

      const provider = await ProviderTaskHandlers.getProviderProfile(userId);

      const booking = await TaskBookingService.completeBooking(
        bookingId,
        provider._id.toString(),
        finalPrice
      );

      return res.status(200).json({
        success: true,
        message: "Booking completed successfully",
        data: {
          booking,
        },
      });
    } catch (error: any) {
      return handleError(
        res,
        error,
        error.message || "Failed to complete booking"
      );
    }
  }

  /**
   * ✅ UPDATED: Cancel a task or booking (provider side)
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

      const provider = await ProviderTaskHandlers.getProviderProfile(userId);

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
   * ✅ NEW: Cancel a booking
   * POST /api/bookings/:bookingId/cancel
   */
  static async cancelBooking(req: AuthenticatedRequest, res: Response) {
    try {
      const { bookingId } = req.params;
      const userId = req.userId;
      const { reason } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User not authenticated",
        });
      }

      if (!validateObjectId(bookingId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking ID",
        });
      }

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: "Cancellation reason is required",
        });
      }

      const provider = await ProviderTaskHandlers.getProviderProfile(userId);

      const booking = await TaskBookingService.cancelBooking(
        bookingId,
        reason,
        UserRole.PROVIDER,
        provider._id.toString()
      );

      return res.status(200).json({
        success: true,
        message: "Booking cancelled successfully",
        data: {
          booking,
        },
      });
    } catch (error: any) {
      return handleError(
        res,
        error,
        error.message || "Failed to cancel booking"
      );
    }
  }

  /**
   * ✅ UPDATED: Get a specific task details (provider view)
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

      const provider = await ProviderTaskHandlers.getProviderProfile(userId);
      const providerId = provider._id.toString();

      const result = await taskService.getTaskById(taskId);

      if (result.error || !result.task) {
        return res.status(404).json({
          success: false,
          message: result.message,
        });
      }

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
        (task.acceptedProvider &&
          task.acceptedProvider.providerId?.toString() === providerId) ||
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

  /**
   * ✅ NEW: Get booking details
   * GET /api/bookings/:bookingId
   */
  static async getBookingDetails(req: AuthenticatedRequest, res: Response) {
    try {
      const { bookingId } = req.params;
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User not authenticated",
        });
      }

      if (!validateObjectId(bookingId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking ID",
        });
      }

      const provider = await ProviderTaskHandlers.getProviderProfile(userId);

      const booking = await TaskBookingService.getBookingWithTask(bookingId);

      // Verify provider access
      if (booking.providerId.toString() !== provider._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You don't have access to this booking",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Booking retrieved successfully",
        data: {
          booking,
        },
      });
    } catch (error: any) {
      return handleError(
        res,
        error,
        error.message || "Failed to retrieve booking details"
      );
    }
  }

  /**
   * ✅ NEW: Get provider dashboard metrics
   * GET /api/tasks/provider/dashboard
   */
  static async getDashboardMetrics(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User not authenticated",
        });
      }

      const provider = await ProviderTaskHandlers.getProviderProfile(userId);

      const metrics = await TaskBookingService.getDashboardMetrics(
        provider._id.toString(),
        UserRole.PROVIDER
      );

      return res.status(200).json({
        success: true,
        message: "Dashboard metrics retrieved successfully",
        data: metrics,
      });
    } catch (error) {
      return handleError(res, error, "Failed to retrieve dashboard metrics");
    }
  }
}
