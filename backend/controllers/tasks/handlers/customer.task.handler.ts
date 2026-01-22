// handlers/customer-task.handlers.ts - REFACTORED

import { Response } from "express";
import { Types } from "mongoose";
import { taskService } from "../../../services/tasks/task.service";
import { TaskBookingService } from "../../../services/tasks/task-booking.service";
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
 * Customer Task Handlers - REFACTORED
 * Handles all task operations from the customer's perspective
 * Updated to work with Task (discovery) → Booking (execution) flow
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

      if (!schedule.priority) {
        return res.status(400).json({
          success: false,
          message: "Schedule priority is required",
        });
      }

      if (!customerLocation.ghanaPostGPS) {
        return res.status(400).json({
          success: false,
          message: "Ghana Post GPS address is required",
        });
      }

      if (
        category &&
        !validateObjectId(
          category instanceof Types.ObjectId ? category.toString() : category
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }

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
   * ✅ UPDATED: Get all tasks for the authenticated customer
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

      const { status, includeDeleted, includeConverted } = req.query;

      const result = await taskService.getCustomerTasks(customerId, {
        status: status as TaskStatus | undefined,
        includeDeleted: includeDeleted === "true",
        includeConverted: includeConverted !== "false",
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
   * ✅ UPDATED: Cancel a task (only during discovery phase)
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

  /**
   * ✅ NEW: Get all bookings for the customer
   * GET /api/bookings/my-bookings
   */
  static async getMyBookings(req: AuthenticatedRequest, res: Response) {
    try {
      const customerId = req.userId;

      if (!customerId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User not authenticated",
        });
      }

      const { BookingModel } = await import("../../../models/booking.model");

      const bookings = await BookingModel.findByClient(customerId);

      return res.status(200).json({
        success: true,
        message: "Bookings retrieved successfully",
        data: {
          bookings,
          count: bookings.length,
        },
      });
    } catch (error) {
      return handleError(res, error, "Failed to retrieve bookings");
    }
  }

 /**
   * ✅ FIXED: Get booking details
   * GET /api/bookings/:bookingId
   */
// handlers/customer-task.handlers.ts - CRITICAL FIXES ONLY
// Copy these methods to replace the existing ones in your customer-task.handlers.ts

/**
 * ✅ FIXED: Get booking details - Properly handles populated fields
 * GET /api/tasks/bookings/:bookingId
 * 
 * REPLACE the existing getBookingById method with this one
 */
static async getBookingById(req: AuthenticatedRequest, res: Response) {
  try {
    const { bookingId } = req.params;
    const customerId = req.userId;

    if (!customerId) {
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

    const booking = await TaskBookingService.getBookingWithTask(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // ✅ FIXED: More robust ID extraction
    const getIdString = (field: any): string | null => {
      if (!field) return null;
      if (typeof field === 'string') return field;
      if (field._id) return field._id.toString();
      if (typeof field.toString === 'function') return field.toString();
      return null;
    };

    const bookingClientId = getIdString(booking.clientId);
    
    // Verify ownership
    if (!bookingClientId || bookingClientId !== customerId) {
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
      error.message || "Failed to retrieve booking"
    );
  }
}

/**
 * ✅ FIXED: Get task by ID - Properly handles populated fields
 * GET /api/tasks/:taskId
 * 
 * REPLACE the existing getTaskById method with this one
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

    // ✅ FIXED: More robust ID extraction
    const getIdString = (field: any): string | null => {
      if (!field) return null;
      if (typeof field === 'string') return field;
      if (field._id) return field._id.toString();
      if (typeof field.toString === 'function') return field.toString();
      return null;
    };

    const taskCustomerId = getIdString(result.task.customerId);
    
    if (!taskCustomerId || taskCustomerId !== customerId) {
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
 * ✅ FIXED: Cancel booking - Properly validates ownership
 * POST /api/tasks/bookings/:bookingId/cancel
 */


  static async cancelBooking(req: AuthenticatedRequest, res: Response) {
  try {
    const { bookingId } = req.params;
    const customerId = req.userId;
    const { reason } = req.body;

    if (!customerId) {
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

    // ✅ FIX: Validate ownership before attempting cancellation
    const booking = await TaskBookingService.getBookingWithTask(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const getIdString = (field: any): string | null => {
      if (!field) return null;
      if (typeof field === 'string') return field;
      if (field._id) return field._id.toString();
      if (typeof field.toString === 'function') return field.toString();
      return null;
    };

    const bookingClientId = getIdString(booking.clientId);
    
    if (!bookingClientId || bookingClientId !== customerId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You don't have access to this booking",
      });
    }

    // Now proceed with cancellation
    const cancelledBooking = await TaskBookingService.cancelBooking(
      bookingId,
      reason,
      UserRole.CUSTOMER,
      customerId
    );

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      data: {
        booking: cancelledBooking,
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
   * ✅ NEW: Get task with its booking (if converted)
   * GET /api/tasks/:taskId/with-booking
   */
  static async getTaskWithBooking(req: AuthenticatedRequest, res: Response) {
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

      const result = await taskService.getTaskWithBooking(taskId);

      if (result.error) {
        return res.status(404).json({
          success: false,
          message: result.message,
        });
      }

      // Verify ownership
      if (result.task.customerId.toString() !== customerId) {
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
      return handleError(res, error, "Failed to retrieve task with booking");
    }
  }

  /**
   * ✅ NEW: Get customer dashboard metrics
   * GET /api/tasks/customer/dashboard
   */
  static async getDashboardMetrics(req: AuthenticatedRequest, res: Response) {
    try {
      const customerId = req.userId;

      if (!customerId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User not authenticated",
        });
      }

      const metrics = await TaskBookingService.getDashboardMetrics(
        customerId,
        UserRole.CUSTOMER
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

  /**
   * ✅ NEW: Get customer history (tasks + bookings)
   * GET /api/customer/history
   */
  static async getCustomerHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const customerId = req.userId;

      if (!customerId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User not authenticated",
        });
      }

      const history = await TaskBookingService.getCustomerHistory(customerId);

      return res.status(200).json({
        success: true,
        message: "Customer history retrieved successfully",
        data: history,
      });
    } catch (error) {
      return handleError(res, error, "Failed to retrieve customer history");
    }
  }
}
