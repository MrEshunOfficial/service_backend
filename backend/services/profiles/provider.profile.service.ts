// services/provider-profile.service.ts
import { Types, PopulateOptions, Query } from "mongoose";
import { ProviderModel } from "../../models/profiles/provider.model";
import ProfileModel from "../../models/profiles/userProfile.model";
import { ServiceModel } from "../../models/service.model";
import { Coordinates, UserLocation } from "../../types/base.types";
import { ProviderProfile, CreateProviderProfileRequestBody, UpdateProviderProfileRequestBody } from "../../types/providerProfile.types";
import { ImageLinkingService } from "../../utils/controller-utils/ImageLinkingService";
import { osmLocationService } from "./openstreetmap.location.service";

interface NearestProviderResult {
  provider: ProviderProfile;
  distanceKm: number;
  distanceFormatted: string;
}

interface FindNearestProvidersOptions {
  maxDistance?: number; // in kilometers
  limit?: number;
  serviceId?: string;
  categoryId?: string;
  populationLevel?: PopulationLevel;
}

// Population presets for different use cases
export enum PopulationLevel {
  NONE = "none", // No population at all
  MINIMAL = "minimal", // Only IDs and names for lists
  STANDARD = "standard", // Basic info for general queries
  DETAILED = "detailed", // Full details for single provider views
}

export class ProviderProfileService {
  private imageLinkingService: ImageLinkingService;

  constructor() {
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
          { 
            path: "profile", 
            select: "userId bio mobileNumber profilePictureId",
            populate: {
              path: "userId",
              select: "name email"
            }
          },
          { 
            path: "serviceOfferings", 
            select: "title slug servicePricing.serviceBasePrice servicePricing.currency" 
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
                select: "name email"
              },
              {
                path: "profilePictureId",
                select: "url thumbnailUrl"
              }
            ]
          },
          { 
            path: "serviceOfferings", 
            select: "title description slug servicePricing categoryId" 
          },
          { 
            path: "BusinessGalleryImages", 
            select: "url thumbnailUrl fileName" 
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
                select: "firstName lastName email createdAt"
              },
              {
                path: "profilePictureId",
                select: "url thumbnailUrl fileName uploadedAt"
              }
            ]
          },
          { 
            path: "serviceOfferings", 
            select: "title description slug servicePricing categoryId isPrivate isActive",
            populate: {
              path: "categoryId",
              select: "catName slug"
            }
          },
          { 
            path: "BusinessGalleryImages", 
            select: "url thumbnailUrl fileName label uploadedAt" 
          },
          { 
            path: "IdDetails.fileImage", 
            select: "url fileName uploadedAt" 
          },
        ];

      default:
        return [];
    }
  }

  /**
   * Apply population to a query based on population level
   */
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

  /**
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in kilometers
   */
  private calculateDistance(
    coord1: Coordinates,
    coord2: Coordinates
  ): number {
    const R = 6371; // Earth's radius in km
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

  /**
   * Format distance for display
   */
  private formatDistance(km: number): string {
    if (km < 1) {
      return `${Math.round(km * 1000)}m away`;
    }
    return `${km.toFixed(1)}km away`;
  }

  /**
   * Enrich location data using OpenStreetMap Nominatim API
   * Automatically fills in region, city, district, locality from coordinates
   */
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
        error: error instanceof Error ? error.message : "Location enrichment failed",
      };
    }
  }

  /**
   * Verify location using OpenStreetMap
   * Checks if provided coordinates match the Ghana Post GPS code
   */
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

  /**
   * Geocode an address to get coordinates
   * Useful when user provides Ghana Post GPS without coordinates
   */
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
   * Get available private services for company-trained providers
   */
  async getAvailablePrivateServices(providerId: string): Promise<any[]> {
    try {
      // Check if provider is company trained
      const provider = await ProviderModel.findById(providerId);
      
      if (!provider || !provider.isCompanyTrained) {
        return [];
      }

      // Get all private services
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
   * Create a new provider profile with automatic location enrichment
   */
  async createProviderProfile(
    profileId: string,
    data: CreateProviderProfileRequestBody
  ): Promise<ProviderProfile> {
    try {
      // Verify the user profile exists and has provider role
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

      // Check if provider profile already exists
      const existingProvider = await ProviderModel.findOne({
        profile: userProfile._id,
        isDeleted: false,
      });

      if (existingProvider) {
        throw new Error("Provider profile already exists");
      }

      // Enrich location data using OpenStreetMap
      const locationEnrichment = await this.enrichLocationData(
        data.locationData.ghanaPostGPS,
        data.locationData.gpsCoordinates,
        data.locationData.nearbyLandmark
      );

      if (locationEnrichment.success && locationEnrichment.location) {
        // Merge enriched data with user-provided data
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

      // Verify service offerings (company-trained can access private services)
      if (data.serviceOfferings && data.serviceOfferings.length > 0) {
        const services = await ServiceModel.find({
          _id: { $in: data.serviceOfferings },
          isActive: true,
          deletedAt: null,
        });

        // Check if trying to add private services without being company trained
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

      // Create provider profile
      const providerProfile = new ProviderModel({
        ...data,
        profile: userProfile._id,
      });

      await providerProfile.save();

      // Link orphaned images (gallery and ID images)
      if (data.BusinessGalleryImages && data.BusinessGalleryImages.length > 0) {
        await this.imageLinkingService.linkMultipleImagesToProvider(
          providerProfile._id.toString(),
          data.BusinessGalleryImages,
          "BusinessGalleryImages",
          profileId
        );
      }

      if (data.IdDetails?.fileImage && data.IdDetails.fileImage.length > 0) {
        await this.imageLinkingService.linkMultipleImagesToProvider(
          providerProfile._id.toString(),
          data.IdDetails.fileImage,
          "IdDetails.fileImage",
          profileId
        );
      }

      return providerProfile;
    } catch (error) {
      console.error("Error creating provider profile:", error);
      throw error;
    }
  }

  /**
   * Update provider profile with location re-enrichment if needed
   */
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

      // If updating location data, enrich it
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
            data.locationData.ghanaPostGPS || provider.locationData.ghanaPostGPS,
            data.locationData.gpsCoordinates || provider.locationData.gpsCoordinates,
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

      // Verify service offerings if being updated
      if (data.serviceOfferings && data.serviceOfferings.length > 0) {
        const services = await ServiceModel.find({
          _id: { $in: data.serviceOfferings },
          isActive: true,
          deletedAt: null,
        });

        const hasPrivateServices = services.some((s) => s.isPrivate);
        const isCompanyTrained = data.isCompanyTrained ?? provider.isCompanyTrained;

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

  /**
   * Get provider profile by ID with configurable population
   */
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

  /**
   * Get provider profile by user profile ID with configurable population
   * NOTE: This accepts userProfileId (the _id from ProfileModel), not userId
   */
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

  /**
   * Get provider profile by user ID (from auth token)
   * This resolves userId -> userProfileId -> providerProfile
   */

async getProviderByUserId(
  userId: string,
  populationLevel: PopulationLevel = PopulationLevel.DETAILED
): Promise<ProviderProfile | null> {
  try {
    console.log('🔍 Looking for provider with userId:', userId);
    
    // First, find the user profile
    const userProfile = await ProfileModel.findOne({
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    }).select("_id userId");

    if (!userProfile) {
      console.log('❌ No user profile found for userId:', userId);
      console.log('💡 Tip: Make sure the user has created a basic profile first');
      return null;
    }

    console.log('✅ Found user profile:', userProfile._id);

    // Then find the provider profile using the user profile ID
    let providerQuery = ProviderModel.findOne({
      profile: userProfile._id,
      isDeleted: false,
    });

    providerQuery = this.applyPopulation(providerQuery, populationLevel);

    const provider = await providerQuery.lean();

    if (!provider) {
      console.log('❌ No provider profile found for user profile ID:', userProfile._id);
      console.log('💡 Tip: User needs to create a provider profile via the create endpoint');
      return null;
    }

    console.log('✅ Found provider profile:', provider._id);
    return provider;
  } catch (error) {
    console.error("❌ Error fetching provider by user ID:", error);
    console.error('Error details:', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw new Error("Failed to fetch provider profile");
  }
}

  /**
   * Find nearest providers to a given location
   * Returns providers sorted by distance with formatted display
   */
  async findNearestProviders(
    userLocation: Coordinates,
    options: FindNearestProvidersOptions = {}
  ): Promise<NearestProviderResult[]> {
    try {
      const {
        maxDistance = 50, // 50km default
        limit = 10,
        serviceId,
        categoryId,
        populationLevel = PopulationLevel.STANDARD,
      } = options;

      // Build query
      const query: any = {
        isDeleted: false,
        "locationData.gpsCoordinates": { $exists: true },
      };

      // Filter by service if provided
      if (serviceId) {
        query.serviceOfferings = new Types.ObjectId(serviceId);
      }

      // Get all providers with coordinates
      let providerQuery = ProviderModel.find(query);
      providerQuery = this.applyPopulation(providerQuery, populationLevel);

      let providers = await providerQuery.lean();

      // Filter by category if provided (after population)
      if (categoryId) {
        providers = providers.filter((p) =>
          p?.serviceOfferings?.some(
            (s: any) => s.categoryId?.toString() === categoryId
          )
        );
      }

      // Calculate distances and filter by max distance
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

  /**
   * Find providers in a specific region/city
   */
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
      const { serviceId, limit = 20, populationLevel = PopulationLevel.MINIMAL } = options;

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

  /**
   * Get distance between customer and provider
   * Returns formatted distance for display
   */
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

  /**
   * Search providers with advanced filters and optional distance-based sorting
   */
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
    providers: (ProviderProfile & { distance?: number; distanceFormatted?: string })[];
    total: number;
  }> {
    try {
      const { populationLevel = PopulationLevel.STANDARD, ...restParams } = params;
      const query: any = { isDeleted: false };

      // Location filters
      if (restParams.region) query["locationData.region"] = restParams.region;
      if (restParams.city) query["locationData.city"] = restParams.city;

      // Service filters
      if (restParams.serviceIds && restParams.serviceIds.length > 0) {
        query.serviceOfferings = {
          $in: restParams.serviceIds.map((id) => new Types.ObjectId(id)),
        };
      }

      // Other filters
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

      // Filter by category if provided
      if (restParams.categoryId) {
        providers = providers.filter((p) =>
          p?.serviceOfferings?.some(
            (s: any) => s.categoryId?.toString() === restParams.categoryId
          )
        );
      }

      // Calculate distances if user location provided
      if (restParams.userLocation) {
        const providersWithDistance = providers
          .map((provider) => {
            if (provider.locationData.gpsCoordinates) {
              const distance = this.calculateDistance(
                restParams.userLocation!,
                provider.locationData.gpsCoordinates
              );

              return {
                ...provider,
                distance,
                distanceFormatted: this.formatDistance(distance),
              };
            }
            return provider;
          })
          .filter((p) => !restParams.maxDistance || (p.distance && p.distance <= restParams.maxDistance))
          .sort((a, b) => (a.distance || 0) - (b.distance || 0));

        return { providers: providersWithDistance, total };
      }

      return { providers, total };
    } catch (error) {
      console.error("Error searching providers:", error);
      throw new Error("Failed to search providers");
    }
  }

  /**
   * Soft delete provider profile
   */
  async deleteProviderProfile(
    providerId: string,
    deletedBy: string
  ): Promise<void> {
    try {
      const provider = await ProviderModel.findById(providerId);

      if (!provider) {
        throw new Error("Provider profile not found");
      }

      await provider.softDelete(deletedBy);
    } catch (error) {
      console.error("Error deleting provider profile:", error);
      throw error;
    }
  }

  /**
   * Restore soft-deleted provider profile
   */
  async restoreProviderProfile(providerId: string): Promise<void> {
    try {
      const provider = await ProviderModel.findById(providerId);

      if (!provider) {
        throw new Error("Provider profile not found");
      }

      await provider.restore();
    } catch (error) {
      console.error("Error restoring provider profile:", error);
      throw error;
    }
  }

  /**
   * Add service to provider's offerings
   * Validates private service access for company-trained providers
   */
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

      // Verify service exists and is active
      const service = await ServiceModel.findOne({
        _id: new Types.ObjectId(serviceId),
        isActive: true,
        deletedAt: null,
      });

      if (!service) {
        throw new Error("Service not found or inactive");
      }

      // Check if private service and provider is company trained
      if (service.isPrivate && !provider.isCompanyTrained) {
        throw new Error(
          "Only company-trained providers can offer private services"
        );
      }

      // Check if service already added
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

  /**
   * Remove service from provider's offerings
   */
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
}