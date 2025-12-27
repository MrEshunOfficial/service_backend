// services/provider-profile.service.ts (UPDATED)
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

  /**
   * Link orphaned ID images to newly created provider profile
   * Called during provider creation to check for pre-uploaded ID images
   */
  private async linkOrphanedIdImages(
    providerId: string,
    userId: string
  ): Promise<Types.ObjectId[]> {
    try {
      // Find all orphaned ID images for this user
      const files = await this.fileService.getFilesByEntity(
        "provider",
        userId,
        {
          status: "active",
        }
      );

      const idImages = files.filter((f) => f.label === "provider_id_image");

      if (idImages.length === 0) {
        return [];
      }

      const fileIds = idImages.map((img) => img._id as Types.ObjectId);

      // Link them to the provider using the image linking service
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
   * Link orphaned gallery images to provider profile
   * Called when adding gallery images after profile creation
   */
  private async linkOrphanedGalleryImages(
    providerId: string,
    userId: string
  ): Promise<Types.ObjectId[]> {
    try {
      // Find all orphaned gallery images for this user
      const files = await this.fileService.getFilesByEntity(
        "provider",
        userId,
        {
          status: "active",
        }
      );

      const galleryImages = files.filter((f) => f.label === "provider_gallery");

      if (galleryImages.length === 0) {
        return [];
      }

      const fileIds = galleryImages.map((img) => img._id as Types.ObjectId);

      // Link them to the provider using the image linking service
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

      // Create provider profile WITHOUT images initially
      const providerProfile = new ProviderModel({
        ...data,
        profile: userProfile._id,
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

      // NOW link any orphaned ID images that were uploaded before profile creation
      const idImageIds = await this.linkOrphanedIdImages(
        providerProfile._id.toString(),
        userId
      );

      if (idImageIds.length > 0 && providerProfile.IdDetails) {
        providerProfile.IdDetails.fileImage = idImageIds;
        await providerProfile.save();
      }

      // Gallery images are typically added AFTER profile creation, but check anyway
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

  /**
   * Add gallery images to an existing provider profile
   * This is the typical flow - gallery images added AFTER profile creation
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

      if (!provider) {
        throw new Error("Provider profile not found");
      }

      // Link any orphaned gallery images
      const newGalleryImageIds = await this.linkOrphanedGalleryImages(
        providerId,
        userId
      );

      if (newGalleryImageIds.length === 0) {
        throw new Error("No gallery images found to add");
      }

      // Append to existing gallery images (don't replace)
      const existingIds = provider.BusinessGalleryImages || [];
      provider.BusinessGalleryImages = [...existingIds, ...newGalleryImageIds];

      await provider.save();

      return provider;
    } catch (error) {
      console.error("Error adding gallery images:", error);
      throw error;
    }
  }

  /**
   * Remove specific gallery image from provider
   */
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

      if (!provider) {
        throw new Error("Provider profile not found");
      }

      // Remove from array
      provider.BusinessGalleryImages = (
        provider.BusinessGalleryImages || []
      ).filter((id) => id.toString() !== imageId);

      await provider.save();

      // Archive the file
      await this.fileService.archiveFile(imageId);

      return provider;
    } catch (error) {
      console.error("Error removing gallery image:", error);
      throw error;
    }
  }

  /**
   * Add ID images to provider profile
   * Can be called after profile creation if user didn't upload ID images initially
   */
  async addIdImages(
    providerId: string,
    userId: string
  ): Promise<ProviderProfile> {
    try {
      const provider = await ProviderModel.findOne({
        _id: new Types.ObjectId(providerId),
        isDeleted: false,
      });

      if (!provider) {
        throw new Error("Provider profile not found");
      }

      // Link new orphaned ID images
      const newIdImageIds = await this.linkOrphanedIdImages(providerId, userId);

      if (newIdImageIds.length === 0) {
        throw new Error("No ID images found to add");
      }

      // Initialize IdDetails if it doesn't exist
      if (!provider.IdDetails) {
        throw new Error(
          "Cannot add ID images without IdDetails. Update profile with ID type and number first."
        );
      }

      // Append to existing ID images (don't replace)
      const existingIds = provider.IdDetails.fileImage || [];
      provider.IdDetails.fileImage = [...existingIds, ...newIdImageIds];

      await provider.save();

      return provider;
    } catch (error) {
      console.error("Error adding ID images:", error);
      throw error;
    }
  }

  /**
   * Replace all ID images (archive old ones)
   * Use when user wants to completely replace their ID documentation
   */
  async replaceIdImages(
    providerId: string,
    userId: string
  ): Promise<ProviderProfile> {
    try {
      const provider = await ProviderModel.findOne({
        _id: new Types.ObjectId(providerId),
        isDeleted: false,
      });

      if (!provider) {
        throw new Error("Provider profile not found");
      }

      // Archive old ID images
      const oldIdImageIds = provider.IdDetails?.fileImage || [];
      for (const imageId of oldIdImageIds) {
        try {
          await this.fileService.archiveFile(imageId);
        } catch (error) {
          console.error(`Failed to archive ID image ${imageId}:`, error);
        }
      }

      // Link new orphaned ID images
      const newIdImageIds = await this.linkOrphanedIdImages(providerId, userId);

      if (newIdImageIds.length === 0) {
        throw new Error("No ID images found to replace with");
      }

      // Update provider with new ID images (replace completely)
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

  /**
   * Remove specific ID image from provider
   */
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

      if (!provider) {
        throw new Error("Provider profile not found");
      }

      if (!provider.IdDetails || !provider.IdDetails.fileImage) {
        throw new Error("No ID images to remove");
      }

      // Remove from array
      provider.IdDetails.fileImage = provider.IdDetails.fileImage.filter(
        (id) => id.toString() !== imageId
      );

      await provider.save();

      // Archive the file
      await this.fileService.archiveFile(imageId);

      return provider;
    } catch (error) {
      console.error("Error removing ID image:", error);
      throw error;
    }
  }

  /**
   * Update ID details (type and number) along with images
   * Useful when user needs to change ID type (e.g., from Passport to National ID)
   */
  async updateIdDetails(
    providerId: string,
    userId: string,
    idDetails: {
      idType: string;
      idNumber: string;
      replaceImages?: boolean; // If true, archives old images and links new ones
    }
  ): Promise<ProviderProfile> {
    try {
      const provider = await ProviderModel.findOne({
        _id: new Types.ObjectId(providerId),
        isDeleted: false,
      });

      if (!provider) {
        throw new Error("Provider profile not found");
      }

      // Handle image replacement if requested
      let imageIds: Types.ObjectId[] = [];

      if (idDetails.replaceImages) {
        // Archive old images
        const oldIdImageIds = provider.IdDetails?.fileImage || [];
        for (const imageId of oldIdImageIds) {
          try {
            await this.fileService.archiveFile(imageId);
          } catch (error) {
            console.error(`Failed to archive ID image ${imageId}:`, error);
          }
        }

        // Link new images
        const newIdImageIds = await this.linkOrphanedIdImages(
          providerId,
          userId
        );
        if (newIdImageIds.length > 0) {
          imageIds = newIdImageIds;
        }
      } else {
        // Keep existing images
        imageIds = provider.IdDetails?.fileImage || [];
      }

      // Update ID details
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

      // Update provider profile (without touching images)
      // Images are updated through separate methods: addGalleryImages, removeGalleryImage, updateIdImages
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
}
