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
} from "../../types/providerProfile.types";
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

export enum PopulationLevel {
  NONE = "none",
  MINIMAL = "minimal",
  STANDARD = "standard",
  DETAILED = "detailed",
}

export class ProviderProfileService {
  private imageLinkingService: ImageLinkingService;
  private fileService: MongoDBFileService;

  constructor() {
    this.imageLinkingService = new ImageLinkingService();
    this.fileService = new MongoDBFileService();
  }

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
            select: "title description slug servicePricing categoryId",
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
              "title description slug servicePricing categoryId isPrivate isActive",
            populate: {
              path: "categoryId",
              select: "catName slug",
            },
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

  private applyPopulation<T>(
    query: Query<T, any>,
    populationLevel?: PopulationLevel
  ): Query<T, any> {
    const level = populationLevel || PopulationLevel.STANDARD;
    const populateOptions = this.getPopulationOptions(level);
    populateOptions.forEach((popOption) => {
      query = query.populate(popOption);
    });
    return query;
  }

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

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private formatDistance(km: number): string {
    if (km < 1) {
      return `${Math.round(km * 1000)}m away`;
    }
    return `${km.toFixed(1)}km away`;
  }

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
        return {
          success: false,
          error: result.error || "Failed to enrich location data",
        };
      }

      return {
        success: true,
        location: result.location,
      };
    } catch (error) {
      console.error("Error enriching location data:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Location enrichment failed",
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

  async getAvailablePrivateServices(providerId: string): Promise<any[]> {
    try {
      const provider = await ProviderModel.findById(providerId);

      if (!provider || !provider.isCompanyTrained) {
        return [];
      }

      const privateServices = await ServiceModel.find({
        isPrivate: true,
        isActive: true,
        deletedAt: null,
      }).select("_id title description categoryId servicePricing");

      return privateServices;
    } catch (error) {
      console.error("Error fetching private services:", error);
      throw new Error("Failed to fetch available private services");
    }
  }

  /**
   * Create file records for gallery images
   */
  private async createGalleryImageRecords(
    imageUrls: string[],
    providerId: string,
    uploaderId: string
  ): Promise<Types.ObjectId[]> {
    const fileIds: Types.ObjectId[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      const fileName = `gallery-${i + 1}-${Date.now()}`;

      try {
        const file = await this.fileService.createFile({
          uploaderId: new Types.ObjectId(uploaderId),
          url,
          fileName,
          storageProvider: "cloudinary", // Adjust based on your setup
          entityType: "provider",
          entityId: new Types.ObjectId(providerId),
          label: "provider_gallery",
          status: "active",
        });

        fileIds.push(file._id as Types.ObjectId);
      } catch (error) {
        console.error(`Failed to create file record for ${url}:`, error);
      }
    }

    return fileIds;
  }

  /**
   * Create file records for ID images
   */
  private async createIdImageRecords(
    imageUrls: string[],
    providerId: string,
    uploaderId: string
  ): Promise<Types.ObjectId[]> {
    const fileIds: Types.ObjectId[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      const fileName = `id-image-${i + 1}-${Date.now()}`;

      try {
        const file = await this.fileService.createFile({
          uploaderId: new Types.ObjectId(uploaderId),
          url,
          fileName,
          storageProvider: "cloudinary",
          entityType: "provider",
          entityId: new Types.ObjectId(providerId),
          label: "provider_id_image",
          status: "active",
        });

        fileIds.push(file._id as Types.ObjectId);
      } catch (error) {
        console.error(`Failed to create file record for ID image ${url}:`, error);
      }
    }

    return fileIds;
  }

  async createProviderProfile(
    profileId: string,
    data: CreateProviderProfileRequestBody
  ): Promise<ProviderProfile> {
    try {
      // Verify user profile
      const userProfile = await ProfileModel.findOne({
        userId: new Types.ObjectId(profileId),
        isDeleted: false,
      });

      if (!userProfile) {
        throw new Error("User profile not found");
      }

      if (!userProfile?.role?.includes("service_provider" as any)) {
        throw new Error("User must have provider role");
      }

      // Check if provider profile exists
      const existingProvider = await ProviderModel.findOne({
        profile: userProfile._id,
        isDeleted: false,
      });

      if (existingProvider) {
        throw new Error("Provider profile already exists");
      }

      // Enrich location data
      const locationEnrichment = await this.enrichLocationData(
        data.locationData.ghanaPostGPS,
        data.locationData.gpsCoordinates,
        data.locationData.nearbyLandmark
      );

      if (locationEnrichment.success && locationEnrichment.location) {
        data.locationData = {
          ...data.locationData,
          ...locationEnrichment.location,
        };
      } else {
        console.warn(
          "Location enrichment failed, using provided data:",
          locationEnrichment.error
        );
      }

      // Verify service offerings
      if (data.serviceOfferings && data.serviceOfferings.length > 0) {
        const services = await ServiceModel.find({
          _id: { $in: data.serviceOfferings },
          isActive: true,
          deletedAt: null,
        });

        const hasPrivateServices = services.some((s) => s.isPrivate);
        if (hasPrivateServices && !data.isCompanyTrained) {
          throw new Error(
            "Only company-trained providers can offer private services"
          );
        }

        if (services.length !== data.serviceOfferings.length) {
          throw new Error("Some services are invalid or inactive");
        }
      }

      // Create provider profile first (without images)
      const providerProfile = new ProviderModel({
        ...data,
        profile: userProfile._id,
        BusinessGalleryImages: [],
        IdDetails: data.IdDetails ? {
          ...data.IdDetails,
          fileImage: []
        } : undefined,
      });

      await providerProfile.save();

      // Process gallery images if provided
      if (data.BusinessGalleryImages && data.BusinessGalleryImages.length > 0) {
        const galleryFileIds = await this.createGalleryImageRecords(
          data.BusinessGalleryImages as unknown as string[], // Cast if needed
          providerProfile._id.toString(),
          profileId
        );

        // Update provider with gallery image IDs
        providerProfile.BusinessGalleryImages = galleryFileIds;
        await providerProfile.save();
      }

      // Process ID images if provided
      if (data.IdDetails?.fileImage && data.IdDetails.fileImage.length > 0) {
        const idFileIds = await this.createIdImageRecords(
          data.IdDetails.fileImage as unknown as string[],
          providerProfile._id.toString(),
          profileId
        );

        // Update provider with ID image IDs
        if (!providerProfile.IdDetails) {
          providerProfile.IdDetails = { fileImage: [] } as any;
        }
        if (providerProfile.IdDetails) {
          providerProfile.IdDetails.fileImage = idFileIds;
          await providerProfile.save();
        }
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

      if (!provider) {
        throw new Error("Provider profile not found");
      }

      // Handle location updates
      if (data.locationData) {
        const needsEnrichment =
          data.locationData.ghanaPostGPS !==
            provider.locationData.ghanaPostGPS ||
          (data.locationData.gpsCoordinates &&
            (data.locationData.gpsCoordinates.latitude !==
              provider.locationData.gpsCoordinates?.latitude ||
              data.locationData.gpsCoordinates.longitude !==
                provider.locationData.gpsCoordinates?.longitude));

        if (needsEnrichment) {
          const locationEnrichment = await this.enrichLocationData(
            data.locationData.ghanaPostGPS ||
              provider.locationData.ghanaPostGPS,
            data.locationData.gpsCoordinates ||
              provider.locationData.gpsCoordinates,
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

      // Handle gallery images update
      if (data.BusinessGalleryImages && data.BusinessGalleryImages.length > 0) {
        // Archive old gallery images
        const oldImageIds = provider.BusinessGalleryImages || [];
        for (const imageId of oldImageIds) {
          try {
            await this.fileService.archiveFile(imageId);
          } catch (error) {
            console.error(`Failed to archive gallery image ${imageId}:`, error);
          }
        }

        // Create new gallery image records
        const newGalleryFileIds = await this.createGalleryImageRecords(
          data.BusinessGalleryImages as unknown as string[],
          providerId,
          updatedBy || providerId
        );

        data.BusinessGalleryImages = newGalleryFileIds as any;
      }

      // Handle ID images update
      if (data.IdDetails?.fileImage && data.IdDetails.fileImage.length > 0) {
        // Archive old ID images
        const oldIdImageIds = provider.IdDetails?.fileImage || [];
        for (const imageId of oldIdImageIds) {
          try {
            await this.fileService.archiveFile(imageId);
          } catch (error) {
            console.error(`Failed to archive ID image ${imageId}:`, error);
          }
        }

        // Create new ID image records
        const newIdFileIds = await this.createIdImageRecords(
          data.IdDetails.fileImage as unknown as string[],
          providerId,
          updatedBy || providerId
        );

        if (!data.IdDetails) {
          data.IdDetails = {} as any;
        } else {
          data.IdDetails.fileImage = newIdFileIds as any;
        }
      }

      // Verify service offerings
      if (data.serviceOfferings && data.serviceOfferings.length > 0) {
        const services = await ServiceModel.find({
          _id: { $in: data.serviceOfferings },
          isActive: true,
          deletedAt: null,
        });

        const hasPrivateServices = services.some((s) => s.isPrivate);
        const isCompanyTrained =
          data.isCompanyTrained ?? provider.isCompanyTrained;

        if (hasPrivateServices && !isCompanyTrained) {
          throw new Error(
            "Only company-trained providers can offer private services"
          );
        }

        if (services.length !== data.serviceOfferings.length) {
          throw new Error("Some services are invalid or inactive");
        }
      }

      // Update provider profile
      Object.assign(provider, data);
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

      if (!includeDeleted) {
        query.isDeleted = false;
      }

      let providerQuery = ProviderModel.findOne(query);
      providerQuery = this.applyPopulation(providerQuery, populationLevel);

      return await providerQuery.lean();
    } catch (error) {
      console.error("Error fetching provider profile:", error);
      throw new Error("Failed to fetch provider profile");
    }
  }

  async getProviderByProfile(
    userProfileId: string,
    populationLevel: PopulationLevel = PopulationLevel.STANDARD
  ): Promise<ProviderProfile | null> {
    try {
      let providerQuery = ProviderModel.findOne({
        profile: new Types.ObjectId(userProfileId),
        isDeleted: false,
      });

      providerQuery = this.applyPopulation(providerQuery, populationLevel);

      return await providerQuery.lean();
    } catch (error) {
      console.error("Error fetching provider by profile:", error);
      throw new Error("Failed to fetch provider profile");
    }
  }

  async getProviderByUserId(
    userId: string,
    populationLevel: PopulationLevel = PopulationLevel.DETAILED
  ): Promise<ProviderProfile | null> {
    try {
      console.log("🔍 Looking for provider with userId:", userId);

      const userProfile = await ProfileModel.findOne({
        userId: new Types.ObjectId(userId),
        isDeleted: false,
      }).select("_id userId");

      if (!userProfile) {
        console.log("❌ No user profile found for userId:", userId);
        return null;
      }

      console.log("✅ Found user profile:", userProfile._id);

      let providerQuery = ProviderModel.findOne({
        profile: userProfile._id,
        isDeleted: false,
      });

      providerQuery = this.applyPopulation(providerQuery, populationLevel);

      const provider = await providerQuery.lean();

      if (!provider) {
        console.log("❌ No provider profile found");
        return null;
      }

      console.log("✅ Found provider profile:", provider._id);
      return provider;
    } catch (error) {
      console.error("❌ Error fetching provider by user ID:", error);
      throw new Error("Failed to fetch provider profile");
    }
  }

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

      if (serviceId) {
        query.serviceOfferings = new Types.ObjectId(serviceId);
      }

      let providerQuery = ProviderModel.find(query);
      providerQuery = this.applyPopulation(providerQuery, populationLevel);

      let providers = await providerQuery.lean();

      if (categoryId) {
        providers = providers.filter((p) =>
          p?.serviceOfferings?.some(
            (s: any) => s.categoryId?.toString() === categoryId
          )
        );
      }

      const providersWithDistance: NearestProviderResult[] = providers
        .map((provider) => {
          const providerCoords = provider.locationData.gpsCoordinates!;
          const distance = this.calculateDistance(userLocation, providerCoords);

          return {
            provider,
            distanceKm: distance,
            distanceFormatted: this.formatDistance(distance),
          };
        })
        .filter((p) => p.distanceKm <= maxDistance)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, limit);

      return providersWithDistance;
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

      const query: any = {
        isDeleted: false,
        "locationData.region": region,
      };

      if (city) {
        query["locationData.city"] = city;
      }

      if (serviceId) {
        query.serviceOfferings = new Types.ObjectId(serviceId);
      }

      let providerQuery = ProviderModel.find(query).limit(limit);
      providerQuery = this.applyPopulation(providerQuery, populationLevel);

      return await providerQuery.lean();
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

      if (!provider || !provider.locationData.gpsCoordinates) {
        return null;
      }

      const distance = this.calculateDistance(
        customerLocation,
        provider.locationData.gpsCoordinates
      );

      return {
        distanceKm: distance,
        distanceFormatted: this.formatDistance(distance),
      };
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
      const { populationLevel = PopulationLevel.STANDARD, ...restParams } =
        params;
      const query: any = { isDeleted: false };

      if (restParams.region) query["locationData.region"] = restParams.region;
      if (restParams.city) query["locationData.city"] = restParams.city;

      if (restParams.serviceIds && restParams.serviceIds.length > 0) {
        query.serviceOfferings = {
          $in: restParams.serviceIds.map((id) => new Types.ObjectId(id)),
        };
      }

      if (restParams.isCompanyTrained !== undefined) {
        query.isCompanyTrained = restParams.isCompanyTrained;
      }
      if (restParams.requireInitialDeposit !== undefined) {
        query.requireInitialDeposit = restParams.requireInitialDeposit;
      }

      let providerQuery = ProviderModel.find(query)
        .skip(restParams.skip || 0)
        .limit(restParams.limit || 20);

      providerQuery = this.applyPopulation(providerQuery, populationLevel);

      let providers = await providerQuery.lean();
      const total = await ProviderModel.countDocuments(query);

      if (restParams.categoryId) {
        providers = providers.filter((p) =>
          p?.serviceOfferings?.some(
            (s: any) => s.categoryId?.toString() === restParams.categoryId
          )
        );
      }

      if (restParams.userLocation) {
        type ProviderWithDistance = (typeof providers)[number] & {
          distance: number;
          distanceFormatted: string;
        };

        const providersWithDistance: ProviderWithDistance[] = providers
          .filter((provider) => provider.locationData.gpsCoordinates)
          .map((provider) => {
            const distance = this.calculateDistance(
              restParams.userLocation!,
              provider.locationData.gpsCoordinates!
            );

            return {
              ...provider,
              distance,
              distanceFormatted: this.formatDistance(distance),
            };
          })
          .filter(
            (p) =>
              !restParams.maxDistance || p.distance <= restParams.maxDistance
          )
          .sort((a, b) => a.distance - b.distance);

        return { providers: providersWithDistance, total };
      }

      return { providers, total };
    } catch (error) {
      console.error("Error searching providers:", error);
      throw new Error("Failed to search providers");
    }
  }

  async deleteProviderProfile(
    providerId: string,
    deletedBy: string
  ): Promise<void> {
    try {
      const provider = await ProviderModel.findById(providerId);

      if (!provider) {
        throw new Error("Provider profile not found");
      }

      // Archive associated images
      const galleryImages = provider.BusinessGalleryImages || [];
      for (const imageId of galleryImages) {
        try {
          await this.fileService.archiveFile(imageId);
        } catch (error) {
          console.error(`Failed to archive gallery image ${imageId}:`, error);
        }
      }

      const idImages = provider.IdDetails?.fileImage || [];
      for (const imageId of idImages) {
        try {
          await this.fileService.archiveFile(imageId);
        } catch (error) {
          console.error(`Failed to archive ID image ${imageId}:`, error);
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

      if (!provider) {
        throw new Error("Provider profile not found");
      }

      // Restore associated images
      const galleryImages = provider.BusinessGalleryImages || [];
      for (const imageId of galleryImages) {
        try {
          await this.fileService.restoreFile(imageId);
        } catch (error) {
          console.error(`Failed to restore gallery image ${imageId}:`, error);
        }
      }

      const idImages = provider.IdDetails?.fileImage || [];
      for (const imageId of idImages) {
        try {
          await this.fileService.restoreFile(imageId);
        } catch (error) {
          console.error(`Failed to restore ID image ${imageId}:`, error);
        }
      }

      await provider.restore();
    } catch (error) {
      console.error("Error restoring provider profile:", error);
      throw error;
    }
  }

  async addService(
    providerId: string,
    serviceId: string
  ): Promise<ProviderProfile> {
    try {
      const provider = await ProviderModel.findOne({
        _id: new Types.ObjectId(providerId),
        isDeleted: false,
      });

      if (!provider) {
        throw new Error("Provider profile not found");
      }

      const service = await ServiceModel.findOne({
        _id: new Types.ObjectId(serviceId),
        isActive: true,
        deletedAt: null,
      });

      if (!service) {
        throw new Error("Service not found or inactive");
      }

      if (service.isPrivate && !provider.isCompanyTrained) {
        throw new Error(
          "Only company-trained providers can offer private services"
        );
      }

      if (provider?.serviceOfferings?.some((s) => s.toString() === serviceId)) {
        throw new Error("Service already added to provider");
      }

      provider?.serviceOfferings?.push(new Types.ObjectId(serviceId));
      await provider.save();

      return provider;
    } catch (error) {
      console.error("Error adding service to provider:", error);
      throw error;
    }
  }

  async removeService(
    providerId: string,
    serviceId: string
  ): Promise<ProviderProfile> {
    try {
      const provider = await ProviderModel.findOne({
        _id: new Types.ObjectId(providerId),
        isDeleted: false,
      });

      if (!provider) {
        throw new Error("Provider profile not found");
      }

      provider.serviceOfferings = provider?.serviceOfferings?.filter(
        (s) => s.toString() !== serviceId
      );

      await provider.save();

      return provider;
    } catch (error) {
      console.error("Error removing service from provider:", error);
      throw error;
    }
  }

  /**
   * Get provider's gallery images with full file details
   */
  async getProviderGalleryImages(providerId: string): Promise<any[]> {
    try {
      const provider = await ProviderModel.findOne({
        _id: new Types.ObjectId(providerId),
        isDeleted: false,
      }).select("BusinessGalleryImages");

      if (!provider || !provider.BusinessGalleryImages) {
        return [];
      }

      const images = [];
      for (const imageId of provider.BusinessGalleryImages) {
        try {
          const file = await this.fileService.getFileById(imageId);
          if (file && file.status === "active") {
            images.push(file);
          }
        } catch (error) {
          console.error(`Failed to fetch gallery image ${imageId}:`, error);
        }
      }

      return images;
    } catch (error) {
      console.error("Error fetching provider gallery images:", error);
      throw new Error("Failed to fetch gallery images");
    }
  }

  /**
   * Get provider's ID images with full file details
   */
  async getProviderIdImages(providerId: string): Promise<any[]> {
    try {
      const provider = await ProviderModel.findOne({
        _id: new Types.ObjectId(providerId),
        isDeleted: false,
      }).select("IdDetails.fileImage");

      if (!provider || !provider.IdDetails?.fileImage) {
        return [];
      }

      const images = [];
      for (const imageId of provider.IdDetails.fileImage) {
        try {
          const file = await this.fileService.getFileById(imageId);
          if (file && file.status === "active") {
            images.push(file);
          }
        } catch (error) {
          console.error(`Failed to fetch ID image ${imageId}:`, error);
        }
      }

      return images;
    } catch (error) {
      console.error("Error fetching provider ID images:", error);
      throw new Error("Failed to fetch ID images");
    }
  }

  /**
   * Add single image to gallery
   */
  async addGalleryImage(
    providerId: string,
    imageUrl: string,
    uploaderId: string
  ): Promise<{ success: boolean; fileId?: Types.ObjectId; error?: string }> {
    try {
      const provider = await ProviderModel.findOne({
        _id: new Types.ObjectId(providerId),
        isDeleted: false,
      });

      if (!provider) {
        return { success: false, error: "Provider not found" };
      }

      // Create file record
      const file = await this.fileService.createFile({
        uploaderId: new Types.ObjectId(uploaderId),
        url: imageUrl,
        fileName: `gallery-${Date.now()}`,
        storageProvider: "cloudinary",
        entityType: "provider",
        entityId: new Types.ObjectId(providerId),
        label: "provider_gallery",
        status: "active",
      });

      // Add to provider's gallery
      if (!provider.BusinessGalleryImages) {
        provider.BusinessGalleryImages = [];
      }
      provider.BusinessGalleryImages.push(file._id as Types.ObjectId);
      await provider.save();

      return { success: true, fileId: file._id as Types.ObjectId };
    } catch (error) {
      console.error("Error adding gallery image:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Remove single image from gallery
   */
  async removeGalleryImage(
    providerId: string,
    fileId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const provider = await ProviderModel.findOne({
        _id: new Types.ObjectId(providerId),
        isDeleted: false,
      });

      if (!provider) {
        return { success: false, error: "Provider not found" };
      }

      // Archive the file
      await this.fileService.archiveFile(fileId);

      // Remove from provider's gallery
      provider.BusinessGalleryImages = provider.BusinessGalleryImages?.filter(
        (id) => id.toString() !== fileId
      );
      await provider.save();

      return { success: true };
    } catch (error) {
      console.error("Error removing gallery image:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get provider's file statistics
   */
  async getProviderFileStats(providerId: string): Promise<{
    galleryCount: number;
    idImageCount: number;
    totalSize: number;
    formattedSize: string;
  }> {
    try {
      const provider = await ProviderModel.findOne({
        _id: new Types.ObjectId(providerId),
        isDeleted: false,
      }).select("BusinessGalleryImages IdDetails.fileImage");

      if (!provider) {
        throw new Error("Provider not found");
      }

      const galleryCount = provider.BusinessGalleryImages?.length || 0;
      const idImageCount = provider.IdDetails?.fileImage?.length || 0;

      // Calculate total size
      let totalSize = 0;
      const allImageIds = [
        ...(provider.BusinessGalleryImages || []),
        ...(provider.IdDetails?.fileImage || []),
      ];

      for (const imageId of allImageIds) {
        try {
          const file = await this.fileService.getFileById(imageId);
          if (file && file.fileSize) {
            totalSize += file.fileSize;
          }
        } catch (error) {
          console.error(`Failed to get file size for ${imageId}:`, error);
        }
      }

      // Format size
      const formatSize = (bytes: number): string => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
      };

      return {
        galleryCount,
        idImageCount,
        totalSize,
        formattedSize: formatSize(totalSize),
      };
    } catch (error) {
      console.error("Error getting provider file stats:", error);
      throw new Error("Failed to get file statistics");
    }
  }

  /**
   * Cleanup orphaned files for a provider
   * Removes file records that are not referenced by the provider
   */
  async cleanupOrphanedFiles(providerId: string): Promise<{
    cleaned: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let cleaned = 0;

    try {
      const provider = await ProviderModel.findOne({
        _id: new Types.ObjectId(providerId),
        isDeleted: false,
      }).select("BusinessGalleryImages IdDetails.fileImage");

      if (!provider) {
        throw new Error("Provider not found");
      }

      // Get all referenced image IDs
      const referencedIds = new Set([
        ...(provider.BusinessGalleryImages || []).map((id) => id.toString()),
        ...(provider.IdDetails?.fileImage || []).map((id) => id.toString()),
      ]);

      // Get all files for this provider
      const allFiles = await this.fileService.getFilesByEntity(
        "provider",
        providerId,
        { status: "active" }
      );

      // Archive files that are not referenced
      for (const file of allFiles) {
        if (!referencedIds.has(file._id.toString())) {
          try {
            await this.fileService.archiveFile(file._id);
            cleaned++;
          } catch (error) {
            errors.push(
              `Failed to archive orphaned file ${file._id}: ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );
          }
        }
      }

      return { cleaned, errors };
    } catch (error) {
      errors.push(
        `Cleanup failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return { cleaned, errors };
    }
  }

  /**
   * Bulk update gallery images
   * Replaces all gallery images with new ones
   */
  async bulkUpdateGalleryImages(
    providerId: string,
    imageUrls: string[],
    uploaderId: string
  ): Promise<{ success: boolean; fileIds?: Types.ObjectId[]; error?: string }> {
    try {
      const provider = await ProviderModel.findOne({
        _id: new Types.ObjectId(providerId),
        isDeleted: false,
      });

      if (!provider) {
        return { success: false, error: "Provider not found" };
      }

      // Archive old images
      const oldImageIds = provider.BusinessGalleryImages || [];
      for (const imageId of oldImageIds) {
        try {
          await this.fileService.archiveFile(imageId);
        } catch (error) {
          console.error(`Failed to archive old image ${imageId}:`, error);
        }
      }

      // Create new image records
      const newFileIds = await this.createGalleryImageRecords(
        imageUrls,
        providerId,
        uploaderId
      );

      // Update provider
      provider.BusinessGalleryImages = newFileIds;
      await provider.save();

      return { success: true, fileIds: newFileIds };
    } catch (error) {
      console.error("Error bulk updating gallery images:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Validate all provider images
   * Checks if all referenced files exist and are active
   */
  async validateProviderImages(providerId: string): Promise<{
    valid: boolean;
    issues: string[];
    galleryIssues: number;
    idImageIssues: number;
  }> {
    const issues: string[] = [];
    let galleryIssues = 0;
    let idImageIssues = 0;

    try {
      const provider = await ProviderModel.findOne({
        _id: new Types.ObjectId(providerId),
        isDeleted: false,
      }).select("BusinessGalleryImages IdDetails.fileImage");

      if (!provider) {
        throw new Error("Provider not found");
      }

      // Validate gallery images
      const galleryIds = provider.BusinessGalleryImages || [];
      for (const imageId of galleryIds) {
        try {
          const file = await this.fileService.getFileById(imageId);
          if (!file) {
            issues.push(`Gallery image ${imageId} not found in file system`);
            galleryIssues++;
          } else if (file.status !== "active") {
            issues.push(`Gallery image ${imageId} is not active (status: ${file.status})`);
            galleryIssues++;
          }
        } catch (error) {
          issues.push(`Failed to validate gallery image ${imageId}`);
          galleryIssues++;
        }
      }

      // Validate ID images
      const idImageIds = provider.IdDetails?.fileImage || [];
      for (const imageId of idImageIds) {
        try {
          const file = await this.fileService.getFileById(imageId);
          if (!file) {
            issues.push(`ID image ${imageId} not found in file system`);
            idImageIssues++;
          } else if (file.status !== "active") {
            issues.push(`ID image ${imageId} is not active (status: ${file.status})`);
            idImageIssues++;
          }
        } catch (error) {
          issues.push(`Failed to validate ID image ${imageId}`);
          idImageIssues++;
        }
      }

      return {
        valid: issues.length === 0,
        issues,
        galleryIssues,
        idImageIssues,
      };
    } catch (error) {
      console.error("Error validating provider images:", error);
      return {
        valid: false,
        issues: [error instanceof Error ? error.message : "Unknown error"],
        galleryIssues: 0,
        idImageIssues: 0,
      };
    }
  }
}