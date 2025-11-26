// controllers/service.controller.ts

import { ServiceAdminHandler } from "./handlers/admin.handler";
import { ServiceCRUDHandler } from "./handlers/crud.handler";
import { ServiceRetrievalHandler } from "./handlers/retrieval.handler";

export class ServiceController {
  private crudHandler: ServiceCRUDHandler;
  private retrievalHandler: ServiceRetrievalHandler;
  private adminHandler: ServiceAdminHandler;

  // CRUD Operations
  public createService;
  public updateService;
  public updateCoverImage;
  public deleteService;

  // Retrieval Operations
  public getServiceById;
  public getServiceBySlug;
  public getCompleteService;
  public getPublicServices;
  public getAccessibleServices;
  public getServicesByCategory;
  public getServicesByProvider;
  public searchServices;
  public checkServiceAccessibility;

  // Admin Operations
  public approveService;
  public rejectService;
  public restoreService;
  public getPendingServices;
  public getAllServices;
  public getServiceStats;
  public getServiceImageStatus;
  public repairServiceCoverLinks;
  public bulkUpdateServices;

  constructor() {
    this.crudHandler = new ServiceCRUDHandler();
    this.retrievalHandler = new ServiceRetrievalHandler();
    this.adminHandler = new ServiceAdminHandler();

    // Bind CRUD handlers
    this.createService = this.crudHandler.createService.bind(this.crudHandler);
    this.updateService = this.crudHandler.updateService.bind(this.crudHandler);
    this.updateCoverImage = this.crudHandler.updateCoverImage.bind(
      this.crudHandler
    );
    this.deleteService = this.crudHandler.deleteService.bind(this.crudHandler);

    // Bind retrieval handlers
    this.getServiceById = this.retrievalHandler.getServiceById.bind(
      this.retrievalHandler
    );
    this.getServiceBySlug = this.retrievalHandler.getServiceBySlug.bind(
      this.retrievalHandler
    );
    this.getCompleteService = this.retrievalHandler.getCompleteService.bind(
      this.retrievalHandler
    );
    this.getPublicServices = this.retrievalHandler.getPublicServices.bind(
      this.retrievalHandler
    );
    this.getAccessibleServices =
      this.retrievalHandler.getAccessibleServices.bind(this.retrievalHandler);
    this.getServicesByCategory =
      this.retrievalHandler.getServicesByCategory.bind(this.retrievalHandler);
    this.getServicesByProvider =
      this.retrievalHandler.getServicesByProvider.bind(this.retrievalHandler);
    this.searchServices = this.retrievalHandler.searchServices.bind(
      this.retrievalHandler
    );
    this.checkServiceAccessibility =
      this.retrievalHandler.checkServiceAccessibility.bind(
        this.retrievalHandler
      );

    // Bind admin handlers
    this.approveService = this.adminHandler.approveService.bind(
      this.adminHandler
    );
    this.rejectService = this.adminHandler.rejectService.bind(
      this.adminHandler
    );
    this.restoreService = this.adminHandler.restoreService.bind(
      this.adminHandler
    );
    this.getPendingServices = this.adminHandler.getPendingServices.bind(
      this.adminHandler
    );
    this.getAllServices = this.adminHandler.getAllServices.bind(
      this.adminHandler
    );
    this.getServiceStats = this.adminHandler.getServiceStats.bind(
      this.adminHandler
    );
    this.getServiceImageStatus = this.adminHandler.getServiceImageStatus.bind(
      this.adminHandler
    );
    this.repairServiceCoverLinks =
      this.adminHandler.repairServiceCoverLinks.bind(this.adminHandler);
    this.bulkUpdateServices = this.adminHandler.bulkUpdateServices.bind(
      this.adminHandler
    );
  }
}

// Create and export a singleton instance
const serviceController = new ServiceController();

// Export individual handlers for use in routes
export const {
  // CRUD Operations
  createService,
  updateService,
  updateCoverImage,
  deleteService,

  // Retrieval Operations
  getServiceById,
  getServiceBySlug,
  getCompleteService,
  getPublicServices,
  getAccessibleServices,
  getServicesByCategory,
  getServicesByProvider,
  searchServices,
  checkServiceAccessibility,

  // Admin Operations
  approveService,
  rejectService,
  restoreService,
  getPendingServices,
  getAllServices,
  getServiceStats,
  getServiceImageStatus,
  repairServiceCoverLinks,
  bulkUpdateServices,
} = serviceController;
