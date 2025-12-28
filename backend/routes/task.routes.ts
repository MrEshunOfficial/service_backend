// routes/task.routes.ts

import { Router } from "express";

import { authenticateToken, requireAdmin } from "../middleware/auth.middleware";
import {
  requireCustomer,
  requireProvider,
} from "../middleware/role.middleware";
import {
  createTask,
  getMyTasks,
  getTaskById,
  updateTask,
  requestProvider,
  cancelTask,
  deleteTask,
  rematchTask,
  getMatchedTasks,
  getFloatingTasks,
  getActiveTasks,
  getTaskDetails,
  expressInterest,
  respondToRequest,
  startTask,
  completeTask,
  providerCancelTask,
  getAllTasks,
  getTaskStatistics,
} from "../controllers/tasks/task.controller";

const router = Router();

/**
 * =============================================================================
 * CUSTOMER TASK ROUTES
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
 * @query   status?, includeDeleted?
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
 * @desc    Update a task
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
 * @desc    Cancel a task (customer side)
 * @access  Private (Customer only - owner)
 * @params  taskId
 * @body    { reason? }
 */
router.post("/:taskId/cancel", authenticateToken, requireCustomer, cancelTask);

/**
 * @route   DELETE /api/tasks/:taskId
 * @desc    Delete a task (soft delete)
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
 * =============================================================================
 * PROVIDER TASK ROUTES
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
 * @route   GET /api/tasks/provider/active
 * @desc    Get active tasks (tasks provider is working on)
 * @access  Private (Provider only)
 */
router.get(
  "/provider/active",
  authenticateToken,
  requireProvider,
  getActiveTasks
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
 * @desc    Respond to a task request (accept or reject)
 * @access  Private (Provider only)
 * @params  taskId
 * @body    { action: 'accept' | 'reject', message? }
 */
router.post(
  "/:taskId/respond",
  authenticateToken,
  requireProvider,
  respondToRequest
);

/**
 * @route   POST /api/tasks/:taskId/start
 * @desc    Start working on an accepted task
 * @access  Private (Provider only - assigned)
 * @params  taskId
 */
router.post("/:taskId/start", authenticateToken, requireProvider, startTask);

/**
 * @route   POST /api/tasks/:taskId/complete
 * @desc    Mark a task as complete
 * @access  Private (Provider only - assigned)
 * @params  taskId
 */
router.post(
  "/:taskId/complete",
  authenticateToken,
  requireProvider,
  completeTask
);

/**
 * @route   POST /api/tasks/:taskId/provider-cancel
 * @desc    Cancel a task (provider side)
 * @access  Private (Provider only - assigned)
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
 * ADMIN TASK ROUTES
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

export default router;
