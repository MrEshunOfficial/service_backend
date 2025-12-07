// routes/task.routes.ts
import { Router } from "express";
import taskController from "../controllers/task.controller";
import { authenticateToken, optionalAuth } from "../middleware/auth.middleware";
import {
  requireCustomer,
  requireProvider,
  requireCustomerOrProvider,
} from "../middleware/role.middleware";

const router = Router();

/**
 * PUBLIC OR OPTIONAL AUTH ROUTES (SPECIFIC PATHS FIRST)
 * These must come BEFORE /:taskId to avoid conflicts
 */

// Search tasks
router.get(
  "/search",
  optionalAuth,
  taskController.searchTasks
);

// Get recently posted tasks
router.get(
  "/recent",
  optionalAuth,
  taskController.getRecentlyPostedTasks
);

// Get all unmatched posted tasks
router.get(
  "/unmatched",
  optionalAuth,
  taskController.getAllUnmatchedPostedTasks
);

/**
 * CUSTOMER-ONLY ROUTES (SPECIFIC PATHS)
 */

// Get customer statistics
router.get(
  "/customer/stats",
  authenticateToken,
  requireCustomer,
  taskController.getCustomerStats
);

// Get my tasks as a customer
router.get(
  "/customer/my-tasks",
  authenticateToken,
  requireCustomer,
  taskController.getMyTasks
);

// Request a specific provider (customer only)
router.post(
  "/request-provider",
  authenticateToken,
  requireCustomer,
  taskController.requestProvider
);

/**
 * PROVIDER-ONLY ROUTES (SPECIFIC PATHS)
 */

// Get floating tasks (provider only)
router.get(
  "/floating",
  authenticateToken,
  requireProvider,
  taskController.getFloatingTasks
);

// Get matched tasks (provider only)
router.get(
  "/provider/matched",
  authenticateToken,
  requireProvider,
  taskController.getMatchedTasks
);

// Get provider statistics
router.get(
  "/provider/stats",
  authenticateToken,
  requireProvider,
  taskController.getProviderStats
);

// Express interest in a task (provider only)
router.post(
  "/express-interest",
  authenticateToken,
  requireProvider,
  taskController.expressInterest
);

/**
 * PARAMETERIZED ROUTES (/:taskId)
 * These MUST come after all specific paths to avoid conflicts
 */

// Get task by ID (optional auth to show different info based on role)
router.get(
  "/:taskId",
  optionalAuth,
  taskController.getTask
);

// Create a new task (customer only)
router.post(
  "/",
  authenticateToken,
  requireCustomer,
  taskController.createTask
);

// Update task (customer only)
router.put(
  "/:taskId",
  authenticateToken,
  requireCustomer,
  taskController.updateTask
);

// Delete task (customer only)
router.delete(
  "/:taskId",
  authenticateToken,
  requireCustomer,
  taskController.deleteTask
);

// Publish a task (customer only)
router.post(
  "/:taskId/publish",
  authenticateToken,
  requireCustomer,
  taskController.publishTask
);

// Accept customer request (provider only)
router.post(
  "/:taskId/accept",
  authenticateToken,
  requireProvider,
  taskController.acceptRequest
);

// Decline customer request (provider only)
router.post(
  "/:taskId/decline",
  authenticateToken,
  requireProvider,
  taskController.declineRequest
);

// Start task (provider only)
router.post(
  "/:taskId/start",
  authenticateToken,
  requireProvider,
  taskController.startTask
);

// Complete task (provider only)
router.post(
  "/:taskId/complete",
  authenticateToken,
  requireProvider,
  taskController.completeTask
);

// Cancel task (both customer and provider can cancel)
router.post(
  "/:taskId/cancel",
  authenticateToken,
  requireCustomerOrProvider,
  taskController.cancelTask
);

export default router;