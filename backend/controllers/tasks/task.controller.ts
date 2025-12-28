// controllers/task.controller.ts

import { AdminTaskHandlers } from "./handlers/admin.task.handers";
import { CustomerTaskHandlers } from "./handlers/customer.task.handler";
import { ProviderTaskHandlers } from "./handlers/provider.task.handlers";

/**
 * Task Controller
 *
 * Handles HTTP requests for task management endpoints.
 * Delegates to specialized handler classes for better organization.
 */
export class TaskController {
  private customerHandler: typeof CustomerTaskHandlers;
  private providerHandler: typeof ProviderTaskHandlers;
  private adminHandler: typeof AdminTaskHandlers;

  // Customer Task Operations
  public createTask;
  public getMyTasks;
  public getTaskById;
  public updateTask;
  public requestProvider;
  public cancelTask;
  public deleteTask;
  public rematchTask;

  // Provider Task Operations
  public getMatchedTasks;
  public getFloatingTasks;
  public getActiveTasks;
  public expressInterest;
  public respondToRequest;
  public startTask;
  public completeTask;
  public providerCancelTask;
  public getTaskDetails;

  // Admin Task Operations
  public getAllTasks;
  public getTaskStatistics;

  constructor() {
    this.customerHandler = CustomerTaskHandlers;
    this.providerHandler = ProviderTaskHandlers;
    this.adminHandler = AdminTaskHandlers;

    // Bind Customer handlers
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

    // Bind Provider handlers
    this.getMatchedTasks = this.providerHandler.getMatchedTasks.bind(
      this.providerHandler
    );
    this.getFloatingTasks = this.providerHandler.getFloatingTasks.bind(
      this.providerHandler
    );
    this.getActiveTasks = this.providerHandler.getActiveTasks.bind(
      this.providerHandler
    );
    this.expressInterest = this.providerHandler.expressInterest.bind(
      this.providerHandler
    );
    this.respondToRequest = this.providerHandler.respondToRequest.bind(
      this.providerHandler
    );
    this.startTask = this.providerHandler.startTask.bind(this.providerHandler);
    this.completeTask = this.providerHandler.completeTask.bind(
      this.providerHandler
    );
    this.providerCancelTask = this.providerHandler.cancelTask.bind(
      this.providerHandler
    );
    this.getTaskDetails = this.providerHandler.getTaskDetails.bind(
      this.providerHandler
    );

    // Bind Admin handlers
    this.getAllTasks = this.adminHandler.getAllTasks.bind(this.adminHandler);
    this.getTaskStatistics = this.adminHandler.getTaskStatistics.bind(
      this.adminHandler
    );
  }
}

// Create and export a singleton instance
const taskController = new TaskController();

// Export individual handlers for use in routes
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

  // Provider Task Operations
  getMatchedTasks,
  getFloatingTasks,
  getActiveTasks,
  expressInterest,
  respondToRequest,
  startTask,
  completeTask,
  providerCancelTask,
  getTaskDetails,

  // Admin Task Operations
  getAllTasks,
  getTaskStatistics,
} = taskController;
