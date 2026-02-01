// services/task-booking.service.ts - COMPLETE WITH VALIDATION
// Handles the conversion from Task (discovery) to Booking (execution)

import { Types } from "mongoose";
import { BookingModel } from "../../models/booking.model";
import TaskModelInstance from "../../models/task.model";
import { ProviderModel } from "../../models/profiles/provider.model";
import { ServiceModel } from "../../models/service.model";
import { UserRole } from "../../types/base.types";
import { BookingStatus, PaymentStatus } from "../../types/booking.types";
import { TaskStatus } from "../../types/tasks.types";

export class TaskBookingService {
  /**
   * ✅ FIXED: Provider accepts a task - creates booking
   * This is the main handoff point from discovery to execution
   */
  static async acceptTaskAndCreateBooking(
    taskId: string | Types.ObjectId,
    providerId: string | Types.ObjectId,
    providerMessage?: string
  ) {
    console.log("=== ACCEPT TASK AND CREATE BOOKING ===");
    console.log("Task ID:", taskId);
    console.log("Provider ID:", providerId);

    // Find the task with populated data
    const task = await TaskModelInstance.findById(taskId)
      .populate("customerId")
      .populate("matchedProviders.providerId")
      .populate("matchedProviders.matchedServices");

    if (!task) {
      throw new Error("Task not found");
    }
    console.log("✅ Task found");
    console.log("Task Status:", task.status);

    // Validate task status
    if (task.status !== TaskStatus.REQUESTED) {
      throw new Error(
        `Task must be in REQUESTED status. Current status: ${task.status}`
      );
    }

    // Validate provider is the requested one
    console.log("Comparing provider IDs:");
    console.log("  Requested:", task.requestedProvider?.providerId.toString());
    console.log("  Current:", providerId.toString());

    if (
      task.requestedProvider?.providerId.toString() !== providerId.toString()
    ) {
      throw new Error("Only the requested provider can accept this task");
    }

    // Check if task is expired
    if (task.expiresAt && task.expiresAt < new Date()) {
      throw new Error("Task has expired");
    }

    // ✅ FIX 1: Find service with multiple fallback strategies
    let serviceId: Types.ObjectId | null = null;

    // Strategy 1: Check matched services from matching algorithm
    console.log("Finding provider services...");
    const matchedProvider = task.matchedProviders?.find(
      (mp) => mp.providerId.toString() === providerId.toString()
    );

    if (matchedProvider?.matchedServices && matchedProvider.matchedServices.length > 0) {
      serviceId = matchedProvider.matchedServices[0] as Types.ObjectId;
      console.log("✅ Found service from matched services:", serviceId);
    }

    // Strategy 2: If no matched service, find ANY active service from provider
    if (!serviceId) {
      console.log("No matched services found, searching provider's active services...");
      
      const providerProfile = await ProviderModel.findById(providerId)
        .populate('serviceOfferings');
      
      if (providerProfile?.serviceOfferings && providerProfile.serviceOfferings.length > 0) {
        // Get the first active service
        const firstService = providerProfile.serviceOfferings[0];
        serviceId = firstService._id as Types.ObjectId;
        console.log("✅ Found service from provider offerings:", serviceId);
      }
    }

    // Strategy 3: Search Service collection directly
    if (!serviceId) {
      console.log("No services in provider profile, searching Service collection...");
      
      const providerService = await ServiceModel.findOne({
        providerId: providerId,
        isActive: true,
        deletedAt: null,
      });

      if (providerService) {
        serviceId = providerService._id as Types.ObjectId;
        console.log("✅ Found service from Service collection:", serviceId);
      }
    }

    // Strategy 4: Use task category to find a relevant service
    if (!serviceId && task.category) {
      console.log("Trying to find service by task category...");
      
      const categoryService = await ServiceModel.findOne({
        providerId: providerId,
        categoryId: task.category,
        isActive: true,
        deletedAt: null,
      });

      if (categoryService) {
        serviceId = categoryService._id as Types.ObjectId;
        console.log("✅ Found service by category:", serviceId);
      }
    }

    // Final check
    if (!serviceId) {
      console.log("❌ No service found for provider");
      throw new Error(
        "No service found for this provider. The provider must have at least one active service to accept tasks."
      );
    }

    // Generate booking number
    const bookingNumber = await BookingModel.generateBookingNumber();
    console.log("✅ Generated booking number:", bookingNumber);

    // ✅ FIX 2: Ensure proper time slot with validation
    let timeSlot = task.schedule.timeSlot;
    if (!timeSlot || !timeSlot.start || !timeSlot.end) {
      console.log("⚠️ No valid time slot, using default business hours");
      timeSlot = {
        start: "09:00",
        end: "17:00",
      };
    }

    // ✅ FIX 3: Ensure valid scheduled date
    let scheduledDate = task.schedule.preferredDate;
    if (!scheduledDate || scheduledDate < new Date()) {
      console.log("⚠️ No valid scheduled date, using tomorrow");
      scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 1);
      scheduledDate.setHours(9, 0, 0, 0);
    }

    // ✅ Create the booking with proper enum values and validation
    const booking = await BookingModel.create({
      bookingNumber,
      taskId: task._id,
      clientId: task.customerId,
      providerId: providerId,
      serviceId: serviceId,
      serviceLocation: task.customerLocation,
      scheduledDate: scheduledDate,
      scheduledTimeSlot: timeSlot,
      serviceDescription: task.description,
      specialInstructions: providerMessage,
      estimatedPrice: task.estimatedBudget?.max || task.estimatedBudget?.min,
      currency: task.estimatedBudget?.currency || "GHS",
      status: BookingStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PENDING,
      statusHistory: [
        {
          status: BookingStatus.CONFIRMED,
          timestamp: new Date(),
          actor: new Types.ObjectId(providerId.toString()),
          actorRole: UserRole.PROVIDER,
          message: providerMessage || "Provider accepted the task",
        },
      ],
    });

    console.log("✅ Booking created:", booking._id);

    // Update task to CONVERTED status
    task.status = TaskStatus.CONVERTED;
    task.acceptedProvider = {
      providerId: new Types.ObjectId(providerId.toString()),
      acceptedAt: new Date(),
      providerMessage: providerMessage,
    };
    task.convertedToBookingId = booking._id;
    task.convertedAt = new Date();
    await task.save();

    console.log("✅ Task converted to booking");

    // Populate and return
    const populatedBooking = await booking.populate([
      { path: "clientId", select: "name email phone" },
      { path: "providerId", select: "businessName locationData profile" },
      { path: "serviceId", select: "title description pricing" },
    ]);

    return {
      task,
      booking: populatedBooking,
    };
  }

  /**
   * Provider rejects a task request
   * Task returns to previous state (matched or floating)
   */
  static async rejectTaskRequest(
    taskId: string | Types.ObjectId,
    providerId: string | Types.ObjectId,
    rejectionReason: string
  ) {
    const task = await TaskModelInstance.findById(taskId);

    if (!task) {
      throw new Error("Task not found");
    }

    if (task.status !== TaskStatus.REQUESTED) {
      throw new Error("Only requested tasks can be rejected");
    }

    if (
      task.requestedProvider?.providerId.toString() !== providerId.toString()
    ) {
      throw new Error("Only the requested provider can reject this task");
    }

    // Move back to previous status
    if (task.matchedProviders && task.matchedProviders.length > 0) {
      task.status = TaskStatus.MATCHED;
    } else if (
      task.interestedProviders &&
      task.interestedProviders.length > 0
    ) {
      task.status = TaskStatus.FLOATING;
    } else {
      task.status = TaskStatus.PENDING;
    }

    task.requestedProvider = undefined;
    task.cancellationReason = rejectionReason;

    await task.save();
    return task;
  }

  /**
   * Get task with its booking (if converted)
   */
  static async getTaskWithBooking(taskId: string | Types.ObjectId) {
    const task = await TaskModelInstance.findById(taskId)
      .populate("customerId", "name email")
      .populate("matchedProviders.providerId", "businessName locationData")
      .populate({
        path: "convertedToBookingId",
        populate: [
          { path: "providerId", select: "businessName locationData" },
          { path: "serviceId", select: "title description" },
        ],
      });

    if (!task) {
      throw new Error("Task not found");
    }

    return task;
  }

  /**
   * Get booking with its originating task
   */
  static async getBookingWithTask(bookingId: string | Types.ObjectId) {
    const booking = await BookingModel.findById(bookingId)
      .populate({
        path: "taskId",
        populate: [
          { path: "customerId", select: "name email" },
          { path: "matchedProviders.providerId", select: "businessName" },
        ],
      })
      .populate("clientId", "name email phone")
      .populate("providerId", "businessName locationData profile")
      .populate("serviceId", "title description pricing");

    if (!booking) {
      throw new Error("Booking not found");
    }

    return booking;
  }

  /**
   * ✅ UPDATED: Cancel a task (during discovery phase only)
   * Can only cancel if not yet converted to booking
   */
  static async cancelTask(
    taskId: string | Types.ObjectId,
    reason: string,
    cancelledBy: UserRole.CUSTOMER | UserRole.PROVIDER,
    userId: string | Types.ObjectId
  ) {
    const task = await TaskModelInstance.findById(taskId);

    if (!task) {
      throw new Error("Task not found");
    }

    if (task.status === TaskStatus.CONVERTED) {
      throw new Error(
        "Cannot cancel task after conversion to booking. Cancel the booking instead."
      );
    }

    if (task.status === TaskStatus.CANCELLED) {
      throw new Error("Task is already cancelled");
    }

    // Validate permissions
    if (
      cancelledBy === UserRole.CUSTOMER &&
      task.customerId.toString() !== userId.toString()
    ) {
      throw new Error("Only the customer can cancel this task");
    }

    if (
      cancelledBy === UserRole.PROVIDER &&
      task.requestedProvider?.providerId.toString() !== userId.toString()
    ) {
      throw new Error("Only the requested provider can cancel this task");
    }

    task.status = TaskStatus.CANCELLED;
    task.cancelledAt = new Date();
    task.cancellationReason = reason;
    task.cancelledBy = cancelledBy;

    await task.save();
    return task;
  }

  /**
   * Cancel a booking (during execution phase)
   */
  static async cancelBooking(
    bookingId: string | Types.ObjectId,
    reason: string,
    cancelledBy: UserRole.CUSTOMER | UserRole.PROVIDER,
    userId: string | Types.ObjectId
  ) {
    const booking = await BookingModel.findById(bookingId);

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.status === BookingStatus.COMPLETED) {
      throw new Error("Cannot cancel completed bookings");
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new Error("Booking is already cancelled");
    }

    // Validate permissions
    if (
      cancelledBy === UserRole.CUSTOMER &&
      booking.clientId.toString() !== userId.toString()
    ) {
      throw new Error("Only the customer can cancel this booking");
    }

    if (
      cancelledBy === UserRole.PROVIDER &&
      booking.providerId.toString() !== userId.toString()
    ) {
      throw new Error("Only the provider can cancel this booking");
    }

    await booking.cancel(reason, cancelledBy, userId as Types.ObjectId);
    return booking;
  }

  /**
   * ✅ ENHANCED: Get customer's task and booking history with better stats
   */
  static async getCustomerHistory(customerId: string | Types.ObjectId) {
    const [tasks, bookings] = await Promise.all([
      TaskModelInstance.find({
        customerId,
        isDeleted: { $ne: true },
      })
        .populate("matchedProviders.providerId", "businessName locationData")
        .populate("convertedToBookingId")
        .sort({ createdAt: -1 }),

      BookingModel.find({
        clientId: customerId,
        isDeleted: { $ne: true },
      })
        .populate("taskId", "title description")
        .populate("providerId", "businessName locationData profile")
        .populate("serviceId", "title description")
        .sort({ createdAt: -1 }),
    ]);

    return {
      tasks,
      bookings,
      stats: {
        // Task stats
        totalTasks: tasks.length,
        pendingTasks: tasks.filter((t) => t.status === TaskStatus.PENDING)
          .length,
        matchedTasks: tasks.filter((t) => t.status === TaskStatus.MATCHED)
          .length,
        floatingTasks: tasks.filter((t) => t.status === TaskStatus.FLOATING)
          .length,
        requestedTasks: tasks.filter((t) => t.status === TaskStatus.REQUESTED)
          .length,
        convertedTasks: tasks.filter((t) => t.status === TaskStatus.CONVERTED)
          .length,
        cancelledTasks: tasks.filter((t) => t.status === TaskStatus.CANCELLED)
          .length,
        expiredTasks: tasks.filter((t) => t.status === TaskStatus.EXPIRED)
          .length,

        // Booking stats
        totalBookings: bookings.length,
        confirmedBookings: bookings.filter(
          (b) => b.status === BookingStatus.CONFIRMED
        ).length,
        inProgressBookings: bookings.filter(
          (b) => b.status === BookingStatus.IN_PROGRESS
        ).length,
        awaitingValidationBookings: bookings.filter(
          (b) => b.status === BookingStatus.AWAITING_VALIDATION
        ).length, // ✅ NEW
        validatedBookings: bookings.filter(
          (b) => b.status === BookingStatus.VALIDATED
        ).length, // ✅ NEW
        disputedBookings: bookings.filter(
          (b) => b.status === BookingStatus.DISPUTED
        ).length, // ✅ NEW
        completedBookings: bookings.filter(
          (b) => b.status === BookingStatus.COMPLETED
        ).length,
        cancelledBookings: bookings.filter(
          (b) => b.status === BookingStatus.CANCELLED
        ).length,

        // Combined stats
        activeBookings: bookings.filter(
          (b) =>
            b.status === BookingStatus.CONFIRMED ||
            b.status === BookingStatus.IN_PROGRESS ||
            b.status === BookingStatus.AWAITING_VALIDATION // ✅ Include awaiting validation
        ).length,
        upcomingBookings: bookings.filter(
          (b) =>
            b.scheduledDate > new Date() &&
            (b.status === BookingStatus.CONFIRMED ||
              b.status === BookingStatus.IN_PROGRESS)
        ).length,
      },
    };
  }

  /**
   * ✅ ENHANCED: Get provider's task and booking history with better stats
   */
  static async getProviderHistory(providerId: string | Types.ObjectId) {
    const [matchedTasks, bookings] = await Promise.all([
      TaskModelInstance.find({
        "matchedProviders.providerId": providerId,
        isDeleted: { $ne: true },
      })
        .populate("customerId", "name email")
        .populate("convertedToBookingId")
        .sort({ createdAt: -1 }),

      BookingModel.find({
        providerId,
        isDeleted: { $ne: true },
      })
        .populate("taskId", "title description")
        .populate("clientId", "name email")
        .populate("serviceId", "title")
        .sort({ scheduledDate: -1 }),
    ]);

    return {
      matchedTasks,
      bookings,
      stats: {
        // Task stats
        totalMatches: matchedTasks.length,
        activeMatches: matchedTasks.filter(
          (t) => t.status === TaskStatus.MATCHED
        ).length,
        requestedTasks: matchedTasks.filter(
          (t) => t.status === TaskStatus.REQUESTED
        ).length,
        acceptedTasks: matchedTasks.filter(
          (t) => t.status === TaskStatus.CONVERTED
        ).length,

        // Booking stats
        totalBookings: bookings.length,
        confirmedBookings: bookings.filter(
          (b) => b.status === BookingStatus.CONFIRMED
        ).length,
        inProgressBookings: bookings.filter(
          (b) => b.status === BookingStatus.IN_PROGRESS
        ).length,
        awaitingValidationBookings: bookings.filter(
          (b) => b.status === BookingStatus.AWAITING_VALIDATION
        ).length, // ✅ NEW
        validatedBookings: bookings.filter(
          (b) => b.status === BookingStatus.VALIDATED
        ).length, // ✅ NEW
        disputedBookings: bookings.filter(
          (b) => b.status === BookingStatus.DISPUTED
        ).length, // ✅ NEW
        completedBookings: bookings.filter(
          (b) => b.status === BookingStatus.COMPLETED
        ).length,
        cancelledBookings: bookings.filter(
          (b) => b.status === BookingStatus.CANCELLED
        ).length,

        // Combined stats
        upcomingBookings: bookings.filter(
          (b) =>
            b.scheduledDate > new Date() &&
            (b.status === BookingStatus.CONFIRMED ||
              b.status === BookingStatus.IN_PROGRESS)
        ).length,
        pastBookings: bookings.filter((b) => b.scheduledDate < new Date())
          .length,
      },
    };
  }

  /**
   * ✅ ENHANCED: Get dashboard metrics with booking-specific data
   */
  static async getDashboardMetrics(
    userId: string | Types.ObjectId,
    role: UserRole
  ) {
    if (role === UserRole.CUSTOMER) {
      const [
        activeTasks,
        upcomingBookings,
        awaitingValidation, // ✅ NEW
        validatedBookings,  // ✅ NEW
        pendingTasks,
      ] = await Promise.all([
        // Tasks in discovery phase
        TaskModelInstance.countDocuments({
          customerId: userId,
          status: {
            $in: [
              TaskStatus.PENDING,
              TaskStatus.MATCHED,
              TaskStatus.FLOATING,
              TaskStatus.REQUESTED,
            ],
          },
          isDeleted: { $ne: true },
        }),

        // Upcoming bookings (execution phase)
        BookingModel.countDocuments({
          clientId: userId,
          status: {
            $in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS],
          },
          scheduledDate: { $gte: new Date() },
          isDeleted: { $ne: true },
        }),

        // ✅ NEW: Bookings awaiting customer validation
        BookingModel.countDocuments({
          clientId: userId,
          status: BookingStatus.AWAITING_VALIDATION,
          isDeleted: { $ne: true },
        }),

        // ✅ NEW: Validated bookings
        BookingModel.countDocuments({
          clientId: userId,
          status: BookingStatus.VALIDATED,
          isDeleted: { $ne: true },
        }),

        // Pending tasks (just created)
        TaskModelInstance.countDocuments({
          customerId: userId,
          status: TaskStatus.PENDING,
          isDeleted: { $ne: true },
        }),
      ]);

      return {
        role: UserRole.CUSTOMER,
        activeTasks,
        pendingTasks,
        upcomingBookings,
        awaitingValidation, // ✅ NEW: Important for customer to see
        validatedBookings,  // ✅ NEW
        completedBookings: validatedBookings, // Legacy field
      };
    } else if (role === UserRole.PROVIDER) {
      const [
        matchedTasks,
        requestedTasks,
        upcomingBookings,
        awaitingValidation, // ✅ NEW
        validatedBookings,  // ✅ NEW
        todayBookings,
      ] = await Promise.all([
        // Tasks matched to provider
        TaskModelInstance.countDocuments({
          "matchedProviders.providerId": userId,
          status: TaskStatus.MATCHED,
          isDeleted: { $ne: true },
        }),

        // Tasks where provider was requested
        TaskModelInstance.countDocuments({
          "requestedProvider.providerId": userId,
          status: TaskStatus.REQUESTED,
          isDeleted: { $ne: true },
        }),

        // Upcoming bookings
        BookingModel.countDocuments({
          providerId: userId,
          status: {
            $in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS],
          },
          scheduledDate: { $gte: new Date() },
          isDeleted: { $ne: true },
        }),

        // ✅ NEW: Completed but awaiting customer validation
        BookingModel.countDocuments({
          providerId: userId,
          status: BookingStatus.AWAITING_VALIDATION,
          isDeleted: { $ne: true },
        }),

        // ✅ NEW: Validated by customer
        BookingModel.countDocuments({
          providerId: userId,
          status: BookingStatus.VALIDATED,
          isDeleted: { $ne: true },
        }),

        // Today's bookings
        BookingModel.countDocuments({
          providerId: userId,
          status: {
            $in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS],
          },
          scheduledDate: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0)),
            $lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
          isDeleted: { $ne: true },
        }),
      ]);

      return {
        role: UserRole.PROVIDER,
        matchedTasks,
        requestedTasks,
        upcomingBookings,
        awaitingValidation, // ✅ NEW: Shows provider what's pending approval
        validatedBookings,  // ✅ NEW
        completedBookings: validatedBookings, // Legacy field
        todayBookings,
      };
    }

    throw new Error("Invalid role");
  }

  /**
   * ✅ NEW: Start a booking (provider starts working)
   */
  static async startBooking(
    bookingId: string | Types.ObjectId,
    providerId: string | Types.ObjectId
  ) {
    const booking = await BookingModel.findById(bookingId);

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.providerId.toString() !== providerId.toString()) {
      throw new Error("Only the assigned provider can start this booking");
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new Error("Only confirmed bookings can be started");
    }

    await booking.startService(providerId as Types.ObjectId);

    return booking;
  }

  /**
   * ✅ UPDATED: Complete a booking - now moves to AWAITING_VALIDATION
   */
  static async completeBooking(
    bookingId: string | Types.ObjectId,
    providerId: string | Types.ObjectId,
    finalPrice?: number
  ) {
    const booking = await BookingModel.findById(bookingId);

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.providerId.toString() !== providerId.toString()) {
      throw new Error("Only the assigned provider can complete this booking");
    }

    if (booking.status !== BookingStatus.IN_PROGRESS) {
      throw new Error("Only in-progress bookings can be completed");
    }

    // ✅ This now moves booking to AWAITING_VALIDATION status
    await booking.complete(finalPrice, providerId as Types.ObjectId);

    return booking;
  }

  /**
   * ✅ NEW: Reschedule a booking
   */
  static async rescheduleBooking(
    bookingId: string | Types.ObjectId,
    newDate: Date,
    newTimeSlot?: { start: string; end: string },
    userId?: string | Types.ObjectId,
    userRole?: UserRole
  ) {
    const booking = await BookingModel.findById(bookingId);

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new Error("Only confirmed bookings can be rescheduled");
    }

    await booking.reschedule(
      newDate,
      newTimeSlot,
      userId as Types.ObjectId,
      userRole
    );

    return booking;
  }

  /**
   * ✅ NEW: Customer validates booking completion
   */
  static async validateBookingCompletion(
    bookingId: string | Types.ObjectId,
    customerId: string | Types.ObjectId,
    approved: boolean,
    rating?: number,
    review?: string,
    disputeReason?: string
  ) {
    const booking = await BookingModel.findById(bookingId)
      .populate("taskId", "title description")
      .populate("providerId", "businessName locationData profile")
      .populate("serviceId", "title description");

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.clientId.toString() !== customerId.toString()) {
      throw new Error("Only the customer can validate this booking");
    }

    if (booking.status !== BookingStatus.AWAITING_VALIDATION) {
      throw new Error(
        `Booking is not awaiting validation. Current status: ${booking.status}`
      );
    }

    await booking.validateCompletion(
      approved,
      customerId as Types.ObjectId,
      rating,
      review,
      disputeReason
    );

    return booking;
  }
}