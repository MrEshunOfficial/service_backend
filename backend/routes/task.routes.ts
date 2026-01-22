// routes/task.routes.ts - FIXED

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
  getMyBookings,
  getTaskWithBooking,
  getCustomerDashboard,
  getCustomerHistory,
  getMatchedTasks,
  getFloatingTasks,
  expressInterest,
  respondToRequest,
  providerCancelTask,
  getTaskDetails,
  getActiveBookings,
  startBooking,
  completeBooking,
  getProviderDashboard,
  getAllTasks,
  getTaskStatistics,
  getAllBookings,
  getBookingStatistics,
  getPlatformStatistics,
  getFunnelAnalysis,
  getRequestedTasks,
} from "../controllers/tasks/task.controller";

// ✅ Import unified booking handlers
import {
  getUnifiedBookingById,
  cancelUnifiedBooking,
} from "../controllers/tasks/handlers/unified-booking.handler";

const router = Router();

// ==========================================
// ADMIN ROUTES
// ==========================================
router.get("/admin/all", authenticateToken, requireAdmin, getAllTasks);
router.get("/admin/statistics", authenticateToken, requireAdmin, getTaskStatistics);
router.get("/admin/platform-statistics", authenticateToken, requireAdmin, getPlatformStatistics);
router.get("/admin/funnel-analysis", authenticateToken, requireAdmin, getFunnelAnalysis);

// ==========================================
// CUSTOMER DASHBOARD & HISTORY ROUTES
// ==========================================
router.get("/customer/dashboard", authenticateToken, requireCustomer, getCustomerDashboard);
router.get("/customer/history", authenticateToken, requireCustomer, getCustomerHistory);

// ==========================================
// CUSTOMER TASK ROUTES (more specific first)
// ==========================================
router.get("/my-tasks", authenticateToken, requireCustomer, getMyTasks);

// ==========================================
// PROVIDER TASK ROUTES (more specific first)
// ==========================================
router.get("/provider/matched", authenticateToken, requireProvider, getMatchedTasks);
router.get("/provider/floating", authenticateToken, requireProvider, getFloatingTasks);
router.get("/provider/requested", authenticateToken, requireProvider, getRequestedTasks);
router.get("/provider/active", authenticateToken, requireProvider, getActiveBookings);
router.get("/provider/dashboard", authenticateToken, requireProvider, getProviderDashboard);
router.get("/provider/:taskId", authenticateToken, requireProvider, getTaskDetails);

// ==========================================
// BOOKING ROUTES - FIXED
// ==========================================
// ✅ Customer-specific booking routes
router.get("/bookings/my-bookings", authenticateToken, requireCustomer, getMyBookings);

// ✅ Admin booking routes
router.get("/bookings/admin/all", authenticateToken, requireAdmin, getAllBookings);
router.get("/bookings/admin/statistics", authenticateToken, requireAdmin, getBookingStatistics);

// ✅ CRITICAL FIX: Use unified handler that validates ownership internally
// This allows both customers AND providers to view their bookings
router.get("/bookings/:bookingId", authenticateToken, getUnifiedBookingById);

// ✅ CRITICAL FIX: Use unified handler that validates ownership internally
// This allows both customers AND providers to cancel their bookings
router.post("/bookings/:bookingId/cancel", authenticateToken, cancelUnifiedBooking);

// ✅ Provider-only booking actions
router.post("/bookings/:bookingId/start", authenticateToken, requireProvider, startBooking);
router.post("/bookings/:bookingId/complete", authenticateToken, requireProvider, completeBooking);

// ==========================================
// TASK CREATION
// ==========================================
router.post("/", authenticateToken, requireCustomer, createTask);

// ==========================================
// TASK-SPECIFIC ROUTES (/:taskId/action - must come before /:taskId)
// ==========================================
router.get("/:taskId/with-booking", authenticateToken, requireCustomer, getTaskWithBooking);
router.post("/:taskId/request-provider", authenticateToken, requireCustomer, requestProvider);
router.post("/:taskId/cancel", authenticateToken, requireCustomer, cancelTask);
router.post("/:taskId/rematch", authenticateToken, requireCustomer, rematchTask);

// PROVIDER-SPECIFIC TASK ACTIONS
router.post("/:taskId/express-interest", authenticateToken, requireProvider, expressInterest);
router.post("/:taskId/respond", authenticateToken, requireProvider, respondToRequest);
router.post("/:taskId/provider-cancel", authenticateToken, requireProvider, providerCancelTask);

// ==========================================
// GENERIC TASK ROUTES (must come LAST)
// ==========================================
router.patch("/:taskId", authenticateToken, requireCustomer, updateTask);
router.delete("/:taskId", authenticateToken, requireCustomer, deleteTask);
router.get("/:taskId", authenticateToken, requireCustomer, getTaskById);

export default router;