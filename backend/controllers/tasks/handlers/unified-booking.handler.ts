// handlers/unified-booking.handler.ts - FIXED
// Unified handler that works for both customers and providers

import { Response } from "express";
import { TaskBookingService } from "../../../services/tasks/task-booking.service";
import { UserRole } from "../../../types/base.types";
import { AuthenticatedRequest } from "../../../types/user.types";
import {
  handleError,
  validateObjectId,
} from "../../../utils/controller-utils/controller.utils";
import { ProviderModel } from "../../../models/profiles/provider.model";
import { ProfileModel } from "../../../models/profiles/userProfile.model";

/**
 * Helper to extract ID from potentially populated field
 */
const getIdString = (field: any): string | null => {
  if (!field) return null;
  if (typeof field === 'string') return field;
  if (field._id) return field._id.toString();
  if (field.toString) return field.toString();
  return null;
};

/**
 * Helper to get user role from profile
 */
async function getUserRole(userId: string): Promise<UserRole | null> {
  const userProfile = await ProfileModel.findOne({
    userId: userId,
    isDeleted: { $ne: true },
  });

  if (!userProfile) {
    return null;
  }

  return userProfile.role as UserRole;
}

/**
 * Helper to get provider profile from userId
 */
async function getProviderProfile(userId: string) {
  const userProfile = await ProfileModel.findOne({
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
 * ✅ UNIFIED: Get booking details - works for both customers and providers
 * GET /api/tasks/bookings/:bookingId
 */
export async function getUnifiedBookingById(
  req: AuthenticatedRequest,
  res: Response
) {
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

    // Get user role
    const userRole = await getUserRole(userId);
    
    if (!userRole) {
      return res.status(403).json({
        success: false,
        message: "User profile not found",
      });
    }

    const booking = await TaskBookingService.getBookingWithTask(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Extract IDs safely
    const bookingClientId = getIdString(booking.clientId);
    const bookingProviderId = getIdString(booking.providerId);

    // ✅ Verify access based on role
    let hasAccess = false;

    if (userRole === UserRole.CUSTOMER) {
      // Customer can view their own bookings
      hasAccess = bookingClientId === userId;
    } else if (userRole === UserRole.PROVIDER) {
      // Provider needs to check their provider profile
      try {
        const provider = await getProviderProfile(userId);
        hasAccess = bookingProviderId === provider._id.toString();
      } catch (error) {
        hasAccess = false;
      }
    }

    if (!hasAccess) {
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
 * ✅ UNIFIED: Cancel booking - works for both customers and providers
 * POST /api/tasks/bookings/:bookingId/cancel
 */
export async function cancelUnifiedBooking(
  req: AuthenticatedRequest,
  res: Response
) {
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

    // Get user role
    const userRole = await getUserRole(userId);
    
    if (!userRole) {
      return res.status(403).json({
        success: false,
        message: "User profile not found",
      });
    }

    // Determine the actual ID to pass to the service
    let actorId = userId;
    
    if (userRole === UserRole.PROVIDER) {
      const provider = await getProviderProfile(userId);
      actorId = provider._id.toString();
    }

    const booking = await TaskBookingService.cancelBooking(
      bookingId,
      reason,
      userRole as UserRole.CUSTOMER | UserRole.PROVIDER,
      actorId
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