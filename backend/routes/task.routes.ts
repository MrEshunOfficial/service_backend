// routes/task.routes.ts - REFACTORED

import { Router } from "express";
import { authenticateToken, requireAdmin } from "../middleware/auth.middleware";
import {
  requireCustomer,
  requireProvider,
} from "../middleware/role.middleware";
import {
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
} from "../controllers/tasks/task.controller";

const router = Router();

/**
 * =============================================================================
 * CUSTOMER TASK ROUTES (Discovery Phase)
 * =============================================================================
 * All routes require authentication and customer role
 */

/**
 * @route   POST /api/tasks
 * @desc    Create a new task
 * @access  Private (Customer only)
 * @body    { title, description, customerLocation, schedule, category?, tags?, estimatedBudget?, matchingStrategy? }
 */
router.post("/", authenticateToken, requireCustomer, createTask);

/**
 * @route   GET /api/tasks/my-tasks
 * @desc    Get all tasks for the authenticated customer
 * @access  Private (Customer only)
 * @query   status?, includeDeleted?, includeConverted?
 */
router.get("/my-tasks", authenticateToken, requireCustomer, getMyTasks);

/**
 * @route   GET /api/tasks/:taskId
 * @desc    Get a specific task by ID (customer view)
 * @access  Private (Customer only - owner)
 * @params  taskId
 */
router.get("/:taskId", authenticateToken, requireCustomer, getTaskById);

/**
 * @route   PATCH /api/tasks/:taskId
 * @desc    Update a task (only in discovery phase)
 * @access  Private (Customer only - owner)
 * @params  taskId
 * @body    { title?, description?, customerLocation?, schedule? }
 */
router.patch("/:taskId", authenticateToken, requireCustomer, updateTask);

/**
 * @route   POST /api/tasks/:taskId/request-provider
 * @desc    Request a specific provider for a task
 * @access  Private (Customer only - owner)
 * @params  taskId
 * @body    { providerId, message? }
 */
router.post(
  "/:taskId/request-provider",
  authenticateToken,
  requireCustomer,
  requestProvider
);

/**
 * @route   POST /api/tasks/:taskId/cancel
 * @desc    Cancel a task (only during discovery phase)
 * @access  Private (Customer only - owner)
 * @params  taskId
 * @body    { reason? }
 */
router.post("/:taskId/cancel", authenticateToken, requireCustomer, cancelTask);

/**
 * @route   DELETE /api/tasks/:taskId
 * @desc    Delete a task (soft delete, only in discovery phase)
 * @access  Private (Customer only - owner)
 * @params  taskId
 */
router.delete("/:taskId", authenticateToken, requireCustomer, deleteTask);

/**
 * @route   POST /api/tasks/:taskId/rematch
 * @desc    Re-run matching algorithm for a task
 * @access  Private (Customer only - owner)
 * @params  taskId
 * @body    { strategy?: 'intelligent' | 'location-only' }
 */
router.post(
  "/:taskId/rematch",
  authenticateToken,
  requireCustomer,
  rematchTask
);

/**
 * @route   GET /api/tasks/:taskId/with-booking
 * @desc    Get task with its booking (if converted)
 * @access  Private (Customer only - owner)
 * @params  taskId
 */
router.get(
  "/:taskId/with-booking",
  authenticateToken,
  requireCustomer,
  getTaskWithBooking
);

/**
 * =============================================================================
 * CUSTOMER BOOKING ROUTES (Execution Phase) ✅ NEW
 * =============================================================================
 */

/**
 * @route   GET /api/bookings/my-bookings
 * @desc    Get all bookings for the authenticated customer
 * @access  Private (Customer only)
 */
router.get(
  "/bookings/my-bookings",
  authenticateToken,
  requireCustomer,
  getMyBookings
);

/**
 * @route   GET /api/bookings/customer/:bookingId
 * @desc    Get specific booking details
 * @access  Private (Customer only - owner)
 * @params  bookingId
 */
router.get(
  "/bookings/customer/:bookingId",
  authenticateToken,
  requireCustomer,
  getBookingById
);

/**
 * @route   POST /api/bookings/customer/:bookingId/cancel
 * @desc    Cancel a booking (execution phase)
 * @access  Private (Customer only - owner)
 * @params  bookingId
 * @body    { reason }
 */
router.post(
  "/bookings/customer/:bookingId/cancel",
  authenticateToken,
  requireCustomer,
  cancelBooking
);

/**
 * @route   GET /api/tasks/customer/dashboard
 * @desc    Get customer dashboard metrics
 * @access  Private (Customer only)
 */
router.get(
  "/customer/dashboard",
  authenticateToken,
  requireCustomer,
  getCustomerDashboard
);

/**
 * @route   GET /api/customer/history
 * @desc    Get complete customer history (tasks + bookings)
 * @access  Private (Customer only)
 */
router.get(
  "/customer/history",
  authenticateToken,
  requireCustomer,
  getCustomerHistory
);

/**
 * =============================================================================
 * PROVIDER TASK ROUTES (Discovery Phase)
 * =============================================================================
 * All routes require authentication and provider role
 */

/**
 * @route   GET /api/tasks/provider/matched
 * @desc    Get tasks matched to the provider
 * @access  Private (Provider only)
 */
router.get(
  "/provider/matched",
  authenticateToken,
  requireProvider,
  getMatchedTasks
);

/**
 * @route   GET /api/tasks/provider/floating
 * @desc    Get floating tasks that provider can express interest in
 * @access  Private (Provider only)
 */
router.get(
  "/provider/floating",
  authenticateToken,
  requireProvider,
  getFloatingTasks
);

/**
 * @route   GET /api/tasks/provider/:taskId
 * @desc    Get task details (provider view)
 * @access  Private (Provider only - must have access)
 * @params  taskId
 */
router.get(
  "/provider/:taskId",
  authenticateToken,
  requireProvider,
  getTaskDetails
);

/**
 * @route   POST /api/tasks/:taskId/express-interest
 * @desc    Express interest in a floating task
 * @access  Private (Provider only)
 * @params  taskId
 * @body    { message? }
 */
router.post(
  "/:taskId/express-interest",
  authenticateToken,
  requireProvider,
  expressInterest
);

/**
 * @route   POST /api/tasks/:taskId/respond
 * @desc    Respond to a task request (accept → creates booking, or reject)
 * @access  Private (Provider only)
 * @params  taskId
 * @body    { action: 'accept' | 'reject', message? }
 * @returns { task, booking? } - booking included if action is 'accept'
 */
router.post(
  "/:taskId/respond",
  authenticateToken,
  requireProvider,
  respondToRequest
);

/**
 * @route   POST /api/tasks/:taskId/provider-cancel
 * @desc    Cancel a task (provider side, only during discovery phase)
 * @access  Private (Provider only - requested)
 * @params  taskId
 * @body    { reason? }
 */
router.post(
  "/:taskId/provider-cancel",
  authenticateToken,
  requireProvider,
  providerCancelTask
);

/**
 * =============================================================================
 * PROVIDER BOOKING ROUTES (Execution Phase) ✅ NEW
 * =============================================================================
 */

/**
 * @route   GET /api/tasks/provider/active
 * @desc    Get active bookings (replaces getActiveTasks)
 * @access  Private (Provider only)
 */
router.get(
  "/provider/active",
  authenticateToken,
  requireProvider,
  getActiveBookings
);

/**
 * @route   POST /api/bookings/provider/:bookingId/start
 * @desc    Start working on a booking (replaces startTask)
 * @access  Private (Provider only - assigned)
 * @params  bookingId
 */
router.post(
  "/bookings/provider/:bookingId/start",
  authenticateToken,
  requireProvider,
  startBooking
);

/**
 * @route   POST /api/bookings/provider/:bookingId/complete
 * @desc    Mark a booking as complete (replaces completeTask)
 * @access  Private (Provider only - assigned)
 * @params  bookingId
 * @body    { finalPrice? }
 */
router.post(
  "/bookings/provider/:bookingId/complete",
  authenticateToken,
  requireProvider,
  completeBooking
);

/**
 * @route   POST /api/bookings/provider/:bookingId/cancel
 * @desc    Cancel a booking (provider side, execution phase)
 * @access  Private (Provider only - assigned)
 * @params  bookingId
 * @body    { reason }
 */
router.post(
  "/bookings/provider/:bookingId/cancel",
  authenticateToken,
  requireProvider,
  providerCancelBooking
);

/**
 * @route   GET /api/bookings/provider/:bookingId
 * @desc    Get booking details with task info
 * @access  Private (Provider only - assigned)
 * @params  bookingId
 */
router.get(
  "/bookings/provider/:bookingId",
  authenticateToken,
  requireProvider,
  getBookingDetails
);

/**
 * @route   GET /api/tasks/provider/dashboard
 * @desc    Get provider dashboard metrics
 * @access  Private (Provider only)
 */
router.get(
  "/provider/dashboard",
  authenticateToken,
  requireProvider,
  getProviderDashboard
);

/**
 * =============================================================================
 * ADMIN ROUTES ✅ UPDATED
 * =============================================================================
 * All routes require authentication and admin role
 */

/**
 * @route   GET /api/tasks/admin/all
 * @desc    Get all tasks (admin view)
 * @access  Private (Admin only)
 * @query   status?, page?, limit?
 */
router.get("/admin/all", authenticateToken, requireAdmin, getAllTasks);

/**
 * @route   GET /api/tasks/admin/statistics
 * @desc    Get task statistics
 * @access  Private (Admin only)
 */
router.get(
  "/admin/statistics",
  authenticateToken,
  requireAdmin,
  getTaskStatistics
);

/**
 * @route   GET /api/bookings/admin/all
 * @desc    Get all bookings (admin view)
 * @access  Private (Admin only)
 * @query   status?, page?, limit?
 */
router.get(
  "/bookings/admin/all",
  authenticateToken,
  requireAdmin,
  getAllBookings
);

/**
 * @route   GET /api/bookings/admin/statistics
 * @desc    Get booking statistics
 * @access  Private (Admin only)
 */
router.get(
  "/bookings/admin/statistics",
  authenticateToken,
  requireAdmin,
  getBookingStatistics
);

/**
 * @route   GET /api/admin/platform-statistics
 * @desc    Get comprehensive platform statistics (tasks + bookings)
 * @access  Private (Admin only)
 */
router.get(
  "/admin/platform-statistics",
  authenticateToken,
  requireAdmin,
  getPlatformStatistics
);

/**
 * @route   GET /api/admin/funnel-analysis
 * @desc    Get task-to-booking conversion funnel analysis
 * @access  Private (Admin only)
 */
router.get(
  "/admin/funnel-analysis",
  authenticateToken,
  requireAdmin,
  getFunnelAnalysis
);

export default router;
