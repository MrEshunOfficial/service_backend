// controllers/tasks/task.controller.ts - REFACTORED

import { AdminTaskHandlers } from "./handlers/admin.task.handers";
import { CustomerTaskHandlers } from "./handlers/customer.task.handler";
import { ProviderTaskHandlers } from "./handlers/provider.task.handlers";

/**
 * Task Controller - REFACTORED
 *
 * Handles HTTP requests for task and booking management endpoints.
 * Delegates to specialized handler classes for better organization.
 * Updated to support Task (discovery) → Booking (execution) architecture.
 */
export class TaskController {
  private customerHandler: typeof CustomerTaskHandlers;
  private providerHandler: typeof ProviderTaskHandlers;
  private adminHandler: typeof AdminTaskHandlers;

  // =========================================================================
  // CUSTOMER TASK OPERATIONS
  // =========================================================================
  public createTask;
  public getMyTasks;
  public getTaskById;
  public updateTask;
  public requestProvider;
  public cancelTask;
  public deleteTask;
  public rematchTask;

  // ✅ NEW: Customer Booking Operations
  public getMyBookings;
  public getBookingById;
  public cancelBooking;
  public getTaskWithBooking;
  public getCustomerDashboard;
  public getCustomerHistory;

  // =========================================================================
  // PROVIDER TASK OPERATIONS
  // =========================================================================
  public getMatchedTasks;
  public getFloatingTasks;
  public expressInterest;
  public respondToRequest;
  public providerCancelTask;
  public getTaskDetails;

  // ✅ NEW: Provider Booking Operations (replaces startTask/completeTask)
  public getActiveBookings;
  public startBooking;
  public completeBooking;
  public providerCancelBooking;
  public getBookingDetails;
  public getProviderDashboard;

  // =========================================================================
  // ADMIN OPERATIONS
  // =========================================================================
  public getAllTasks;
  public getTaskStatistics;

  // ✅ NEW: Admin Booking Operations
  public getAllBookings;
  public getBookingStatistics;
  public getPlatformStatistics;
  public getFunnelAnalysis;

  constructor() {
    this.customerHandler = CustomerTaskHandlers;
    this.providerHandler = ProviderTaskHandlers;
    this.adminHandler = AdminTaskHandlers;

    // =====================================================================
    // BIND CUSTOMER HANDLERS
    // =====================================================================

    // Task operations
    this.createTask = this.customerHandler.createTask.bind(
      this.customerHandler
    );
    this.getMyTasks = this.customerHandler.getMyTasks.bind(
      this.customerHandler
    );
    this.getTaskById = this.customerHandler.getTaskById.bind(
      this.customerHandler
    );
    this.updateTask = this.customerHandler.updateTask.bind(
      this.customerHandler
    );
    this.requestProvider = this.customerHandler.requestProvider.bind(
      this.customerHandler
    );
    this.cancelTask = this.customerHandler.cancelTask.bind(
      this.customerHandler
    );
    this.deleteTask = this.customerHandler.deleteTask.bind(
      this.customerHandler
    );
    this.rematchTask = this.customerHandler.rematchTask.bind(
      this.customerHandler
    );

    // ✅ NEW: Booking operations
    this.getMyBookings = this.customerHandler.getMyBookings.bind(
      this.customerHandler
    );
    this.getBookingById = this.customerHandler.getBookingById.bind(
      this.customerHandler
    );
    this.cancelBooking = this.customerHandler.cancelBooking.bind(
      this.customerHandler
    );
    this.getTaskWithBooking = this.customerHandler.getTaskWithBooking.bind(
      this.customerHandler
    );
    this.getCustomerDashboard = this.customerHandler.getDashboardMetrics.bind(
      this.customerHandler
    );
    this.getCustomerHistory = this.customerHandler.getCustomerHistory.bind(
      this.customerHandler
    );

    // =====================================================================
    // BIND PROVIDER HANDLERS
    // =====================================================================

    // Task operations
    this.getMatchedTasks = this.providerHandler.getMatchedTasks.bind(
      this.providerHandler
    );
    this.getFloatingTasks = this.providerHandler.getFloatingTasks.bind(
      this.providerHandler
    );
    this.expressInterest = this.providerHandler.expressInterest.bind(
      this.providerHandler
    );
    this.respondToRequest = this.providerHandler.respondToRequest.bind(
      this.providerHandler
    );
    this.providerCancelTask = this.providerHandler.cancelTask.bind(
      this.providerHandler
    );
    this.getTaskDetails = this.providerHandler.getTaskDetails.bind(
      this.providerHandler
    );

    // ✅ NEW: Booking operations (replaces old task operations)
    this.getActiveBookings = this.providerHandler.getActiveBookings.bind(
      this.providerHandler
    );
    this.startBooking = this.providerHandler.startBooking.bind(
      this.providerHandler
    );
    this.completeBooking = this.providerHandler.completeBooking.bind(
      this.providerHandler
    );
    this.providerCancelBooking = this.providerHandler.cancelBooking.bind(
      this.providerHandler
    );
    this.getBookingDetails = this.providerHandler.getBookingDetails.bind(
      this.providerHandler
    );
    this.getProviderDashboard = this.providerHandler.getDashboardMetrics.bind(
      this.providerHandler
    );

    // =====================================================================
    // BIND ADMIN HANDLERS
    // =====================================================================

    // Task operations
    this.getAllTasks = this.adminHandler.getAllTasks.bind(this.adminHandler);
    this.getTaskStatistics = this.adminHandler.getTaskStatistics.bind(
      this.adminHandler
    );

    // ✅ NEW: Booking operations
    this.getAllBookings = this.adminHandler.getAllBookings.bind(
      this.adminHandler
    );
    this.getBookingStatistics = this.adminHandler.getBookingStatistics.bind(
      this.adminHandler
    );
    this.getPlatformStatistics = this.adminHandler.getPlatformStatistics.bind(
      this.adminHandler
    );
    this.getFunnelAnalysis = this.adminHandler.getFunnelAnalysis.bind(
      this.adminHandler
    );
  }
}

// Create and export a singleton instance
const taskController = new TaskController();

// =========================================================================
// EXPORT INDIVIDUAL HANDLERS FOR USE IN ROUTES
// =========================================================================

export const {
  // Customer Task Operations
  createTask,
  getMyTasks,
  getTaskById,
  updateTask,
  requestProvider,
  cancelTask,
  deleteTask,
  rematchTask,

  // ✅ NEW: Customer Booking Operations
  getMyBookings,
  getBookingById,
  cancelBooking,
  getTaskWithBooking,
  getCustomerDashboard,
  getCustomerHistory,

  // Provider Task Operations
  getMatchedTasks,
  getFloatingTasks,
  expressInterest,
  respondToRequest,
  providerCancelTask,
  getTaskDetails,

  // ✅ NEW: Provider Booking Operations
  getActiveBookings,
  startBooking,
  completeBooking,
  providerCancelBooking,
  getBookingDetails,
  getProviderDashboard,

  // Admin Operations
  getAllTasks,
  getTaskStatistics,

  // ✅ NEW: Admin Booking Operations
  getAllBookings,
  getBookingStatistics,
  getPlatformStatistics,
  getFunnelAnalysis,
} = taskController;
