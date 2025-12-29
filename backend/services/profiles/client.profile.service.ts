// services/client-profile.service.ts
import { Types, PopulateOptions, Query } from "mongoose";
import ProfileModel from "../../models/profiles/userProfile.model";
import { Coordinates, UserLocation } from "../../types/base.types";
import {
  ClientProfile,
  CreateClientProfileRequestBody,
  UpdateClientProfileRequestBody,
  ManageFavoritesRequestBody,
  ManageAddressRequestBody,
  AddPaymentMethodRequestBody,
} from "../../types/profiles/client.profile.types";
import { ImageLinkingService } from "../../utils/controller-utils/ImageLinkingService";
import { MongoDBFileService } from "../files/mongodb.files.service";
import { osmLocationService } from "./openstreetmap.location.service";
import { ClientModel } from "../../models/profiles/clientProfileModel";
import "../../models/booking.model";

interface NearestClientResult {
  client: ClientProfile;
  distanceKm: number;
  distanceFormatted: string;
}

interface FindNearestClientsOptions {
  maxDistance?: number;
  limit?: number;
  isVerified?: boolean;
  hasDefaultAddress?: boolean;
}

export enum PopulationLevel {
  NONE = "none",
  MINIMAL = "minimal",
  STANDARD = "standard",
  DETAILED = "detailed",
}

export class ClientProfileService {
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
            path: "favoriteServices",
            select: "title slug servicePricing",
          },
          {
            path: "favoriteProviders",
            select: "businessName locationData.region locationData.city",
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
            path: "favoriteServices",
            select:
              "title description slug servicePricing categoryId coverImage",
            populate: [
              {
                path: "categoryId",
                select: "catName slug",
              },
              {
                path: "coverImage",
                select: "url thumbnailUrl",
              },
            ],
          },
          {
            path: "favoriteProviders",
            select:
              "businessName locationData serviceOfferings isCompanyTrained",
            populate: {
              path: "serviceOfferings",
              select: "title slug",
            },
          },
          {
            path: "serviceHistory",
            select:
              "bookingNumber status finalPrice estimatedPrice currency createdAt scheduledDate",
          },
          {
            path: "idDetails.fileImage",
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
   * Link orphaned ID images to newly created client profile
   * Called during client creation to check for pre-uploaded ID images
   */
  private async linkOrphanedIdImages(
    clientId: string,
    userId: string
  ): Promise<Types.ObjectId[]> {
    try {
      const files = await this.fileService.getFilesByEntity("user", userId, {
        status: "active",
      });

      const idImages = files.filter((f) => f.label === "client_id_image");

      if (idImages.length === 0) {
        return [];
      }

      const fileIds = idImages.map((img) => img._id as Types.ObjectId);

      // Update client profile directly with ID images
      await ClientModel.findByIdAndUpdate(clientId, {
        "idDetails.fileImage": fileIds,
      });

      return fileIds;
    } catch (error) {
      console.error("Error linking orphaned ID images:", error);
      return [];
    }
  }

  async createClientProfile(
    userId: string,
    data: CreateClientProfileRequestBody
  ): Promise<ClientProfile> {
    try {
      // Verify user profile
      const userProfile = await ProfileModel.findOne({
        userId: new Types.ObjectId(userId),
        isDeleted: false,
      });

      if (!userProfile) {
        throw new Error("User profile not found");
      }

      if (!userProfile?.role?.includes("customer" as any)) {
        throw new Error("User must have customer role");
      }

      // Check if client profile exists
      const existingClient = await ClientModel.findOne({
        profile: userProfile._id,
        isDeleted: false,
      });

      if (existingClient) {
        throw new Error("Client profile already exists");
      }

      // Enrich saved addresses with location data
      if (data.savedAddresses && data.savedAddresses.length > 0) {
        const enrichedAddresses: UserLocation[] = [];

        for (const address of data.savedAddresses) {
          const locationEnrichment = await this.enrichLocationData(
            address.ghanaPostGPS,
            address.gpsCoordinates,
            address.nearbyLandmark
          );

          if (locationEnrichment.success && locationEnrichment.location) {
            enrichedAddresses.push({
              ...address,
              ...locationEnrichment.location,
            });
          } else {
            console.warn(
              "Location enrichment failed for address:",
              locationEnrichment.error
            );
            enrichedAddresses.push(address);
          }
        }

        data.savedAddresses = enrichedAddresses;
      }

      // Create client profile WITHOUT ID images initially
      const clientProfile = new ClientModel({
        ...data,
        profile: userProfile._id,
        idDetails: data.idDetails
          ? {
              idType: data.idDetails.idType,
              idNumber: data.idDetails.idNumber,
              fileImage: [],
            }
          : undefined,
      });

      await clientProfile.save();

      // Link any orphaned ID images that were uploaded before profile creation
      if (data.idDetails) {
        const idImageIds = await this.linkOrphanedIdImages(
          clientProfile._id.toString(),
          userId
        );

        if (idImageIds.length > 0 && clientProfile.idDetails) {
          clientProfile.idDetails.fileImage = idImageIds;
          await clientProfile.save();
        }
      }

      return clientProfile;
    } catch (error) {
      console.error("Error creating client profile:", error);
      throw error;
    }
  }

  /**
   * Add ID images to client profile
   */
  async addIdImages(clientId: string, userId: string): Promise<ClientProfile> {
    try {
      const client = await ClientModel.findOne({
        _id: new Types.ObjectId(clientId),
        isDeleted: false,
      });

      if (!client) {
        throw new Error("Client profile not found");
      }

      // Link new orphaned ID images
      const newIdImageIds = await this.linkOrphanedIdImages(clientId, userId);

      if (newIdImageIds.length === 0) {
        throw new Error("No ID images found to add");
      }

      if (!client.idDetails) {
        throw new Error(
          "Cannot add ID images without idDetails. Update profile with ID type and number first."
        );
      }

      // Append to existing ID images
      const existingIds = client.idDetails.fileImage || [];
      client.idDetails.fileImage = [...existingIds, ...newIdImageIds];

      await client.save();

      return client;
    } catch (error) {
      console.error("Error adding ID images:", error);
      throw error;
    }
  }

  /**
   * Replace all ID images (archive old ones)
   */
  async replaceIdImages(
    clientId: string,
    userId: string
  ): Promise<ClientProfile> {
    try {
      const client = await ClientModel.findOne({
        _id: new Types.ObjectId(clientId),
        isDeleted: false,
      });

      if (!client) {
        throw new Error("Client profile not found");
      }

      // Archive old ID images
      const oldIdImageIds = client.idDetails?.fileImage || [];
      for (const imageId of oldIdImageIds) {
        try {
          await this.fileService.archiveFile(imageId);
        } catch (error) {
          console.error(`Failed to archive ID image ${imageId}:`, error);
        }
      }

      // Link new orphaned ID images
      const newIdImageIds = await this.linkOrphanedIdImages(clientId, userId);

      if (newIdImageIds.length === 0) {
        throw new Error("No ID images found to replace with");
      }

      if (client.idDetails) {
        client.idDetails.fileImage = newIdImageIds;
      }

      await client.save();

      return client;
    } catch (error) {
      console.error("Error replacing ID images:", error);
      throw error;
    }
  }

  /**
   * Remove specific ID image from client
   */
  async removeIdImage(
    clientId: string,
    imageId: string,
    userId: string
  ): Promise<ClientProfile> {
    try {
      const client = await ClientModel.findOne({
        _id: new Types.ObjectId(clientId),
        isDeleted: false,
      });

      if (!client) {
        throw new Error("Client profile not found");
      }

      if (!client.idDetails || !client.idDetails.fileImage) {
        throw new Error("No ID images to remove");
      }

      // Remove from array
      client.idDetails.fileImage = client.idDetails.fileImage.filter(
        (id) => id.toString() !== imageId
      );

      await client.save();

      // Archive the file
      await this.fileService.archiveFile(imageId);

      return client;
    } catch (error) {
      console.error("Error removing ID image:", error);
      throw error;
    }
  }

  /**
   * Update ID details (type and number) along with images
   */
  async updateIdDetails(
    clientId: string,
    userId: string,
    idDetails: {
      idType: string;
      idNumber: string;
      replaceImages?: boolean;
    }
  ): Promise<ClientProfile> {
    try {
      const client = await ClientModel.findOne({
        _id: new Types.ObjectId(clientId),
        isDeleted: false,
      });

      if (!client) {
        throw new Error("Client profile not found");
      }

      let imageIds: Types.ObjectId[] = [];

      if (idDetails.replaceImages) {
        // Archive old images
        const oldIdImageIds = client.idDetails?.fileImage || [];
        for (const imageId of oldIdImageIds) {
          try {
            await this.fileService.archiveFile(imageId);
          } catch (error) {
            console.error(`Failed to archive ID image ${imageId}:`, error);
          }
        }

        // Link new images
        const newIdImageIds = await this.linkOrphanedIdImages(clientId, userId);
        if (newIdImageIds.length > 0) {
          imageIds = newIdImageIds;
        }
      } else {
        // Keep existing images
        imageIds = client.idDetails?.fileImage || [];
      }

      // Update ID details
      client.idDetails = {
        idType: idDetails.idType as any,
        idNumber: idDetails.idNumber,
        fileImage: imageIds,
      };

      await client.save();

      return client;
    } catch (error) {
      console.error("Error updating ID details:", error);
      throw error;
    }
  }

  async updateClientProfile(
    clientId: string,
    data: UpdateClientProfileRequestBody
  ): Promise<ClientProfile> {
    try {
      const client = await ClientModel.findOne({
        _id: new Types.ObjectId(clientId),
        isDeleted: false,
      });

      if (!client) {
        throw new Error("Client profile not found");
      }

      // Handle saved addresses updates with location enrichment
      if (data.savedAddresses && data.savedAddresses.length > 0) {
        const enrichedAddresses: UserLocation[] = [];

        for (const address of data.savedAddresses) {
          const existingAddress = client.savedAddresses?.find(
            (addr) => addr.ghanaPostGPS === address.ghanaPostGPS
          );

          const needsEnrichment =
            !existingAddress ||
            address.gpsCoordinates?.latitude !==
              existingAddress.gpsCoordinates?.latitude ||
            address.gpsCoordinates?.longitude !==
              existingAddress.gpsCoordinates?.longitude;

          if (needsEnrichment) {
            const locationEnrichment = await this.enrichLocationData(
              address.ghanaPostGPS,
              address.gpsCoordinates,
              address.nearbyLandmark
            );

            if (locationEnrichment.success && locationEnrichment.location) {
              enrichedAddresses.push({
                ...address,
                ...locationEnrichment.location,
              });
            } else {
              enrichedAddresses.push(address);
            }
          } else {
            enrichedAddresses.push(address);
          }
        }

        data.savedAddresses = enrichedAddresses;
      }

      // Update client profile (images handled through separate methods)
      const { idDetails, ...updateData } = data;

      Object.assign(client, updateData);
      await client.save();

      return client;
    } catch (error) {
      console.error("Error updating client profile:", error);
      throw error;
    }
  }

  async getClientProfile(
    clientId: string,
    options: {
      includeDeleted?: boolean;
      populationLevel?: PopulationLevel;
    } = {}
  ): Promise<ClientProfile | null> {
    try {
      const {
        includeDeleted = false,
        populationLevel = PopulationLevel.DETAILED,
      } = options;

      const query: any = { _id: new Types.ObjectId(clientId) };

      if (!includeDeleted) {
        query.isDeleted = false;
      }

      let clientQuery = ClientModel.findOne(query);
      clientQuery = this.applyPopulation(clientQuery, populationLevel);

      return await clientQuery.lean();
    } catch (error) {
      console.error("Error fetching client profile:", error);
      throw new Error("Failed to fetch client profile");
    }
  }

  async getClientByUserId(
    userId: string,
    populationLevel: PopulationLevel = PopulationLevel.DETAILED
  ): Promise<ClientProfile | null> {
    try {
      console.log("🔍 Looking for client with userId:", userId);

      const userProfile = await ProfileModel.findOne({
        userId: new Types.ObjectId(userId),
        isDeleted: false,
      }).select("_id userId");

      if (!userProfile) {
        console.log("❌ No user profile found for userId:", userId);
        return null;
      }

      console.log("✅ Found user profile:", userProfile._id);

      let clientQuery = ClientModel.findOne({
        profile: userProfile._id,
        isDeleted: false,
      });

      clientQuery = this.applyPopulation(clientQuery, populationLevel);

      const client = await clientQuery.lean();

      if (!client) {
        console.log("❌ No client profile found");
        return null;
      }

      console.log("✅ Found client profile:", client._id);
      return client;
    } catch (error) {
      console.error("❌ Error fetching client by user ID:", error);
      throw new Error("Failed to fetch client profile");
    }
  }

  /**
   * Manage favorites (add/remove services or providers)
   */
  async manageFavorites(
    clientId: string,
    data: ManageFavoritesRequestBody
  ): Promise<ClientProfile> {
    try {
      const client = await ClientModel.findOne({
        _id: new Types.ObjectId(clientId),
        isDeleted: false,
      });

      if (!client) {
        throw new Error("Client profile not found");
      }

      if (data.serviceId) {
        if (data.action === "add") {
          await client.addFavoriteService(data.serviceId);
        } else {
          await client.removeFavoriteService(data.serviceId);
        }
      }

      if (data.providerId) {
        if (data.action === "add") {
          await client.addFavoriteProvider(data.providerId);
        } else {
          await client.removeFavoriteProvider(data.providerId);
        }
      }

      return client;
    } catch (error) {
      console.error("Error managing favorites:", error);
      throw error;
    }
  }

  /**
   * Manage saved addresses
   */
  async manageAddress(
    clientId: string,
    data: ManageAddressRequestBody
  ): Promise<ClientProfile> {
    try {
      const client = await ClientModel.findOne({
        _id: new Types.ObjectId(clientId),
        isDeleted: false,
      });

      if (!client) {
        throw new Error("Client profile not found");
      }

      switch (data.action) {
        case "add":
          if (!data.address) {
            throw new Error("Address is required for add action");
          }

          // Enrich location before adding
          const locationEnrichment = await this.enrichLocationData(
            data.address.ghanaPostGPS,
            data.address.gpsCoordinates,
            data.address.nearbyLandmark
          );

          const enrichedAddress =
            locationEnrichment.success && locationEnrichment.location
              ? { ...data.address, ...locationEnrichment.location }
              : data.address;

          await client.addSavedAddress(enrichedAddress);
          break;

        case "remove":
          if (data.addressIndex === undefined) {
            throw new Error("Address index is required for remove action");
          }
          await client.removeSavedAddress(data.addressIndex);
          break;

        case "set_default":
          if (data.addressIndex === undefined) {
            throw new Error("Address index is required for set_default action");
          }
          await client.setDefaultAddress(data.addressIndex);
          break;

        default:
          throw new Error("Invalid action");
      }

      return client;
    } catch (error) {
      console.error("Error managing address:", error);
      throw error;
    }
  }

  /**
   * Add payment method
   */
  async addPaymentMethod(
    clientId: string,
    data: AddPaymentMethodRequestBody
  ): Promise<ClientProfile> {
    try {
      const client = await ClientModel.findOne({
        _id: new Types.ObjectId(clientId),
        isDeleted: false,
      });

      if (!client) {
        throw new Error("Client profile not found");
      }

      if (!client.savedPaymentMethods) {
        client.savedPaymentMethods = [];
      }

      // If this is set as default, unset other defaults
      if (data.isDefault) {
        client.savedPaymentMethods = client.savedPaymentMethods.map((pm) => ({
          ...pm,
          isDefault: false,
        }));
      }

      client.savedPaymentMethods.push(data);
      await client.save();

      return client;
    } catch (error) {
      console.error("Error adding payment method:", error);
      throw error;
    }
  }

  /**
   * Remove payment method
   */
  async removePaymentMethod(
    clientId: string,
    paymentMethodId: string
  ): Promise<ClientProfile> {
    try {
      const client = await ClientModel.findOne({
        _id: new Types.ObjectId(clientId),
        isDeleted: false,
      });

      if (!client) {
        throw new Error("Client profile not found");
      }

      if (!client.savedPaymentMethods) {
        throw new Error("No payment methods to remove");
      }

      client.savedPaymentMethods = client.savedPaymentMethods.filter(
        (pm: any) => pm._id?.toString() !== paymentMethodId
      );

      await client.save();

      return client;
    } catch (error) {
      console.error("Error removing payment method:", error);
      throw error;
    }
  }

  /**
   * Update communication preferences
   */
  async updateCommunicationPreferences(
    clientId: string,
    preferences: {
      emailNotifications?: boolean;
      smsNotifications?: boolean;
      pushNotifications?: boolean;
    }
  ): Promise<ClientProfile> {
    try {
      const client = await ClientModel.findOne({
        _id: new Types.ObjectId(clientId),
        isDeleted: false,
      });

      if (!client) {
        throw new Error("Client profile not found");
      }

      if (!client.preferences) {
        client.preferences = {};
      }

      if (!client.preferences.communicationPreferences) {
        client.preferences.communicationPreferences = {
          emailNotifications: true,
          smsNotifications: true,
          pushNotifications: true,
        };
      }

      Object.assign(client.preferences.communicationPreferences, preferences);
      await client.save();

      return client;
    } catch (error) {
      console.error("Error updating communication preferences:", error);
      throw error;
    }
  }

  async findNearestClients(
    targetLocation: Coordinates,
    options: FindNearestClientsOptions = {}
  ): Promise<NearestClientResult[]> {
    try {
      const {
        maxDistance = 50,
        limit = 10,
        isVerified,
        hasDefaultAddress,
      } = options;

      const query: any = {
        isDeleted: false,
        savedAddresses: { $exists: true, $ne: [] },
      };

      if (isVerified !== undefined) {
        query.isVerified = isVerified;
      }

      let clientQuery = ClientModel.find(query);
      clientQuery = this.applyPopulation(clientQuery, PopulationLevel.STANDARD);

      let clients = await clientQuery.lean();

      // Filter by default address if specified
      if (hasDefaultAddress) {
        clients = clients.filter(
          (c) =>
            c.savedAddresses &&
            c.defaultAddressIndex !== undefined &&
            c.savedAddresses[c.defaultAddressIndex]?.gpsCoordinates
        );
      }

      const clientsWithDistance = clients
        .map((client) => {
          const defaultAddress =
            client.savedAddresses?.[client.defaultAddressIndex || 0];
          if (!defaultAddress?.gpsCoordinates) return null;

          const distance = this.calculateDistance(
            targetLocation,
            defaultAddress.gpsCoordinates
          );

          return {
            client,
            distanceKm: distance,
            distanceFormatted: this.formatDistance(distance),
          };
        })
        .filter(
          (result) =>
            result !== null && (result as any).distanceKm <= maxDistance
        )
        .sort((a, b) => (a as any).distanceKm - (b as any).distanceKm)
        .slice(0, limit) as NearestClientResult[];

      return clientsWithDistance;
    } catch (error) {
      console.error("Error finding nearest clients:", error);
      throw new Error("Failed to find nearest clients");
    }
  }

  async findClientsByLocation(
    region: string,
    city?: string,
    options: {
      limit?: number;
      populationLevel?: PopulationLevel;
      isVerified?: boolean;
    } = {}
  ): Promise<ClientProfile[]> {
    try {
      const {
        limit = 20,
        populationLevel = PopulationLevel.MINIMAL,
        isVerified,
      } = options;

      const query: any = {
        isDeleted: false,
        "savedAddresses.region": region,
      };

      if (city) {
        query["savedAddresses.city"] = city;
      }

      if (isVerified !== undefined) {
        query.isVerified = isVerified;
      }

      let clientQuery = ClientModel.find(query).limit(limit);
      clientQuery = this.applyPopulation(clientQuery, populationLevel);

      return await clientQuery.lean();
    } catch (error) {
      console.error("Error finding clients by location:", error);
      throw new Error("Failed to find clients");
    }
  }

  async searchClients(params: {
    searchTerm?: string;
    region?: string;
    city?: string;
    isVerified?: boolean;
    hasDefaultAddress?: boolean;
    limit?: number;
    skip?: number;
    populationLevel?: PopulationLevel;
  }): Promise<{
    clients: ClientProfile[];
    total: number;
  }> {
    try {
      const { populationLevel = PopulationLevel.STANDARD, ...restParams } =
        params;
      const query: any = { isDeleted: false };

      if (restParams.region) {
        query["savedAddresses.region"] = restParams.region;
      }
      if (restParams.city) {
        query["savedAddresses.city"] = restParams.city;
      }
      if (restParams.isVerified !== undefined) {
        query.isVerified = restParams.isVerified;
      }
      if (restParams.hasDefaultAddress) {
        query.savedAddresses = { $exists: true, $ne: [] };
      }

      let clientQuery = ClientModel.find(query)
        .skip(restParams.skip || 0)
        .limit(restParams.limit || 20);

      clientQuery = this.applyPopulation(clientQuery, populationLevel);

      const clients = await clientQuery.lean();
      const total = await ClientModel.countDocuments(query);

      return { clients, total };
    } catch (error) {
      console.error("Error searching clients:", error);
      throw new Error("Failed to search clients");
    }
  }

  async deleteClientProfile(
    clientId: string,
    deletedBy: string
  ): Promise<void> {
    try {
      const client = await ClientModel.findById(clientId);

      if (!client) {
        throw new Error("Client profile not found");
      }

      // Archive associated ID images
      const idImages = client.idDetails?.fileImage || [];
      for (const imageId of idImages) {
        try {
          await this.fileService.archiveFile(imageId);
        } catch (error) {
          console.error(`Failed to archive ID image ${imageId}:`, error);
        }
      }

      await client.softDelete(new Types.ObjectId(deletedBy));
    } catch (error) {
      console.error("Error deleting client profile:", error);
      throw error;
    }
  }

  async restoreClientProfile(clientId: string): Promise<void> {
    try {
      const client = await ClientModel.findById(clientId);

      if (!client) {
        throw new Error("Client profile not found");
      }

      // Restore associated ID images
      const idImages = client.idDetails?.fileImage || [];
      for (const imageId of idImages) {
        try {
          await this.fileService.restoreFile(imageId);
        } catch (error) {
          console.error(`Failed to restore ID image ${imageId}:`, error);
        }
      }

      await client.restore();
    } catch (error) {
      console.error("Error restoring client profile:", error);
      throw error;
    }
  }

  /**
   * Get client statistics
   */
  async getClientStats(clientId: string): Promise<{
    totalFavoriteServices: number;
    totalFavoriteProviders: number;
    totalBookings: number;
    totalSavedAddresses: number;
    totalPaymentMethods: number;
    verificationStatus: {
      phoneVerified: boolean;
      emailVerified: boolean;
      idVerified: boolean;
      overallVerified: boolean;
    };
  }> {
    try {
      const client = await ClientModel.findOne({
        _id: new Types.ObjectId(clientId),
        isDeleted: false,
      });

      if (!client) {
        throw new Error("Client profile not found");
      }

      return {
        totalFavoriteServices: client.favoriteServices?.length || 0,
        totalFavoriteProviders: client.favoriteProviders?.length || 0,
        totalBookings: client.serviceHistory?.length || 0,
        totalSavedAddresses: client.savedAddresses?.length || 0,
        totalPaymentMethods: client.savedPaymentMethods?.length || 0,
        verificationStatus: {
          phoneVerified: client.verificationDetails?.phoneVerified || false,
          emailVerified: client.verificationDetails?.emailVerified || false,
          idVerified: client.verificationDetails?.idVerified || false,
          overallVerified: client.isVerified,
        },
      };
    } catch (error) {
      console.error("Error getting client stats:", error);
      throw error;
    }
  }

  /**
   * Update verification status
   */
  async updateVerificationStatus(
    clientId: string,
    verificationData: {
      phoneVerified?: boolean;
      emailVerified?: boolean;
      idVerified?: boolean;
    }
  ): Promise<ClientProfile> {
    try {
      const client = await ClientModel.findOne({
        _id: new Types.ObjectId(clientId),
        isDeleted: false,
      });

      if (!client) {
        throw new Error("Client profile not found");
      }

      if (!client.verificationDetails) {
        client.verificationDetails = {
          phoneVerified: false,
          emailVerified: false,
          idVerified: false,
        };
      }

      Object.assign(client.verificationDetails, verificationData);

      // Update overall verification status
      client.isVerified =
        client.verificationDetails.phoneVerified &&
        client.verificationDetails.emailVerified &&
        client.verificationDetails.idVerified;

      // Set verifiedAt timestamp if fully verified
      if (client.isVerified && !client.verificationDetails.verifiedAt) {
        client.verificationDetails.verifiedAt = new Date();
      }

      await client.save();

      return client;
    } catch (error) {
      console.error("Error updating verification status:", error);
      throw error;
    }
  }

  /**
   * Update emergency contact
   */
  async updateEmergencyContact(
    clientId: string,
    emergencyContact: {
      name: string;
      relationship: string;
      phoneNumber: string;
    }
  ): Promise<ClientProfile> {
    try {
      const client = await ClientModel.findOne({
        _id: new Types.ObjectId(clientId),
        isDeleted: false,
      });

      if (!client) {
        throw new Error("Client profile not found");
      }

      client.emergencyContact = emergencyContact;
      await client.save();

      return client;
    } catch (error) {
      console.error("Error updating emergency contact:", error);
      throw error;
    }
  }

  /**
   * Remove emergency contact
   */
  async removeEmergencyContact(clientId: string): Promise<ClientProfile> {
    try {
      const client = await ClientModel.findOne({
        _id: new Types.ObjectId(clientId),
        isDeleted: false,
      });

      if (!client) {
        throw new Error("Client profile not found");
      }

      client.emergencyContact = undefined;
      await client.save();

      return client;
    } catch (error) {
      console.error("Error removing emergency contact:", error);
      throw error;
    }
  }

  /**
   * Get all verified clients
   */
  async getAllVerifiedClients(options: {
    limit?: number;
    skip?: number;
    populationLevel?: PopulationLevel;
  }): Promise<{
    clients: ClientProfile[];
    total: number;
  }> {
    try {
      const {
        limit = 20,
        skip = 0,
        populationLevel = PopulationLevel.MINIMAL,
      } = options;

      const query = {
        isDeleted: false,
        isVerified: true,
      };

      let clientQuery = ClientModel.find(query).skip(skip).limit(limit);
      clientQuery = this.applyPopulation(clientQuery, populationLevel);

      const clients = await clientQuery.lean();
      const total = await ClientModel.countDocuments(query);

      return { clients, total };
    } catch (error) {
      console.error("Error getting verified clients:", error);
      throw new Error("Failed to get verified clients");
    }
  }

  /**
   * Get clients by favorite service
   */
  async getClientsByFavoriteService(
    serviceId: string,
    options: {
      limit?: number;
      skip?: number;
      populationLevel?: PopulationLevel;
    } = {}
  ): Promise<{
    clients: ClientProfile[];
    total: number;
  }> {
    try {
      const {
        limit = 20,
        skip = 0,
        populationLevel = PopulationLevel.MINIMAL,
      } = options;

      const query = {
        isDeleted: false,
        favoriteServices: new Types.ObjectId(serviceId),
      };

      let clientQuery = ClientModel.find(query).skip(skip).limit(limit);
      clientQuery = this.applyPopulation(clientQuery, populationLevel);

      const clients = await clientQuery.lean();
      const total = await ClientModel.countDocuments(query);

      return { clients, total };
    } catch (error) {
      console.error("Error getting clients by favorite service:", error);
      throw new Error("Failed to get clients");
    }
  }

  /**
   * Get clients by favorite provider
   */
  async getClientsByFavoriteProvider(
    providerId: string,
    options: {
      limit?: number;
      skip?: number;
      populationLevel?: PopulationLevel;
    } = {}
  ): Promise<{
    clients: ClientProfile[];
    total: number;
  }> {
    try {
      const {
        limit = 20,
        skip = 0,
        populationLevel = PopulationLevel.MINIMAL,
      } = options;

      const query = {
        isDeleted: false,
        favoriteProviders: new Types.ObjectId(providerId),
      };

      let clientQuery = ClientModel.find(query).skip(skip).limit(limit);
      clientQuery = this.applyPopulation(clientQuery, populationLevel);

      const clients = await clientQuery.lean();
      const total = await ClientModel.countDocuments(query);

      return { clients, total };
    } catch (error) {
      console.error("Error getting clients by favorite provider:", error);
      throw new Error("Failed to get clients");
    }
  }

  /**
   * Update preferred categories
   */
  async updatePreferredCategories(
    clientId: string,
    categoryIds: string[]
  ): Promise<ClientProfile> {
    try {
      const client = await ClientModel.findOne({
        _id: new Types.ObjectId(clientId),
        isDeleted: false,
      });

      if (!client) {
        throw new Error("Client profile not found");
      }

      if (!client.preferences) {
        client.preferences = {};
      }

      client.preferences.preferredCategories = categoryIds.map(
        (id) => new Types.ObjectId(id)
      );

      await client.save();

      return client;
    } catch (error) {
      console.error("Error updating preferred categories:", error);
      throw error;
    }
  }

  /**
   * Update language preference
   */
  async updateLanguagePreference(
    clientId: string,
    language: string
  ): Promise<ClientProfile> {
    try {
      const client = await ClientModel.findOne({
        _id: new Types.ObjectId(clientId),
        isDeleted: false,
      });

      if (!client) {
        throw new Error("Client profile not found");
      }

      if (!client.preferences) {
        client.preferences = {};
      }

      client.preferences.languagePreference = language;
      await client.save();

      return client;
    } catch (error) {
      console.error("Error updating language preference:", error);
      throw error;
    }
  }

  /**
   * Add booking to service history
   */
  async addBookingToHistory(
    clientId: string,
    bookingId: string
  ): Promise<ClientProfile> {
    try {
      const client = await ClientModel.findOne({
        _id: new Types.ObjectId(clientId),
        isDeleted: false,
      });

      if (!client) {
        throw new Error("Client profile not found");
      }

      if (!client.serviceHistory) {
        client.serviceHistory = [];
      }

      // Avoid duplicates
      if (!client.serviceHistory.some((id) => id.toString() === bookingId)) {
        client.serviceHistory.push(new Types.ObjectId(bookingId));
      }

      await client.save();

      return client;
    } catch (error) {
      console.error("Error adding booking to history:", error);
      throw error;
    }
  }

  /**
   * Get client's complete profile with enriched data
   */
  async getClientCompleteProfile(clientId: string): Promise<{
    client: ClientProfile;
    stats: {
      totalFavoriteServices: number;
      totalFavoriteProviders: number;
      totalBookings: number;
      totalSavedAddresses: number;
      totalPaymentMethods: number;
      verificationStatus: {
        phoneVerified: boolean;
        emailVerified: boolean;
        idVerified: boolean;
        overallVerified: boolean;
      };
    };
    defaultAddress: UserLocation | null;
    defaultPaymentMethod: any | null;
  }> {
    try {
      const client = await this.getClientProfile(clientId, {
        populationLevel: PopulationLevel.DETAILED,
      });

      if (!client) {
        throw new Error("Client profile not found");
      }

      const stats = await this.getClientStats(clientId);

      const defaultAddress =
        client.savedAddresses?.[client.defaultAddressIndex || 0] || null;

      const defaultPaymentMethod =
        client.savedPaymentMethods?.find((pm) => pm.isDefault) || null;

      return {
        client,
        stats,
        defaultAddress,
        defaultPaymentMethod,
      };
    } catch (error) {
      console.error("Error getting complete client profile:", error);
      throw error;
    }
  }

  /**
   * Bulk update clients
   */
  async bulkUpdateClients(
    clientIds: string[],
    updateData: Partial<ClientProfile>
  ): Promise<{
    updated: number;
    failed: number;
    errors: string[];
  }> {
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const clientId of clientIds) {
      try {
        await this.updateClientProfile(clientId, updateData);
        updated++;
      } catch (error) {
        failed++;
        errors.push(
          `Failed to update client ${clientId}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    return { updated, failed, errors };
  }

  /**
   * Get platform-wide client statistics
   */
  async getPlatformClientStats(): Promise<{
    totalClients: number;
    verifiedClients: number;
    clientsWithFavorites: number;
    clientsWithBookings: number;
    clientsByRegion: { region: string; count: number }[];
  }> {
    try {
      const totalClients = await ClientModel.countDocuments({
        isDeleted: false,
      });

      const verifiedClients = await ClientModel.countDocuments({
        isDeleted: false,
        isVerified: true,
      });

      const clientsWithFavorites = await ClientModel.countDocuments({
        isDeleted: false,
        $or: [
          { favoriteServices: { $exists: true, $ne: [] } },
          { favoriteProviders: { $exists: true, $ne: [] } },
        ],
      });

      const clientsWithBookings = await ClientModel.countDocuments({
        isDeleted: false,
        serviceHistory: { $exists: true, $ne: [] },
      });

      // Aggregate clients by region
      const clientsByRegion = await ClientModel.aggregate([
        {
          $match: { isDeleted: false },
        },
        {
          $unwind: {
            path: "$savedAddresses",
            preserveNullAndEmptyArrays: false,
          },
        },
        {
          $group: {
            _id: "$savedAddresses.region",
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            region: "$_id",
            count: 1,
            _id: 0,
          },
        },
        {
          $sort: { count: -1 },
        },
      ]);

      return {
        totalClients,
        verifiedClients,
        clientsWithFavorites,
        clientsWithBookings,
        clientsByRegion,
      };
    } catch (error) {
      console.error("Error getting platform client stats:", error);
      throw new Error("Failed to get platform client stats");
    }
  }

  /**
   * Export singleton instance
   */
  static getInstance(): ClientProfileService {
    return new ClientProfileService();
  }
}

// Export singleton instance
export const clientProfileService = new ClientProfileService();
