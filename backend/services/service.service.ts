// services/service.service.ts
import { FilterQuery, Types, UpdateQuery, PopulateOptions } from "mongoose";
import { Service } from "../types/service.types";
import { ServiceModel } from "../models/service.model";
import slugify from "slugify";
import { MongoDBFileService } from "./files/mongodb.files.service";
import { ImageLinkingService } from "../utils/controller-utils/ImageLinkingService";

// Constants
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// DTOs for type safety
export interface CreateServiceDTO {
  title: string;
  description: string;
  tags?: string[];
  categoryId: string;
  coverImage?: string;
  providerId?: string;
  servicePricing?: {
    serviceBasePrice: number;
    includeTravelFee?: boolean;
    includeAdditionalFees?: boolean;
    currency?: string;
    platformCommissionRate?: number;
  };
  isPrivate?: boolean;
  submittedBy?: string;
}

export interface UpdateServiceDTO {
  title?: string;
  description?: string;
  tags?: string[];
  categoryId?: string;
  coverImage?: string;
  servicePricing?: {
    serviceBasePrice?: number;
    includeTravelFee?: boolean;
    includeAdditionalFees?: boolean;
    currency?: string;
    platformCommissionRate?: number;
  };
  isPrivate?: boolean;
}

export interface ServiceSearchFilters {
  categoryId?: string;
  providerId?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  isActive?: boolean;
  isPrivate?: boolean;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ServiceQueryResult {
  services: Service[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export enum ProviderAccessLevel {
  STANDARD = "standard",
  VERIFIED = "verified",
  COMPANY_TRAINED = "company_trained",
  ADMIN = "admin",
}

// Population presets for different use cases
export enum PopulationLevel {
  NONE = "none", // No population at all
  MINIMAL = "minimal", // Only IDs and names for lists
  STANDARD = "standard", // Basic info for general queries
  DETAILED = "detailed", // Full details for single service views
  COMPLETE = "complete", // Everything including file URLs
}

class ServiceService {
  private fileService: MongoDBFileService;
  private imageLinkingService: ImageLinkingService;

  constructor() {
    this.fileService = new MongoDBFileService();
    this.imageLinkingService = new ImageLinkingService();
  }

  /**
   * Get population options based on level
   */
  private getPopulationOptions(level: PopulationLevel): PopulateOptions[] {
    switch (level) {
      case PopulationLevel.NONE:
        return [];

      case PopulationLevel.MINIMAL:
        return [
          { path: "categoryId", select: "catName slug" },
          { path: "providerId", select: "businessName slug" },
        ];

      case PopulationLevel.STANDARD:
        return [
          { path: "categoryId", select: "catName slug isActive" },
          {
            path: "providerId",
            select: "businessName slug business_logo location",
          },
          { path: "coverImage", select: "url fileName" },
        ];

      case PopulationLevel.DETAILED:
        return [
          { path: "categoryId", select: "catName catDesc slug isActive tags" },
          {
            path: "providerId",
            select: "businessName slug business_logo location business_contact",
          },
          { path: "coverImage", select: "url fileName altText label" },
          { path: "submittedBy", select: "name email" },
        ];

      case PopulationLevel.COMPLETE:
        return [
          {
            path: "categoryId",
            select: "catName catDesc slug isActive tags createdAt",
          },
          {
            path: "providerId",
            select:
              "businessName slug business_logo location business_contact createdAt",
          },
          {
            path: "coverImage",
            select: "url fileName altText label uploadedAt fileSize mimeType",
          },
          { path: "submittedBy", select: "name email role" },
          { path: "approvedBy", select: "name email" },
          { path: "rejectedBy", select: "name email" },
        ];

      default:
        return [];
    }
  }

  /**
   * Create a new service
   * Automatically links any orphaned cover image uploaded before service creation
   */
  async createService(data: CreateServiceDTO): Promise<Service> {
    try {
      // Generate unique slug
      const baseSlug = slugify(data.title, { lower: true, strict: true });
      const slug = await this.generateUniqueSlug(baseSlug);

      // Only admin can create private services (validation should happen in controller)
      const serviceData: Partial<Service> = {
        title: data.title,
        description: data.description,
        slug,
        tags: data.tags || [],
        categoryId: new Types.ObjectId(data.categoryId),
        coverImage: data.coverImage
          ? new Types.ObjectId(data.coverImage)
          : undefined,
        providerId: data.providerId
          ? new Types.ObjectId(data.providerId)
          : undefined,
        servicePricing: data.servicePricing
          ? {
              serviceBasePrice: data.servicePricing.serviceBasePrice,
              includeTravelFee: data.servicePricing.includeTravelFee ?? false,
              includeAdditionalFees:
                data.servicePricing.includeAdditionalFees ?? false,
              currency: data.servicePricing.currency || "GHS",
              platformCommissionRate:
                data.servicePricing.platformCommissionRate ?? 0.2,
              providerEarnings: 0, // Will be calculated in pre-save hook
            }
          : undefined,
        isPrivate: data.isPrivate ?? false,
        submittedBy: data.submittedBy
          ? new Types.ObjectId(data.submittedBy)
          : undefined,
        isActive: false, // Requires approval
      };

      const service = new ServiceModel(serviceData);
      await service.save();

      // Link orphaned cover image if exists
      const linkResult = await this.imageLinkingService.linkOrphanedImage(
        "service",
        service._id.toString(),
        "service_cover",
        "coverImage",
        data.submittedBy
      );

      if (linkResult.linked) {
        const updatedService = await ServiceModel.findById(service._id).lean();
        return updatedService!;
      }

      return service.toObject();
    } catch (error) {
      throw new Error(
        `Failed to create service: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Check if a service with the same title exists in the same category
   * Optionally checks for the same provider as well
   */
  async checkDuplicateService(
    title: string,
    categoryId: string,
    providerId?: string
  ): Promise<Service | null> {
    const query: FilterQuery<Service> = {
      title: { $regex: new RegExp(`^${title.trim()}$`, "i") }, // Case-insensitive exact match
      categoryId: new Types.ObjectId(categoryId),
      deletedAt: null,
    };

    // Optional: Check if same provider is creating duplicate
    if (providerId) {
      query.providerId = new Types.ObjectId(providerId);
    }

    const existingService = await ServiceModel.findOne(query)
      .select("_id title slug")
      .lean();

    return existingService;
  }

  /**
   * Get service by ID with configurable population
   */
  async getServiceById(
    serviceId: string,
    options: {
      includeDeleted?: boolean;
      populationLevel?: PopulationLevel;
    } = {}
  ): Promise<Service | null> {
    const {
      includeDeleted = false,
      populationLevel = PopulationLevel.STANDARD,
    } = options;

    const query: FilterQuery<Service> = { _id: serviceId };

    if (!includeDeleted) {
      query.deletedAt = null;
    }

    let serviceQuery = ServiceModel.findOne(query);

    // Apply population based on level
    const populateOptions = this.getPopulationOptions(populationLevel);
    populateOptions.forEach((popOption) => {
      serviceQuery = serviceQuery.populate(popOption);
    });

    const service = await serviceQuery.lean();
    return service;
  }

  /**
   * Get service by slug with configurable population
   */
  async getServiceBySlug(
    slug: string,
    options: {
      includeDeleted?: boolean;
      populationLevel?: PopulationLevel;
    } = {}
  ): Promise<Service | null> {
    const {
      includeDeleted = false,
      populationLevel = PopulationLevel.STANDARD,
    } = options;

    const query: FilterQuery<Service> = { slug };

    if (!includeDeleted) {
      query.deletedAt = null;
    }

    let serviceQuery = ServiceModel.findOne(query);

    // Apply population based on level
    const populateOptions = this.getPopulationOptions(populationLevel);
    populateOptions.forEach((popOption) => {
      serviceQuery = serviceQuery.populate(popOption);
    });

    const service = await serviceQuery.lean();
    return service;
  }

  /**
   * Get public services only (for business profile selection)
   */
  async getPublicServices(
    filters?: Omit<ServiceSearchFilters, "isPrivate">,
    pagination?: PaginationOptions,
    populationLevel: PopulationLevel = PopulationLevel.MINIMAL
  ): Promise<ServiceQueryResult> {
    const query: FilterQuery<Service> = {
      isActive: true,
      deletedAt: null,
      isPrivate: false, // Only public services
    };

    return this.queryServices(query, filters, pagination, populationLevel);
  }

  /**
   * Get accessible services for a provider based on their access level
   */
  async getAccessibleServices(
    accessLevel: ProviderAccessLevel,
    filters?: ServiceSearchFilters,
    pagination?: PaginationOptions,
    populationLevel: PopulationLevel = PopulationLevel.MINIMAL
  ): Promise<ServiceQueryResult> {
    const query: FilterQuery<Service> = {
      isActive: true,
      deletedAt: null,
    };

    // Standard providers can only see public services
    if (accessLevel === ProviderAccessLevel.STANDARD) {
      query.isPrivate = false;
    }
    // Verified, company-trained, and admin can see all services
    // (No additional filter needed)

    return this.queryServices(query, filters, pagination, populationLevel);
  }

  /**
   * Get services by category
   */
  async getServicesByCategory(
    categoryId: string,
    accessLevel: ProviderAccessLevel = ProviderAccessLevel.STANDARD,
    pagination?: PaginationOptions,
    populationLevel: PopulationLevel = PopulationLevel.MINIMAL
  ): Promise<ServiceQueryResult> {
    const query: FilterQuery<Service> = {
      categoryId: new Types.ObjectId(categoryId),
      isActive: true,
      deletedAt: null,
    };

    // Apply access level restriction
    if (accessLevel === ProviderAccessLevel.STANDARD) {
      query.isPrivate = false;
    }

    return this.queryServices(query, undefined, pagination, populationLevel);
  }

  /**
   * Get services by provider
   */
  async getServicesByProvider(
    providerId: string,
    options: {
      includeInactive?: boolean;
      pagination?: PaginationOptions;
      populationLevel?: PopulationLevel;
    } = {}
  ): Promise<ServiceQueryResult> {
    const {
      includeInactive = false,
      pagination,
      populationLevel = PopulationLevel.MINIMAL,
    } = options;

    const query: FilterQuery<Service> = {
      providerId: new Types.ObjectId(providerId),
      deletedAt: null,
    };

    if (!includeInactive) {
      query.isActive = true;
    }

    return this.queryServices(query, undefined, pagination, populationLevel);
  }

  /**
   * Search services with full-text search
   */
  async searchServices(
    searchTerm: string,
    accessLevel: ProviderAccessLevel = ProviderAccessLevel.STANDARD,
    filters?: ServiceSearchFilters,
    pagination?: PaginationOptions,
    populationLevel: PopulationLevel = PopulationLevel.STANDARD
  ): Promise<ServiceQueryResult> {
    const query: FilterQuery<Service> = {
      $text: { $search: searchTerm },
      isActive: true,
      deletedAt: null,
    };

    // Apply access level restriction
    if (accessLevel === ProviderAccessLevel.STANDARD) {
      query.isPrivate = false;
    }

    return this.queryServices(query, filters, pagination, populationLevel);
  }

  /**
   * Update service
   */
  async updateService(
    serviceId: string,
    data: UpdateServiceDTO
  ): Promise<Service | null> {
    try {
      const service = await ServiceModel.findOne({
        _id: serviceId,
        deletedAt: null,
      });

      if (!service) {
        return null;
      }

      // Update slug if title changes
      if (data.title && data.title !== service.title) {
        const baseSlug = slugify(data.title, { lower: true, strict: true });
        const slug = await this.generateUniqueSlug(baseSlug, serviceId);
        service.slug = slug;
      }

      // Update fields
      if (data.title) service.title = data.title;
      if (data.description) service.description = data.description;
      if (data.tags) service.tags = data.tags;
      if (data.categoryId)
        service.categoryId = new Types.ObjectId(data.categoryId);
      if (data.coverImage !== undefined) {
        service.coverImage = data.coverImage
          ? new Types.ObjectId(data.coverImage)
          : undefined;
      }
      if (data.isPrivate !== undefined) service.isPrivate = data.isPrivate;

      // Update pricing if provided
      if (data.servicePricing) {
        // Initialize servicePricing if it doesn't exist
        if (!service.servicePricing) {
          service.servicePricing = {
            serviceBasePrice: 0,
            includeTravelFee: false,
            includeAdditionalFees: false,
            currency: "GHS",
            platformCommissionRate: 0.2,
            providerEarnings: 0,
          };
        }

        if (data.servicePricing.serviceBasePrice !== undefined) {
          service.servicePricing.serviceBasePrice =
            data.servicePricing.serviceBasePrice;
        }
        if (data.servicePricing.includeTravelFee !== undefined) {
          service.servicePricing.includeTravelFee =
            data.servicePricing.includeTravelFee;
        }
        if (data.servicePricing.includeAdditionalFees !== undefined) {
          service.servicePricing.includeAdditionalFees =
            data.servicePricing.includeAdditionalFees;
        }
        if (data.servicePricing.currency) {
          service.servicePricing.currency = data.servicePricing.currency;
        }
        if (data.servicePricing.platformCommissionRate !== undefined) {
          service.servicePricing.platformCommissionRate =
            data.servicePricing.platformCommissionRate;
        }
      }

      await service.save();
      return service.toObject();
    } catch (error) {
      throw new Error(
        `Failed to update service: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Update service cover image
   * Uses ImageLinkingService for proper image linking
   */
  async updateCoverImage(
    serviceId: string,
    coverImageId: Types.ObjectId | null,
    lastModifiedBy?: string
  ): Promise<Service | null> {
    try {
      if (!Types.ObjectId.isValid(serviceId)) {
        throw new Error("Invalid service ID");
      }

      if (coverImageId === null) {
        // Unlinking image
        const service = await ServiceModel.findOneAndUpdate(
          {
            _id: new Types.ObjectId(serviceId),
            deletedAt: null,
          },
          {
            $unset: { coverImage: 1 },
          },
          { new: true }
        ).lean();

        return service;
      } else {
        // Linking image using ImageLinkingService
        const linkResult = await this.imageLinkingService.linkImageToEntity(
          "service",
          serviceId,
          "service_cover",
          "coverImage",
          coverImageId,
          lastModifiedBy
        );

        if (linkResult.linked) {
          return (await ServiceModel.findById(
            serviceId
          ).lean()) as Service | null;
        }

        throw new Error("Failed to link cover image");
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Approve service
   */
  async approveService(
    serviceId: string,
    approverId: string
  ): Promise<Service | null> {
    try {
      const service = await ServiceModel.findOne({
        _id: serviceId,
        deletedAt: null,
      });

      if (!service) {
        return null;
      }

      await service.approve(approverId);
      return service.toObject();
    } catch (error) {
      throw new Error(
        `Failed to approve service: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Reject service
   */
  async rejectService(
    serviceId: string,
    approverId: string,
    reason: string
  ): Promise<Service | null> {
    try {
      const service = await ServiceModel.findOne({
        _id: serviceId,
        deletedAt: null,
      });

      if (!service) {
        return null;
      }

      await service.reject(approverId, reason);
      return service.toObject();
    } catch (error) {
      throw new Error(
        `Failed to reject service: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Soft delete service
   */
  async deleteService(serviceId: string): Promise<boolean> {
    try {
      const service = await ServiceModel.findOne({
        _id: serviceId,
        deletedAt: null,
      });

      if (!service) {
        return false;
      }

      await service.softDelete();
      return true;
    } catch (error) {
      throw new Error(
        `Failed to delete service: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Restore soft-deleted service
   */
  async restoreService(serviceId: string): Promise<Service | null> {
    try {
      const service = await ServiceModel.findById(serviceId);

      if (!service || !service.deletedAt) {
        return null;
      }

      await service.restore();
      return service.toObject();
    } catch (error) {
      throw new Error(
        `Failed to restore service: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get pending services (for admin moderation)
   */
  async getPendingServices(
    pagination?: PaginationOptions,
    populationLevel: PopulationLevel = PopulationLevel.STANDARD
  ): Promise<ServiceQueryResult> {
    const query: FilterQuery<Service> = {
      deletedAt: null,
      approvedAt: { $exists: false },
      rejectedAt: { $exists: false },
    };

    return this.queryServices(query, undefined, pagination, populationLevel);
  }

  /**
   * Get all active services (admin)
   */
  async getAllServices(
    filters?: ServiceSearchFilters,
    pagination?: PaginationOptions,
    populationLevel: PopulationLevel = PopulationLevel.MINIMAL
  ): Promise<ServiceQueryResult> {
    const query: FilterQuery<Service> = {
      deletedAt: null,
    };

    return this.queryServices(query, filters, pagination, populationLevel);
  }

  /**
   * Check if service is accessible by provider
   */
  async isServiceAccessible(
    serviceId: string,
    accessLevel: ProviderAccessLevel
  ): Promise<boolean> {
    const service = await ServiceModel.findOne({
      _id: serviceId,
      isActive: true,
      deletedAt: null,
    })
      .select("isPrivate")
      .lean();

    if (!service) {
      return false;
    }

    // Public services are accessible to everyone
    if (!service.isPrivate) {
      return true;
    }

    // Private services are only for verified, company-trained, or admin
    return (
      accessLevel === ProviderAccessLevel.VERIFIED ||
      accessLevel === ProviderAccessLevel.COMPANY_TRAINED ||
      accessLevel === ProviderAccessLevel.ADMIN
    );
  }

  /**
   * Bulk update services
   */
  async bulkUpdateServices(
    serviceIds: string[],
    update: UpdateQuery<Service>
  ): Promise<number> {
    try {
      const result = await ServiceModel.updateMany(
        {
          _id: { $in: serviceIds.map((id) => new Types.ObjectId(id)) },
          deletedAt: null,
        },
        update
      );

      return result.modifiedCount;
    } catch (error) {
      throw new Error(
        `Failed to bulk update services: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get service statistics
   */
  async getServiceStats(): Promise<{
    total: number;
    active: number;
    pending: number;
    rejected: number;
    private: number;
    public: number;
  }> {
    try {
      const [
        total,
        active,
        pending,
        rejected,
        privateServices,
        publicServices,
      ] = await Promise.all([
        ServiceModel.countDocuments({ deletedAt: null }),
        ServiceModel.countDocuments({ isActive: true, deletedAt: null }),
        ServiceModel.countDocuments({
          approvedAt: { $exists: false },
          rejectedAt: { $exists: false },
          deletedAt: null,
        }),
        ServiceModel.countDocuments({
          rejectedAt: { $exists: true },
          deletedAt: null,
        }),
        ServiceModel.countDocuments({
          isPrivate: true,
          isActive: true,
          deletedAt: null,
        }),
        ServiceModel.countDocuments({
          isPrivate: false,
          isActive: true,
          deletedAt: null,
        }),
      ]);

      return {
        total,
        active,
        pending,
        rejected,
        private: privateServices,
        public: publicServices,
      };
    } catch (error) {
      throw new Error(
        `Failed to get service stats: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get image status for a service
   * Useful for debugging image linking issues
   */
  async getServiceImageStatus(serviceId: string) {
    try {
      return await this.imageLinkingService.getImageStatus(
        "service",
        serviceId,
        "service_cover",
        "coverImage"
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Repair broken service cover image links
   */
  async repairServiceCoverLinks(specificServiceId?: string) {
    try {
      return await this.imageLinkingService.repairBrokenLinks(
        "service",
        "service_cover",
        "coverImage",
        specificServiceId
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get service with complete details including cover image URL
   * This method always uses COMPLETE population level
   */
  async getCompleteService(serviceId: string): Promise<{
    service: Service | null;
    coverImage?: {
      url: string;
      thumbnailUrl?: string;
      uploadedAt: Date;
    };
  }> {
    try {
      if (!Types.ObjectId.isValid(serviceId)) {
        throw new Error("Invalid service ID");
      }

      // Use COMPLETE population level for this method
      const service = await this.getServiceById(serviceId, {
        populationLevel: PopulationLevel.COMPLETE,
      });

      if (!service) {
        return { service: null };
      }

      const result: any = { service };

      // Get cover image details if exists
      if (service.coverImage) {
        const file = await this.fileService.getFileById(
          service.coverImage.toString()
        );

        if (file && file.status === "active") {
          result.coverImage = {
            url: file.url,
            thumbnailUrl: file.thumbnailUrl,
            uploadedAt: file.uploadedAt,
          };
        }
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Helper: Generate unique slug
   */
  private async generateUniqueSlug(
    baseSlug: string,
    excludeId?: string
  ): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const query: FilterQuery<Service> = { slug };
      if (excludeId) {
        query._id = { $ne: excludeId };
      }

      const existing = await ServiceModel.findOne(query).select("_id").lean();
      if (!existing) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  /**
   * Helper: Common query method with pagination, filtering, and dynamic population
   */
  private async queryServices(
    baseQuery: FilterQuery<Service>,
    filters?: ServiceSearchFilters,
    pagination?: PaginationOptions,
    populationLevel: PopulationLevel = PopulationLevel.MINIMAL
  ): Promise<ServiceQueryResult> {
    const query = { ...baseQuery };

    // Apply filters
    if (filters?.categoryId) {
      query.categoryId = new Types.ObjectId(filters.categoryId);
    }

    if (filters?.providerId) {
      query.providerId = new Types.ObjectId(filters.providerId);
    }

    if (filters?.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    if (filters?.isPrivate !== undefined) {
      query.isPrivate = filters.isPrivate;
    }

    if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
      const priceFilter: any = {};
      if (filters.minPrice !== undefined) {
        priceFilter.$gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        priceFilter.$lte = filters.maxPrice;
      }
      query["servicePricing.serviceBasePrice"] = priceFilter;
    }

    if (filters?.tags && filters.tags.length > 0) {
      query.tags = { $in: filters.tags };
    }

    // Pagination
    const page = pagination?.page || 1;
    const limit = Math.min(
      pagination?.limit || DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );
    const skip = (page - 1) * limit;

    // Sorting
    const sortField = pagination?.sortBy || "createdAt";
    const sortOrder = pagination?.sortOrder === "asc" ? 1 : -1;
    const sort: any = { [sortField]: sortOrder };

    // Build query with dynamic population
    let serviceQuery = ServiceModel.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    // Apply population based on level
    const populateOptions = this.getPopulationOptions(populationLevel);
    populateOptions.forEach((popOption) => {
      serviceQuery = serviceQuery.populate(popOption);
    });

    const [services, total] = await Promise.all([
      serviceQuery.lean(),
      ServiceModel.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      services,
      total,
      page,
      totalPages,
      hasMore: page < totalPages,
    };
  }
}

export const serviceService = new ServiceService();
