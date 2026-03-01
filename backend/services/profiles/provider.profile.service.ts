// services/provider-profile.service.ts
import { Types, PopulateOptions, Query } from "mongoose";
import { ProviderModel } from "../../models/profiles/provider.model";
import ProfileModel from "../../models/profiles/userProfile.model";
import { ServiceModel } from "../../models/service.model";
import { Coordinates, UserLocation } from "../../types/base.types";
import {
  ProviderProfile,
  CreateProviderProfileRequestBody,
  UpdateProviderProfileRequestBody,
  PopulationLevel,
} from "../../types/profiles/providerProfile.types";
import { ImageLinkingService } from "../../utils/controller-utils/ImageLinkingService";
import { MongoDBFileService } from "../files/mongodb.files.service";
import { osmLocationService } from "./openstreetmap.location.service";

interface NearestProviderResult {
  provider: ProviderProfile;
  distanceKm: number;
  distanceFormatted: string;
}

interface FindNearestProvidersOptions {
  maxDistance?: number;
  limit?: number;
  serviceId?: string;
  categoryId?: string;
  populationLevel?: PopulationLevel;
}

export class ProviderProfileService {
  private imageLinkingService: ImageLinkingService;
  private fileService: MongoDBFileService;

  constructor() {
    this.imageLinkingService = new ImageLinkingService();
    this.fileService = new MongoDBFileService();
  }

  // ── Population helpers ──────────────────────────────────────────────────

  private getPopulationOptions(level: PopulationLevel): PopulateOptions[] {
    switch (level) {
      case PopulationLevel.NONE:
        return [];

      case PopulationLevel.MINIMAL:
        return [
          {
            path: "profile",
            select: "userId bio mobileNumber profilePictureId",
            populate: {
              path: "userId",
              select: "name email",
            },
          },
          {
            path: "serviceOfferings",
            select:
              "title slug servicePricing.serviceBasePrice servicePricing.currency",
          },
        ];

      case PopulationLevel.STANDARD:
        return [
          {
            path: "profile",
            select: "userId bio mobileNumber profilePictureId role",
            populate: [
              {
                path: "userId",
                select: "name email",
              },
              {
                path: "profilePictureId",
                select: "url thumbnailUrl",
              },
            ],
          },
          {
            path: "serviceOfferings",
            select: "title description slug servicePricing categoryId isActive",
          },
          {
            path: "BusinessGalleryImages",
            select: "url thumbnailUrl fileName",
          },
        ];

      case PopulationLevel.DETAILED:
        return [
          {
            path: "profile",
            select: "userId bio mobileNumber profilePictureId role createdAt",
            populate: [
              {
                path: "userId",
                select: "firstName lastName email createdAt",
              },
              {
                path: "profilePictureId",
                select: "url thumbnailUrl fileName uploadedAt",
              },
            ],
          },
          {
            path: "serviceOfferings",
            select:
              "title description slug servicePricing categoryId isPrivate isActive coverImage",
            populate: [
              {
                path: "categoryId",
                select: "catName slug",
              },
              {
                path: "coverImage",
                select: "url thumbnailUrl fileName uploadedAt",
              },
            ],
          },
          {
            path: "BusinessGalleryImages",
            select: "url thumbnailUrl fileName label uploadedAt",
          },
          {
            path: "IdDetails.fileImage",
            select: "url fileName uploadedAt",
          },
        ];

      default:
        return [];
    }
  }

  /**
   * Apply population options to any Mongoose query.
   *
   * `query` is typed as `any` intentionally: Mongoose's internal generics for
   * chained `.populate()` calls do not infer correctly when population is
   * applied dynamically at runtime. Type safety is re-established at each call
   * site via an explicit `as ProviderProfile | null` / `as ProviderProfile[]`
   * cast on the `.lean()` result.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private applyPopulation(query: any, populationLevel?: PopulationLevel): any {
    const level = populationLevel ?? PopulationLevel.STANDARD;
    this.getPopulationOptions(level).forEach((opt) => {
      query = query.populate(opt);
    });
    return query;
  }

  // ── Geo helpers ─────────────────────────────────────────────────────────

  private calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371;
    const dLat = this.toRadians(coord2.latitude - coord1.latitude);
    const dLon = this.toRadians(coord2.longitude - coord1.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(coord1.latitude)) *
        Math.cos(this.toRadians(coord2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private formatDistance(km: number): string {
    return km < 1 ? `${Math.round(km * 1000)}m away` : `${km.toFixed(1)}km away`;
  }

  // ── Location enrichment ─────────────────────────────────────────────────

  async enrichLocationData(
    ghanaPostGPS: string,
    coordinates?: Coordinates,
    nearbyLandmark?: string
  ): Promise<{
    success: boolean;
    location?: Partial<UserLocation>;
    error?: string;
  }> {
    try {
      const result = await osmLocationService.enrichLocationData(
        ghanaPostGPS,
        coordinates,
        nearbyLandmark
      );

      if (!result.success) {
        return { success: false, error: result.error ?? "Failed to enrich location data" };
      }

      return { success: true, location: result.location };
    } catch (error) {
      console.error("Error enriching location data:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Location enrichment failed",
      };
    }
  }

  async verifyLocation(
    ghanaPostGPS: string,
    coordinates: Coordinates
  ): Promise<{
    verified: boolean;
    confidence?: number;
    actualLocation?: string;
    distanceKm?: number;
  }> {
    try {
      return await osmLocationService.verifyLocation(ghanaPostGPS, coordinates);
    } catch (error) {
      console.error("Error verifying location:", error);
      return { verified: false, confidence: 0 };
    }
  }

  async geocodeAddress(address: string): Promise<{
    success: boolean;
    coordinates?: Coordinates;
    displayName?: string;
    error?: string;
  }> {
    try {
      const result = await osmLocationService.geocode(address, "gh");
      return {
        success: result.success,
        coordinates: result.coordinates,
        displayName: result.displayName,
        error: result.error,
      };
    } catch (error) {
      console.error("Error geocoding address:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Geocoding failed",
      };
    }
  }

  // ── Image linking helpers ────────────────────────────────────────────────

  /**
   * Link orphaned ID images (uploaded before profile was created) to the provider.
   */
  private async linkOrphanedIdImages(
    providerId: string,
    userId: string
  ): Promise<Types.ObjectId[]> {
    try {
      const files = await this.fileService.getFilesByEntity("provider", userId, {
        status: "active",
      });

      const idImages = files.filter((f) => f.label === "provider_id_image");
      if (idImages.length === 0) return [];

      const fileIds = idImages.map((img) => img._id as Types.ObjectId);

      await this.imageLinkingService.linkMultipleImagesToProvider(
        providerId,
        fileIds,
        "IdDetails.fileImage",
        userId
      );

      return fileIds;
    } catch (error) {
      console.error("Error linking orphaned ID images:", error);
      return [];
    }
  }

  /**
   * Link orphaned gallery images (uploaded before profile was created) to the provider.
   */
  private async linkOrphanedGalleryImages(
    providerId: string,
    userId: string
  ): Promise<Types.ObjectId[]> {
    try {
      const files = await this.fileService.getFilesByEntity("provider", userId, {
        status: "active",
      });

      const galleryImages = files.filter((f) => f.label === "provider_gallery");
      if (galleryImages.length === 0) return [];

      const fileIds = galleryImages.map((img) => img._id as Types.ObjectId);

      await this.imageLinkingService.linkMultipleImagesToProvider(
        providerId,
        fileIds,
        "BusinessGalleryImages",
        userId
      );

      return fileIds;
    } catch (error) {
      console.error("Error linking orphaned gallery images:", error);
      return [];
    }
  }

  // ── CRUD ────────────────────────────────────────────────────────────────

  /**
   * Create a provider profile.
   *
   * A provider must exist before they can create services.
   * Services are linked back to the provider automatically by `ServiceService.createService`.
   * The `serviceOfferings` array on the provider acts as a convenience cache
   * that stays in sync through the service layer.
   */
  async createProviderProfile(
    userId: string,
    data: CreateProviderProfileRequestBody
  ): Promise<ProviderProfile> {
    try {
      // Verify user profile
      const userProfile = await ProfileModel.findOne({
        userId: new Types.ObjectId(userId),
        isDeleted: false,
      });

      if (!userProfile) throw new Error("User profile not found");

      if (!userProfile?.role?.includes("service_provider" as any)) {
        throw new Error("User must have provider role");
      }

      // Prevent duplicate provider profiles
      const existingProvider = await ProviderModel.findOne({
        profile: userProfile._id,
        isDeleted: false,
      });

      if (existingProvider) throw new Error("Provider profile already exists");

      // Enrich location data from OSM
      const locationEnrichment = await this.enrichLocationData(
        data.locationData.ghanaPostGPS,
        data.locationData.gpsCoordinates,
        data.locationData.nearbyLandmark
      );

      if (locationEnrichment.success && locationEnrichment.location) {
        data.locationData = { ...data.locationData, ...locationEnrichment.location };
      } else {
        console.warn(
          "Location enrichment failed, using provided data:",
          locationEnrichment.error
        );
      }

      // Validate service offerings if pre-populated (edge case — normally empty at creation)
      if (data.serviceOfferings && data.serviceOfferings.length > 0) {
        const services = await ServiceModel.find({
          _id: { $in: data.serviceOfferings },
          isActive: true,
          deletedAt: null,
        });

        if (services.length !== data.serviceOfferings.length) {
          throw new Error("Some services are invalid or inactive");
        }

        const hasPrivateServices = services.some((s) => s.isPrivate);
        if (hasPrivateServices && !data.isCompanyTrained) {
          throw new Error(
            "Only company-trained providers can offer private services"
          );
        }
      }

      // Create profile — images are linked separately after save
      const providerProfile = new ProviderModel({
        ...data,
        profile: userProfile._id,
        // Start with empty arrays; images and services are added through
        // their respective dedicated flows
        serviceOfferings: data.serviceOfferings ?? [],
        BusinessGalleryImages: [],
        IdDetails: data.IdDetails
          ? {
              idType: data.IdDetails.idType,
              idNumber: data.IdDetails.idNumber,
              fileImage: [],
            }
          : undefined,
      });

      await providerProfile.save();

      // Link any pre-uploaded ID images
      const idImageIds = await this.linkOrphanedIdImages(
        providerProfile._id.toString(),
        userId
      );

      if (idImageIds.length > 0 && providerProfile.IdDetails) {
        providerProfile.IdDetails.fileImage = idImageIds;
        await providerProfile.save();
      }

      // Link any pre-uploaded gallery images (uncommon at creation time)
      const galleryImageIds = await this.linkOrphanedGalleryImages(
        providerProfile._id.toString(),
        userId
      );

      if (galleryImageIds.length > 0) {
        providerProfile.BusinessGalleryImages = galleryImageIds;
        await providerProfile.save();
      }

      return providerProfile;
    } catch (error) {
      console.error("Error creating provider profile:", error);
      throw error;
    }
  }

  async updateProviderProfile(
    providerId: string,
    data: UpdateProviderProfileRequestBody,
    updatedBy?: string
  ): Promise<ProviderProfile> {
    try {
      const provider = await ProviderModel.findOne({
        _id: new Types.ObjectId(providerId),
        isDeleted: false,
      });

      if (!provider) throw new Error("Provider profile not found");

      // Re-enrich location if GPS data changed
      if (data.locationData) {
        const needsEnrichment =
          data.locationData.ghanaPostGPS !== provider.locationData.ghanaPostGPS ||
          (data.locationData.gpsCoordinates &&
            (data.locationData.gpsCoordinates.latitude !==
              provider.locationData.gpsCoordinates?.latitude ||
              data.locationData.gpsCoordinates.longitude !==
                provider.locationData.gpsCoordinates?.longitude));

        if (needsEnrichment) {
          const locationEnrichment = await this.enrichLocationData(
            data.locationData.ghanaPostGPS ?? provider.locationData.ghanaPostGPS,
            data.locationData.gpsCoordinates ?? provider.locationData.gpsCoordinates,
            data.locationData.nearbyLandmark
          );

          if (locationEnrichment.success && locationEnrichment.location) {
            data.locationData = {
              ...provider.locationData,
              ...data.locationData,
              ...locationEnrichment.location,
            };
          }
        }
      }

      // Validate any new service offerings
      if (data.serviceOfferings && data.serviceOfferings.length > 0) {
        const services = await ServiceModel.find({
          _id: { $in: data.serviceOfferings },
          isActive: true,
          deletedAt: null,
        });

        if (services.length !== data.serviceOfferings.length) {
          throw new Error("Some services are invalid or inactive");
        }

        const hasPrivateServices = services.some((s) => s.isPrivate);
        const isCompanyTrained = data.isCompanyTrained ?? provider.isCompanyTrained;

        if (hasPrivateServices && !isCompanyTrained) {
          throw new Error(
            "Only company-trained providers can offer private services"
          );
        }
      }

      // Images have dedicated update methods — never update them here
      const { BusinessGalleryImages, IdDetails, ...updateData } = data;

      Object.assign(provider, updateData);
      await provider.save();

      return provider;
    } catch (error) {
      console.error("Error updating provider profile:", error);
      throw error;
    }
  }

  async getProviderProfile(
    providerId: string,
    options: {
      includeDeleted?: boolean;
      populationLevel?: PopulationLevel;
    } = {}
  ): Promise<ProviderProfile | null> {
    try {
      const {
        includeDeleted = false,
        populationLevel = PopulationLevel.DETAILED,
      } = options;

      const query: any = { _id: new Types.ObjectId(providerId) };
      if (!includeDeleted) query.isDeleted = false;

      const providerQuery = this.applyPopulation(
        ProviderModel.findOne(query),
        populationLevel
      );

      return (await providerQuery.lean()) as ProviderProfile | null;
    } catch (error) {
      console.error("Error fetching provider profile:", error);
      throw new Error("Failed to fetch provider profile");
    }
  }

  async getProviderByUserId(
    userId: string,
    populationLevel: PopulationLevel = PopulationLevel.DETAILED
  ): Promise<ProviderProfile | null> {
    try {
      const userProfile = await ProfileModel.findOne({
        userId: new Types.ObjectId(userId),
        isDeleted: false,
      }).select("_id userId");

      if (!userProfile) return null;

      const providerQuery = this.applyPopulation(
        ProviderModel.findOne({ profile: userProfile._id, isDeleted: false }),
        populationLevel
      );

      return (await providerQuery.lean()) as ProviderProfile | null;
    } catch (error) {
      console.error("Error fetching provider by user ID:", error);
      throw new Error("Failed to fetch provider profile");
    }
  }

  // ── Gallery images ──────────────────────────────────────────────────────

  /**
   * Link newly uploaded gallery images to the provider.
   * This is the normal flow — gallery images are added AFTER profile creation.
   */
  async addGalleryImages(
    providerId: string,
    userId: string
  ): Promise<ProviderProfile> {
    try {
      const provider = await ProviderModel.findOne({
        _id: new Types.ObjectId(providerId),
        isDeleted: false,
      });

      if (!provider) throw new Error("Provider profile not found");

      const newGalleryImageIds = await this.linkOrphanedGalleryImages(
        providerId,
        userId
      );

      if (newGalleryImageIds.length === 0) {
        throw new Error("No gallery images found to add");
      }

      const existingIds = provider.BusinessGalleryImages ?? [];
      provider.BusinessGalleryImages = [...existingIds, ...newGalleryImageIds];

      await provider.save();
      return provider;
    } catch (error) {
      console.error("Error adding gallery images:", error);
      throw error;
    }
  }

  async removeGalleryImage(
    providerId: string,
    imageId: string,
    userId: string
  ): Promise<ProviderProfile> {
    try {
      const provider = await ProviderModel.findOne({
        _id: new Types.ObjectId(providerId),
        isDeleted: false,
      });

      if (!provider) throw new Error("Provider profile not found");

      provider.BusinessGalleryImages = (
        provider.BusinessGalleryImages ?? []
      ).filter((id) => id.toString() !== imageId);

      await provider.save();
      await this.fileService.archiveFile(imageId);

      return provider;
    } catch (error) {
      console.error("Error removing gallery image:", error);
      throw error;
    }
  }

  // ── ID images ───────────────────────────────────────────────────────────

  async addIdImages(
    providerId: string,
    userId: string
  ): Promise<ProviderProfile> {
    try {
      const provider = await ProviderModel.findOne({
        _id: new Types.ObjectId(providerId),
        isDeleted: false,
      });

      if (!provider) throw new Error("Provider profile not found");
      if (!provider.IdDetails) {
        throw new Error(
          "Cannot add ID images without IdDetails. Set ID type and number first."
        );
      }

      const newIdImageIds = await this.linkOrphanedIdImages(providerId, userId);

      if (newIdImageIds.length === 0) throw new Error("No ID images found to add");

      const existingIds = provider.IdDetails.fileImage ?? [];
      provider.IdDetails.fileImage = [...existingIds, ...newIdImageIds];

      await provider.save();
      return provider;
    } catch (error) {
      console.error("Error adding ID images:", error);
      throw error;
    }
  }

  async replaceIdImages(
    providerId: string,
    userId: string
  ): Promise<ProviderProfile> {
    try {
      const provider = await ProviderModel.findOne({
        _id: new Types.ObjectId(providerId),
        isDeleted: false,
      });

      if (!provider) throw new Error("Provider profile not found");

      // Archive old images
      for (const imageId of provider.IdDetails?.fileImage ?? []) {
        try {
          await this.fileService.archiveFile(imageId);
        } catch (err) {
          console.error(`Failed to archive ID image ${imageId}:`, err);
        }
      }

      const newIdImageIds = await this.linkOrphanedIdImages(providerId, userId);

      if (newIdImageIds.length === 0) {
        throw new Error("No ID images found to replace with");
      }

      if (provider.IdDetails) {
        provider.IdDetails.fileImage = newIdImageIds;
      }

      await provider.save();
      return provider;
    } catch (error) {
      console.error("Error replacing ID images:", error);
      throw error;
    }
  }

  async removeIdImage(
    providerId: string,
    imageId: string,
    userId: string
  ): Promise<ProviderProfile> {
    try {
      const provider = await ProviderModel.findOne({
        _id: new Types.ObjectId(providerId),
        isDeleted: false,
      });

      if (!provider) throw new Error("Provider profile not found");
      if (!provider.IdDetails?.fileImage) throw new Error("No ID images to remove");

      provider.IdDetails.fileImage = provider.IdDetails.fileImage.filter(
        (id) => id.toString() !== imageId
      );

      await provider.save();
      await this.fileService.archiveFile(imageId);

      return provider;
    } catch (error) {
      console.error("Error removing ID image:", error);
      throw error;
    }
  }

  async updateIdDetails(
    providerId: string,
    userId: string,
    idDetails: {
      idType: string;
      idNumber: string;
      replaceImages?: boolean;
    }
  ): Promise<ProviderProfile> {
    try {
      const provider = await ProviderModel.findOne({
        _id: new Types.ObjectId(providerId),
        isDeleted: false,
      });

      if (!provider) throw new Error("Provider profile not found");

      let imageIds: Types.ObjectId[] = [];

      if (idDetails.replaceImages) {
        for (const imageId of provider.IdDetails?.fileImage ?? []) {
          try {
            await this.fileService.archiveFile(imageId);
          } catch (err) {
            console.error(`Failed to archive ID image ${imageId}:`, err);
          }
        }

        const newIds = await this.linkOrphanedIdImages(providerId, userId);
        if (newIds.length > 0) imageIds = newIds;
      } else {
        imageIds = provider.IdDetails?.fileImage ?? [];
      }

      provider.IdDetails = {
        idType: idDetails.idType as any,
        idNumber: idDetails.idNumber,
        fileImage: imageIds,
      };

      await provider.save();
      return provider;
    } catch (error) {
      console.error("Error updating ID details:", error);
      throw error;
    }
  }

  // ── Location-based queries ───────────────────────────────────────────────

  async findNearestProviders(
    userLocation: Coordinates,
    options: FindNearestProvidersOptions = {}
  ): Promise<NearestProviderResult[]> {
    try {
      const {
        maxDistance = 50,
        limit = 10,
        serviceId,
        categoryId,
        populationLevel = PopulationLevel.STANDARD,
      } = options;

      const query: any = {
        isDeleted: false,
        "locationData.gpsCoordinates": { $exists: true },
      };

      if (serviceId) query.serviceOfferings = new Types.ObjectId(serviceId);

      let providerQuery = ProviderModel.find(query);
      providerQuery = this.applyPopulation(providerQuery, populationLevel);

      let providers = (await providerQuery.lean()) as ProviderProfile[];

      if (categoryId) {
        providers = providers.filter((p) =>
          p?.serviceOfferings?.some(
            (s: any) => s.categoryId?.toString() === categoryId
          )
        );
      }

      return providers
        .map((provider) => {
          const distance = this.calculateDistance(
            userLocation,
            provider.locationData.gpsCoordinates!
          );
          return {
            provider,
            distanceKm: distance,
            distanceFormatted: this.formatDistance(distance),
          };
        })
        .filter((p) => p.distanceKm <= maxDistance)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, limit);
    } catch (error) {
      console.error("Error finding nearest providers:", error);
      throw new Error("Failed to find nearest providers");
    }
  }

  async findProvidersByLocation(
    region: string,
    city?: string,
    options: {
      serviceId?: string;
      limit?: number;
      populationLevel?: PopulationLevel;
    } = {}
  ): Promise<ProviderProfile[]> {
    try {
      const {
        serviceId,
        limit = 20,
        populationLevel = PopulationLevel.MINIMAL,
      } = options;

      const query: any = { isDeleted: false, "locationData.region": region };
      if (city) query["locationData.city"] = city;
      if (serviceId) query.serviceOfferings = new Types.ObjectId(serviceId);

      const providerQuery = this.applyPopulation(
        ProviderModel.find(query).limit(limit),
        populationLevel
      );

      return (await providerQuery.lean()) as ProviderProfile[];
    } catch (error) {
      console.error("Error finding providers by location:", error);
      throw new Error("Failed to find providers");
    }
  }

  async getDistanceToProvider(
    customerLocation: Coordinates,
    providerId: string
  ): Promise<{ distanceKm: number; distanceFormatted: string } | null> {
    try {
      const provider = await ProviderModel.findOne({
        _id: new Types.ObjectId(providerId),
        isDeleted: false,
      }).select("locationData.gpsCoordinates");

      if (!provider?.locationData.gpsCoordinates) return null;

      const distance = this.calculateDistance(
        customerLocation,
        provider.locationData.gpsCoordinates
      );

      return { distanceKm: distance, distanceFormatted: this.formatDistance(distance) };
    } catch (error) {
      console.error("Error calculating distance to provider:", error);
      return null;
    }
  }

  async searchProviders(params: {
    searchTerm?: string;
    region?: string;
    city?: string;
    serviceIds?: string[];
    categoryId?: string;
    isCompanyTrained?: boolean;
    requireInitialDeposit?: boolean;
    userLocation?: Coordinates;
    maxDistance?: number;
    limit?: number;
    skip?: number;
    populationLevel?: PopulationLevel;
  }): Promise<{
    providers: (ProviderProfile & {
      distance?: number;
      distanceFormatted?: string;
    })[];
    total: number;
  }> {
    try {
      const { populationLevel = PopulationLevel.STANDARD, ...restParams } = params;

      const query: any = { isDeleted: false };
      if (restParams.region) query["locationData.region"] = restParams.region;
      if (restParams.city) query["locationData.city"] = restParams.city;

      if (restParams.serviceIds?.length) {
        query.serviceOfferings = {
          $in: restParams.serviceIds.map((id) => new Types.ObjectId(id)),
        };
      }

      if (restParams.isCompanyTrained !== undefined)
        query.isCompanyTrained = restParams.isCompanyTrained;
      if (restParams.requireInitialDeposit !== undefined)
        query.requireInitialDeposit = restParams.requireInitialDeposit;

      const providerQuery = this.applyPopulation(
        ProviderModel.find(query)
          .skip(restParams.skip ?? 0)
          .limit(restParams.limit ?? 20),
        populationLevel
      );

      let providers = (await providerQuery.lean()) as ProviderProfile[];
      const total = await ProviderModel.countDocuments(query);

      // Post-filter by category (requires populated serviceOfferings)
      if (restParams.categoryId) {
        providers = providers.filter((p: any) =>
          p?.serviceOfferings?.some(
            (s: any) => s.categoryId?.toString() === restParams.categoryId
          )
        );
      }

      if (restParams.userLocation) {
        type WithDistance = ProviderProfile & {
          distance: number;
          distanceFormatted: string;
        };

        const withDistance: WithDistance[] = providers
          .filter((p: any) => p.locationData.gpsCoordinates)
          .map((p: any) => {
            const distance = this.calculateDistance(
              restParams.userLocation!,
              p.locationData.gpsCoordinates!
            );
            return { ...p, distance, distanceFormatted: this.formatDistance(distance) };
          })
          .filter(
            (p: any) =>
              !restParams.maxDistance || p.distance <= restParams.maxDistance
          )
          .sort((a: any, b: any) => a.distance - b.distance);

        return { providers: withDistance, total };
      }

      return { providers, total };
    } catch (error) {
      console.error("Error searching providers:", error);
      throw new Error("Failed to search providers");
    }
  }

  // ── Soft delete / restore ───────────────────────────────────────────────

  async deleteProviderProfile(
    providerId: string,
    deletedBy: string
  ): Promise<void> {
    try {
      const provider = await ProviderModel.findById(providerId);
      if (!provider) throw new Error("Provider profile not found");

      // Archive gallery images
      for (const imageId of provider.BusinessGalleryImages ?? []) {
        try {
          await this.fileService.archiveFile(imageId);
        } catch (err) {
          console.error(`Failed to archive gallery image ${imageId}:`, err);
        }
      }

      // Archive ID images
      for (const imageId of provider.IdDetails?.fileImage ?? []) {
        try {
          await this.fileService.archiveFile(imageId);
        } catch (err) {
          console.error(`Failed to archive ID image ${imageId}:`, err);
        }
      }

      await provider.softDelete(deletedBy);
    } catch (error) {
      console.error("Error deleting provider profile:", error);
      throw error;
    }
  }

  async restoreProviderProfile(providerId: string): Promise<void> {
    try {
      const provider = await ProviderModel.findById(providerId);
      if (!provider) throw new Error("Provider profile not found");

      // Restore gallery images
      for (const imageId of provider.BusinessGalleryImages ?? []) {
        try {
          await this.fileService.restoreFile(imageId);
        } catch (err) {
          console.error(`Failed to restore gallery image ${imageId}:`, err);
        }
      }

      // Restore ID images
      for (const imageId of provider.IdDetails?.fileImage ?? []) {
        try {
          await this.fileService.restoreFile(imageId);
        } catch (err) {
          console.error(`Failed to restore ID image ${imageId}:`, err);
        }
      }

      await provider.restore();
    } catch (error) {
      console.error("Error restoring provider profile:", error);
      throw error;
    }
  }
}