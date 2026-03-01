// services/service.service.ts
import { Types, UpdateQuery, PopulateOptions } from "mongoose";

import { Service } from "../types/service.types";
import { ServiceModel } from "../models/service.model";
import { ProviderModel } from "../models/profiles/provider.model";
import slugify from "slugify";
import { MongoDBFileService } from "./files/mongodb.files.service";
import { ImageLinkingService } from "../utils/controller-utils/ImageLinkingService";

// Constants
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface CreateServiceDTO {
  title: string;
  description: string;
  tags?: string[];
  categoryId: string;
  coverImage?: string;
  /**
   * The provider creating this service.
   * When supplied the service is automatically pushed into
   * that provider's `serviceOfferings` array.
   * Omit for admin-created catalog/system services.
   */
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

export enum PopulationLevel {
  NONE = "none",
  MINIMAL = "minimal",
  STANDARD = "standard",
  DETAILED = "detailed",
  COMPLETE = "complete",
}

// ─── Service ─────────────────────────────────────────────────────────────────

class ServiceService {
  private fileService: MongoDBFileService;
  private imageLinkingService: ImageLinkingService;

  constructor() {
    this.fileService = new MongoDBFileService();
    this.imageLinkingService = new ImageLinkingService();
  }

  // ── Population helpers ──────────────────────────────────────────────────

  private getPopulationOptions(level: PopulationLevel): PopulateOptions[] {
    switch (level) {
      case PopulationLevel.NONE:
        return [];

      case PopulationLevel.MINIMAL:
        return [
          { path: "categoryId", select: "catName slug" },
          { path: "coverImage", select: "url thumbnailUrl fileName" },
        ];

      case PopulationLevel.STANDARD:
        return [
          { path: "categoryId", select: "catName slug" },
          { path: "providerId", select: "businessName slug" },
          { path: "coverImage", select: "url thumbnailUrl fileName" },
        ];

      case PopulationLevel.DETAILED:
        return [
          { path: "categoryId", select: "catName catDesc slug isActive tags" },
          {
            path: "providerId",
            select: "businessName slug business_logo location",
          },
          { path: "coverImage", select: "url thumbnailUrl fileName label" },
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
              "businessName slug business_logo location providerContactInfo createdAt",
          },
          {
            path: "coverImage",
            select:
              "url thumbnailUrl fileName label uploadedAt fileSize mimeType",
          },
          { path: "submittedBy", select: "name email role" },
          { path: "approvedBy", select: "name email" },
        ];

      default:
        return [];
    }
  }

  private applyPopulation<T>(
    query: any,
    level: PopulationLevel
  ): typeof query {
    this.getPopulationOptions(level).forEach((opt) => {
      query = query.populate(opt);
    });
    return query;
  }

  // ── Create ──────────────────────────────────────────────────────────────

  /**
   * Create a new service.
   *
   * When `providerId` is provided the service is automatically linked to that
   * provider's `serviceOfferings` array, keeping both sides of the relationship
   * in sync without any extra work from the caller.
   *
   * Also links any orphaned cover image that was uploaded before the service
   * document existed (pre-upload flow).
   */
  async createService(data: CreateServiceDTO): Promise<Service> {
    try {
      const baseSlug = slugify(data.title, { lower: true, strict: true });
      const slug = await this.generateUniqueSlug(baseSlug);

      // Validate that the provider profile exists before proceeding
      if (data.providerId) {
        const providerExists = await ProviderModel.exists({
          _id: new Types.ObjectId(data.providerId),
          isDeleted: false,
        });

        if (!providerExists) {
          throw new Error(
            `Provider profile not found for id: ${data.providerId}`
          );
        }
      }

      const serviceData: Partial<Service> = {
        title: data.title,
        description: data.description,
        slug,
        tags: data.tags ?? [],
        categoryId: new Types.ObjectId(data.categoryId),
        coverImage: data.coverImage
          ? new Types.ObjectId(data.coverImage)
          : undefined,
        // Single scalar reference — null for catalog/system services
        providerId: data.providerId
          ? new Types.ObjectId(data.providerId)
          : undefined,
        servicePricing: data.servicePricing
          ? {
              serviceBasePrice: data.servicePricing.serviceBasePrice,
              includeTravelFee: data.servicePricing.includeTravelFee ?? false,
              includeAdditionalFees:
                data.servicePricing.includeAdditionalFees ?? false,
              currency: data.servicePricing.currency ?? "GHS",
              platformCommissionRate:
                data.servicePricing.platformCommissionRate ?? 0.2,
              providerEarnings: 0, // calculated in pre-save hook
            }
          : undefined,
        isPrivate: data.isPrivate ?? false,
        submittedBy: data.submittedBy
          ? new Types.ObjectId(data.submittedBy)
          : undefined,
        isActive: false, // requires admin approval
      };

      const service = new ServiceModel(serviceData);
      await service.save();

      // ── Auto-link: push service into provider's serviceOfferings ──────────
      // $addToSet prevents duplicates if something retries.
      if (data.providerId) {
        await ProviderModel.findByIdAndUpdate(
          new Types.ObjectId(data.providerId),
          { $addToSet: { serviceOfferings: service._id } }
        );
      }

      // Link orphaned cover image uploaded before service creation
      const linkResult = await this.imageLinkingService.linkOrphanedImage(
        "service",
        service._id.toString(),
        "service_cover",
        "coverImage",
        data.submittedBy
      );

      if (linkResult.linked) {
        return (await ServiceModel.findById(service._id).lean()) as Service;
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

  // ── Read ────────────────────────────────────────────────────────────────

  /**
   * Check if a service with the same title already exists in a category.
   * Optionally scoped to a specific provider.
   */
  async checkDuplicateService(
    title: string,
    categoryId: string,
    providerId?: string
  ): Promise<Service | null> {
    const query: Record<string, any> = {
      title: { $regex: new RegExp(`^${title.trim()}$`, "i") },
      categoryId: new Types.ObjectId(categoryId),
      deletedAt: null,
    };

    if (providerId) {
      query.providerId = new Types.ObjectId(providerId);
    }

    return ServiceModel.findOne(query).select("_id title slug").lean();
  }

  async getServiceById(
    serviceId: string,
    options: {
      includeDeleted?: boolean;
      populationLevel?: PopulationLevel;
    } = {}
  ): Promise<Service | null> {
    const {
      includeDeleted = false,
      populationLevel = PopulationLevel.DETAILED,
    } = options;

    const query: Record<string, any> = { _id: serviceId };
    if (!includeDeleted) query.deletedAt = null;

    const serviceQuery = this.applyPopulation(
      ServiceModel.findOne(query),
      populationLevel
    );

    return serviceQuery.lean();
  }

  async getServiceBySlug(
    slug: string,
    options: {
      includeDeleted?: boolean;
      populationLevel?: PopulationLevel;
    } = {}
  ): Promise<Service | null> {
    const {
      includeDeleted = false,
      populationLevel = PopulationLevel.DETAILED,
    } = options;

    const query: Record<string, any> = { slug };
    if (!includeDeleted) query.deletedAt = null;

    const serviceQuery = this.applyPopulation(
      ServiceModel.findOne(query),
      populationLevel
    );

    return serviceQuery.lean();
  }

  /**
   * Get all services belonging to a single provider (scalar field query).
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

    const query: Record<string, any> = {
      providerId: new Types.ObjectId(providerId),
      deletedAt: null,
    };

    if (!includeInactive) query.isActive = true;

    return this.queryServices(query, undefined, pagination, populationLevel);
  }

  async getServicesByCategory(
    categoryId: string,
    accessLevel: ProviderAccessLevel = ProviderAccessLevel.STANDARD,
    pagination?: PaginationOptions,
    populationLevel: PopulationLevel = PopulationLevel.MINIMAL
  ): Promise<ServiceQueryResult> {
    const query: Record<string, any> = {
      categoryId: new Types.ObjectId(categoryId),
      isActive: true,
      deletedAt: null,
    };

    if (accessLevel === ProviderAccessLevel.STANDARD) query.isPrivate = false;

    return this.queryServices(query, undefined, pagination, populationLevel);
  }

  /**
   * Get only public services (for business profile selection or public catalogue).
   */
  async getPublicServices(
    filters?: Omit<ServiceSearchFilters, "isPrivate">,
    pagination?: PaginationOptions,
    populationLevel: PopulationLevel = PopulationLevel.STANDARD
  ): Promise<ServiceQueryResult> {
    return this.queryServices(
      { isActive: true, deletedAt: null, isPrivate: false },
      filters,
      pagination,
      populationLevel
    );
  }

  /**
   * Get services visible to a provider based on their access level.
   * Standard providers see only public services.
   * Verified / company-trained / admin see all.
   */
  async getAccessibleServices(
    accessLevel: ProviderAccessLevel,
    filters?: ServiceSearchFilters,
    pagination?: PaginationOptions,
    populationLevel: PopulationLevel = PopulationLevel.MINIMAL
  ): Promise<ServiceQueryResult> {
    const query: Record<string, any> = { isActive: true, deletedAt: null };

    if (accessLevel === ProviderAccessLevel.STANDARD) query.isPrivate = false;

    return this.queryServices(query, filters, pagination, populationLevel);
  }

  async searchServices(
    searchTerm: string,
    accessLevel: ProviderAccessLevel = ProviderAccessLevel.STANDARD,
    filters?: ServiceSearchFilters,
    pagination?: PaginationOptions,
    populationLevel: PopulationLevel = PopulationLevel.STANDARD
  ): Promise<ServiceQueryResult> {
    const query: Record<string, any> = {
      $text: { $search: searchTerm },
      isActive: true,
      deletedAt: null,
    };

    if (accessLevel === ProviderAccessLevel.STANDARD) query.isPrivate = false;

    return this.queryServices(query, filters, pagination, populationLevel);
  }

  async getPendingServices(
    pagination?: PaginationOptions,
    populationLevel: PopulationLevel = PopulationLevel.STANDARD
  ): Promise<ServiceQueryResult> {
    return this.queryServices(
      {
        deletedAt: null,
        approvedAt: { $exists: false },
        rejectedAt: { $exists: false },
      },
      undefined,
      pagination,
      populationLevel
    );
  }

  async getAllServices(
    filters?: ServiceSearchFilters,
    pagination?: PaginationOptions,
    populationLevel: PopulationLevel = PopulationLevel.MINIMAL
  ): Promise<ServiceQueryResult> {
    return this.queryServices({ deletedAt: null }, filters, pagination, populationLevel);
  }

  // ── Update ──────────────────────────────────────────────────────────────

  async updateService(
    serviceId: string,
    data: UpdateServiceDTO
  ): Promise<Service | null> {
    try {
      const service = await ServiceModel.findOne({
        _id: serviceId,
        deletedAt: null,
      });

      if (!service) return null;

      // Regenerate slug only when title actually changes
      if (data.title && data.title !== service.title) {
        const baseSlug = slugify(data.title, { lower: true, strict: true });
        service.slug = await this.generateUniqueSlug(baseSlug, serviceId);
      }

      if (data.title !== undefined) service.title = data.title;
      if (data.description !== undefined) service.description = data.description;
      if (data.tags !== undefined) service.tags = data.tags;
      if (data.categoryId !== undefined)
        service.categoryId = new Types.ObjectId(data.categoryId);
      if (data.coverImage !== undefined) {
        service.coverImage = data.coverImage
          ? new Types.ObjectId(data.coverImage)
          : undefined;
      }
      if (data.isPrivate !== undefined) service.isPrivate = data.isPrivate;

      if (data.servicePricing) {
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
        const p = data.servicePricing;
        if (p.serviceBasePrice !== undefined)
          service.servicePricing.serviceBasePrice = p.serviceBasePrice;
        if (p.includeTravelFee !== undefined)
          service.servicePricing.includeTravelFee = p.includeTravelFee;
        if (p.includeAdditionalFees !== undefined)
          service.servicePricing.includeAdditionalFees = p.includeAdditionalFees;
        if (p.currency !== undefined)
          service.servicePricing.currency = p.currency;
        if (p.platformCommissionRate !== undefined)
          service.servicePricing.platformCommissionRate = p.platformCommissionRate;
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
   * Move a service from one provider to another.
   * Cleans up the old provider's `serviceOfferings` array and
   * adds the service to the new provider's array.
   */
  async reassignProvider(
    serviceId: string,
    newProviderId: string
  ): Promise<Service | null> {
    try {
      const service = await ServiceModel.findOne({
        _id: serviceId,
        deletedAt: null,
      });

      if (!service) return null;

      const newProviderOid = new Types.ObjectId(newProviderId);

      // Validate new provider exists
      const newProviderExists = await ProviderModel.exists({
        _id: newProviderOid,
        isDeleted: false,
      });

      if (!newProviderExists) {
        throw new Error(`Provider not found: ${newProviderId}`);
      }

      // Remove from old provider's offerings
      if (service.providerId) {
        await ProviderModel.findByIdAndUpdate(service.providerId, {
          $pull: { serviceOfferings: service._id },
        });
      }

      // Assign to new provider
      service.providerId = newProviderOid;
      await service.save();

      // Add to new provider's offerings
      await ProviderModel.findByIdAndUpdate(newProviderOid, {
        $addToSet: { serviceOfferings: service._id },
      });

      return service.toObject();
    } catch (error) {
      throw new Error(
        `Failed to reassign service: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Update service cover image.
   * Pass `null` to unlink the existing image.
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
        return ServiceModel.findOneAndUpdate(
          { _id: new Types.ObjectId(serviceId), deletedAt: null },
          { $unset: { coverImage: 1 } },
          { new: true }
        ).lean();
      }

      const linkResult = await this.imageLinkingService.linkImageToEntity(
        "service",
        serviceId,
        "service_cover",
        "coverImage",
        coverImageId,
        lastModifiedBy
      );

      if (linkResult.linked) {
        return ServiceModel.findById(serviceId).lean() as Promise<Service | null>;
      }

      throw new Error("Failed to link cover image");
    } catch (error) {
      throw error;
    }
  }

  // ── Moderation ──────────────────────────────────────────────────────────

  async approveService(
    serviceId: string,
    approverId: string
  ): Promise<Service | null> {
    try {
      const service = await ServiceModel.findOne({
        _id: serviceId,
        deletedAt: null,
      });

      if (!service) return null;
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

      if (!service) return null;
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

  // ── Delete / Restore ────────────────────────────────────────────────────

  /**
   * Soft-delete a service and remove it from the provider's `serviceOfferings`.
   */
  async deleteService(serviceId: string): Promise<boolean> {
    try {
      const service = await ServiceModel.findOne({
        _id: serviceId,
        deletedAt: null,
      });

      if (!service) return false;

      // Unlink from provider first
      if (service.providerId) {
        await ProviderModel.findByIdAndUpdate(service.providerId, {
          $pull: { serviceOfferings: service._id },
        });
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
   * Restore a soft-deleted service and re-add it to the provider's `serviceOfferings`.
   */
  async restoreService(serviceId: string): Promise<Service | null> {
    try {
      const service = await ServiceModel.findById(serviceId);

      if (!service || !service.deletedAt) return null;

      await service.restore();

      // Re-link to provider
      if (service.providerId) {
        await ProviderModel.findByIdAndUpdate(service.providerId, {
          $addToSet: { serviceOfferings: service._id },
        });
      }

      return service.toObject();
    } catch (error) {
      throw new Error(
        `Failed to restore service: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // ── Permissions ─────────────────────────────────────────────────────────

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

    if (!service) return false;
    if (!service.isPrivate) return true;

    return (
      accessLevel === ProviderAccessLevel.VERIFIED ||
      accessLevel === ProviderAccessLevel.COMPANY_TRAINED ||
      accessLevel === ProviderAccessLevel.ADMIN
    );
  }

  // ── Bulk / Stats ─────────────────────────────────────────────────────────

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

  async getServiceStats(): Promise<{
    total: number;
    active: number;
    pending: number;
    rejected: number;
    private: number;
    public: number;
  }> {
    const [total, active, pending, rejected, privateCount, publicCount] =
      await Promise.all([
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
      private: privateCount,
      public: publicCount,
    };
  }

  // ── Image helpers ─────────────────────────────────────────────────────────

  /**
   * Get complete service with hydrated cover image URL.
   */
  async getCompleteService(serviceId: string): Promise<{
    service: Service | null;
    coverImage?: { url: string; thumbnailUrl?: string; uploadedAt: Date };
  }> {
    try {
      if (!Types.ObjectId.isValid(serviceId)) {
        throw new Error("Invalid service ID");
      }

      const service = await this.getServiceById(serviceId, {
        populationLevel: PopulationLevel.DETAILED,
      });

      if (!service) return { service: null };

      const result: any = { service };

      if (service.coverImage) {
        const file = await this.fileService.getFileById(
          service.coverImage.toString()
        );

        if (file?.status === "active") {
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

  async getServiceImageStatus(serviceId: string) {
    return this.imageLinkingService.getImageStatus(
      "service",
      serviceId,
      "service_cover",
      "coverImage"
    );
  }

  async repairServiceCoverLinks(specificServiceId?: string) {
    return this.imageLinkingService.repairBrokenLinks(
      "service",
      "service_cover",
      "coverImage",
      specificServiceId
    );
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async generateUniqueSlug(
    baseSlug: string,
    excludeId?: string
  ): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const query: Record<string, any> = { slug };
      if (excludeId) query._id = { $ne: excludeId };
      const existing = await ServiceModel.findOne(query).select("_id").lean();
      if (!existing) return slug;
      slug = `${baseSlug}-${counter++}`;
    }
  }

  private async queryServices(
    baseQuery: Record<string, any>,
    filters?: ServiceSearchFilters,
    pagination?: PaginationOptions,
    populationLevel: PopulationLevel = PopulationLevel.MINIMAL
  ): Promise<ServiceQueryResult> {
    const query = { ...baseQuery };

    if (filters?.categoryId)
      query.categoryId = new Types.ObjectId(filters.categoryId);
    if (filters?.providerId)
      query.providerId = new Types.ObjectId(filters.providerId);
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;
    if (filters?.isPrivate !== undefined) query.isPrivate = filters.isPrivate;

    if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
      const priceFilter: any = {};
      if (filters.minPrice !== undefined) priceFilter.$gte = filters.minPrice;
      if (filters.maxPrice !== undefined) priceFilter.$lte = filters.maxPrice;
      query["servicePricing.serviceBasePrice"] = priceFilter;
    }

    if (filters?.tags?.length) query.tags = { $in: filters.tags };

    const page = pagination?.page ?? 1;
    const limit = Math.min(
      pagination?.limit ?? DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );
    const skip = (page - 1) * limit;
    const sortField = pagination?.sortBy ?? "createdAt";
    const sortOrder = pagination?.sortOrder === "asc" ? 1 : -1;

    const serviceQuery = this.applyPopulation(
      ServiceModel.find(query)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit),
      populationLevel
    );

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