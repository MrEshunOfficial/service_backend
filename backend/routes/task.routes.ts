// routes/task.routes.ts
import { Router } from "express";
import taskController from "../controllers/task.controller";
import { authenticateToken } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { UserRole } from "../types/base.types";

const router = Router();

/**
 * Public routes (no authentication required)
 */
// Search tasks - may be public depending on requirements
router.get("/search", taskController.searchTasks);

/**
 * Customer routes
 */
// Create a new task (customers only)
router.post(
  "/",
  authenticateToken,
  requireRole([UserRole.CUSTOMER]),
  taskController.createTask
);

// Publish task (customers only)
router.post(
  "/:taskId/publish",
  authenticateToken,
  requireRole([UserRole.CUSTOMER]),
  taskController.publishTask
);

// Get customer's tasks
router.get(
  "/customer/my-tasks",
  authenticateToken,
  requireRole([UserRole.CUSTOMER]),
  taskController.getMyTasks
);

// Get customer statistics
router.get(
  "/customer/stats",
  authenticateToken,
  requireRole([UserRole.CUSTOMER]),
  taskController.getCustomerStats
);

// Request a provider for a task (customers only)
router.post(
  "/request-provider",
  authenticateToken,
  requireRole([UserRole.CUSTOMER]),
  taskController.requestProvider
);

// Update task (customers only)
router.put(
  "/:taskId",
  authenticateToken,
  requireRole([UserRole.CUSTOMER]),
  taskController.updateTask
);

// Delete task (customers only)
router.delete(
  "/:taskId",
  authenticateToken,
  requireRole([UserRole.CUSTOMER]),
  taskController.deleteTask
);

/**
 * Provider routes
 */
// Get floating tasks (providers only)
router.get(
  "/floating",
  authenticateToken,
  requireRole([UserRole.PROVIDER]),
  taskController.getFloatingTasks
);

// Get tasks where provider was matched
router.get(
  "/provider/matched",
  authenticateToken,
  requireRole([UserRole.PROVIDER]),
  taskController.getMatchedTasks
);

// Get provider statistics
router.get(
  "/provider/stats",
  authenticateToken,
  requireRole([UserRole.PROVIDER]),
  taskController.getProviderStats
);

// Express interest in floating task (providers only)
router.post(
  "/express-interest",
  authenticateToken,
  requireRole([UserRole.PROVIDER]),
  taskController.expressInterest
);

// Accept customer's request (providers only)
router.post(
  "/:taskId/accept",
  authenticateToken,
  requireRole([UserRole.PROVIDER]),
  taskController.acceptRequest
);

// Decline customer's request (providers only)
router.post(
  "/:taskId/decline",
  authenticateToken,
  requireRole([UserRole.PROVIDER]),
  taskController.declineRequest
);

// Start task (providers only)
router.post(
  "/:taskId/start",
  authenticateToken,
  requireRole([UserRole.PROVIDER]),
  taskController.startTask
);

// Complete task (providers only)
router.post(
  "/:taskId/complete",
  authenticateToken,
  requireRole([UserRole.PROVIDER]),
  taskController.completeTask
);

/**
 * Shared routes (customer or provider)
 */
// Get task by ID
router.get("/:taskId", authenticateToken, taskController.getTask);

// Cancel task (customer or assigned provider)
router.post("/:taskId/cancel", authenticateToken, taskController.cancelTask);

export default router;
