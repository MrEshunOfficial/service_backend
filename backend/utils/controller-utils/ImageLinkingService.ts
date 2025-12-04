// services/image-linking.service.ts
import { Types, Model, Document } from "mongoose";
import { CategoryModel } from "../../models/category.model";
import ProfileModel from "../../models/profiles/userProfile.model";
import { ServiceModel } from "../../models/service.model";
import { MongoDBFileService } from "../../services/files/mongodb.files.service";
import { ProviderModel } from "../../models/profiles/provider.model";

/**
 * Generic Image Linking Service
 *
 * Handles automatic linking of images to entities (profiles, categories, services, providers)
 * Supports flexible workflow where images can be uploaded before or after entity creation
 *
 * Supported entities:
 * - user: Profile pictures
 * - category: Category cover images
 * - service: Service images
 * - provider: Provider business gallery images
 * - product: Product images (can be extended)
 */

type EntityType = "user" | "category" | "service" | "provider" | "product";
type Label =
  | "profile_picture"
  | "category_cover"
  | "service_cover"
  | "provider_gallery"
  | "provider_id_image"
  | "product_image";

interface LinkImageConfig {
  entityType: EntityType;
  entityId: string;
  imageLabel: Label;
  imageFieldName: string; // Field name in the entity model (e.g., 'profilePictureId', 'catCoverId')
  lastModifiedBy?: string;
}

interface ImageLinkResult {
  linked: boolean;
  fileId?: Types.ObjectId;
  url?: string;
  entityId?: Types.ObjectId;
  error?: string;
}

export class ImageLinkingService {
  private fileService: MongoDBFileService;

  constructor() {
    this.fileService = new MongoDBFileService();
  }

  /**
   * Get the appropriate model based on entity type
   * Returns Model<any> to avoid complex type compatibility issues
   */
  private getEntityModel(entityType: EntityType): Model<any> {
    switch (entityType) {
      case "user":
        return ProfileModel as Model<any>;
      case "category":
        return CategoryModel as Model<any>;
      case "service":
        return ServiceModel as Model<any>;
      case "provider":
        return ProviderModel as Model<any>;
      // case "product":
      //   return ProductModel as Model<any>;
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  /**
   * Get the appropriate entity ID field based on entity type
   */
  private getEntityIdField(entityType: EntityType): string {
    switch (entityType) {
      case "user":
        return "userId";
      case "category":
        return "_id";
      case "service":
        return "_id";
      case "provider":
        return "_id";
      default:
        return "_id";
    }
  }

  /**
   * Link image to entity (called after image upload or entity creation)
   * Returns true if successfully linked, false if entity doesn't exist yet
   */
  async linkImageToEntity(
    entityType: EntityType,
    entityId: string,
    imageLabel: Label,
    imageFieldName: string,
    fileId: Types.ObjectId,
    lastModifiedBy?: string
  ): Promise<ImageLinkResult> {
    try {
      const Model = this.getEntityModel(entityType);
      const entityIdField = this.getEntityIdField(entityType);

      // Find the entity
      const query: Record<string, any> = {
        [entityIdField]: new Types.ObjectId(entityId),
        isDeleted: false,
      };

      const entity = await Model.findOne(query);

      if (!entity) {
        // Entity doesn't exist yet - image will be linked later
        return { linked: false };
      }

      // Update entity with image ID
      const updateData: Record<string, any> = {
        [imageFieldName]: fileId,
      };

      // Add lastModifiedBy or lastModified depending on entity type
      if (entityType === "user") {
        updateData.lastModified = new Date();
      } else {
        updateData.lastModifiedBy = lastModifiedBy
          ? new Types.ObjectId(lastModifiedBy)
          : undefined;
      }

      await Model.findByIdAndUpdate(entity._id, updateData, { new: true });

      return { linked: true, entityId: entity._id, fileId };
    } catch (error) {
      console.error(`Error linking ${imageLabel} to ${entityType}:`, error);
      return {
        linked: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Link orphaned image to newly created entity
   * Called during entity creation to check for pre-uploaded images
   */
  async linkOrphanedImage(
    entityType: EntityType,
    entityId: string,
    imageLabel: Label,
    imageFieldName: string,
    lastModifiedBy?: string
  ): Promise<ImageLinkResult> {
    try {
      // Look for active image with the specified label
      const files = await this.fileService.getFilesByEntity(
        entityType,
        entityId,
        {
          status: "active",
        }
      );

      const orphanedImage = files.find((f) => f.label === imageLabel);

      if (!orphanedImage) {
        // No orphaned image found
        return { linked: false };
      }

      // Link image to entity
      const Model = this.getEntityModel(entityType);

      const updateData: Record<string, any> = {
        [imageFieldName]: orphanedImage._id,
      };

      // Add lastModifiedBy or lastModified depending on entity type
      if (entityType === "user") {
        updateData.lastModified = new Date();
      } else {
        updateData.lastModifiedBy = lastModifiedBy
          ? new Types.ObjectId(lastModifiedBy)
          : undefined;
      }

      await Model.findByIdAndUpdate(new Types.ObjectId(entityId), updateData, {
        new: true,
      });

      return {
        linked: true,
        fileId: orphanedImage._id,
        url: orphanedImage.url,
      };
    } catch (error) {
      console.error(`Error linking orphaned ${imageLabel}:`, error);
      return {
        linked: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Link multiple images to provider (for gallery or ID images)
   * Special handling for providers with array fields
   */
  async linkMultipleImagesToProvider(
    providerId: string,
    fileIds: Types.ObjectId[],
    fieldName: "BusinessGalleryImages" | "IdDetails.fileImage",
    lastModifiedBy?: string
  ): Promise<ImageLinkResult> {
    try {
      const entity = await ProviderModel.findOne({
        _id: new Types.ObjectId(providerId),
        isDeleted: false,
      });

      if (!entity) {
        return { linked: false, error: "Provider not found" };
      }

      const updateData: Record<string, any> = {
        lastModifiedBy: lastModifiedBy
          ? new Types.ObjectId(lastModifiedBy)
          : undefined,
      };

      if (fieldName === "BusinessGalleryImages") {
        updateData.BusinessGalleryImages = fileIds;
      } else if (fieldName === "IdDetails.fileImage") {
        updateData["IdDetails.fileImage"] = fileIds;
      }

      await ProviderModel.findByIdAndUpdate(entity._id, updateData, {
        new: true,
      });

      return { linked: true, entityId: entity._id };
    } catch (error) {
      console.error(`Error linking images to provider:`, error);
      return {
        linked: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Unlink image from entity
   * Called when image is deleted
   */
  async unlinkImage(
    entityType: EntityType,
    entityId: string,
    imageFieldName: string,
    fileId: Types.ObjectId,
    lastModifiedBy?: string
  ): Promise<{ unlinked: boolean; error?: string }> {
    try {
      const Model = this.getEntityModel(entityType);
      const entityIdField = this.getEntityIdField(entityType);

      const query: Record<string, any> = {
        [entityIdField]: new Types.ObjectId(entityId),
        [imageFieldName]: fileId,
        isDeleted: false,
      };

      const updateData: Record<string, any> = {
        $unset: { [imageFieldName]: 1 },
      };

      // Add lastModifiedBy or lastModified depending on entity type
      if (entityType === "user") {
        updateData.lastModified = new Date();
      } else {
        updateData.lastModifiedBy = lastModifiedBy
          ? new Types.ObjectId(lastModifiedBy)
          : undefined;
      }

      const result = await Model.findOneAndUpdate(query, updateData, {
        new: true,
      });

      return { unlinked: !!result };
    } catch (error) {
      console.error(`Error unlinking image from ${entityType}:`, error);
      return {
        unlinked: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get image status for an entity
   * Useful for debugging and status checks
   */
  async getImageStatus(
    entityType: EntityType,
    entityId: string,
    imageLabel: Label,
    imageFieldName: string
  ): Promise<{
    hasEntity: boolean;
    hasImage: boolean;
    isLinked: boolean;
    isPending: boolean; // Has image but no entity or not linked
    entityId?: Types.ObjectId;
    fileId?: Types.ObjectId;
    url?: string;
  }> {
    try {
      const Model = this.getEntityModel(entityType);
      const entityIdField = this.getEntityIdField(entityType);

      // Check entity
      const query: Record<string, any> = {
        [entityIdField]: new Types.ObjectId(entityId),
        isDeleted: false,
      };

      const entity = await Model.findOne(query);

      // Check image
      const files = await this.fileService.getFilesByEntity(
        entityType,
        entityId,
        {
          status: "active",
        }
      );

      const image = files.find((f) => f.label === imageLabel);

      const hasEntity = !!entity;
      const hasImage = !!image;
      const isLinked =
        hasEntity &&
        hasImage &&
        entity[imageFieldName]?.toString() === image._id.toString();
      const isPending = hasImage && (!hasEntity || !isLinked);

      return {
        hasEntity,
        hasImage,
        isLinked,
        isPending,
        entityId: entity?._id,
        fileId: image?._id,
        url: image?.url,
      };
    } catch (error) {
      console.error(`Error getting ${imageLabel} status:`, error);
      return {
        hasEntity: false,
        hasImage: false,
        isLinked: false,
        isPending: false,
      };
    }
  }

  /**
   * Repair broken links (maintenance function)
   * Finds entities with image references that don't match any active file
   * Or finds orphaned images that should be linked
   */
  async repairBrokenLinks(
    entityType: EntityType,
    imageLabel: Label,
    imageFieldName: string,
    specificEntityId?: string
  ): Promise<{
    repaired: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let repaired = 0;

    try {
      const Model = this.getEntityModel(entityType);
      const entityIdField = this.getEntityIdField(entityType);

      // Build query
      const query: Record<string, any> = { isDeleted: false };
      if (specificEntityId) {
        query[entityIdField] = new Types.ObjectId(specificEntityId);
      }

      // Get all entities
      const entities = await Model.find(query);

      for (const entity of entities) {
        try {
          const entityIdValue =
            entityType === "user"
              ? entity.userId.toString()
              : entity._id.toString();

          // Get active image for this entity
          const files = await this.fileService.getFilesByEntity(
            entityType,
            entityIdValue,
            {
              status: "active",
            }
          );

          const image = files.find((f) => f.label === imageLabel);

          // Case 1: Entity has image reference but file doesn't exist or doesn't match
          if (entity[imageFieldName]) {
            if (
              !image ||
              image._id.toString() !== entity[imageFieldName].toString()
            ) {
              // Remove invalid reference
              const updateData: Record<string, any> = {
                $unset: { [imageFieldName]: 1 },
              };

              if (entityType === "user") {
                updateData.lastModified = new Date();
              }

              await Model.findByIdAndUpdate(entity._id, updateData);
              repaired++;
            }
          }

          // Case 2: Entity exists, image exists, but not linked
          if (!entity[imageFieldName] && image) {
            const updateData: Record<string, any> = {
              [imageFieldName]: image._id,
            };

            if (entityType === "user") {
              updateData.lastModified = new Date();
            }

            await Model.findByIdAndUpdate(entity._id, updateData);
            repaired++;
          }
        } catch (error) {
          errors.push(
            `Failed to repair ${entityType} ${entity._id}: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }

      return { repaired, errors };
    } catch (error) {
      errors.push(
        `Repair process failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return { repaired, errors };
    }
  }

  /**
   * Batch link images to multiple entities
   * Useful for bulk operations
   */
  async batchLinkImages(configs: LinkImageConfig[]): Promise<{
    successful: number;
    failed: number;
    errors: string[];
  }> {
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const config of configs) {
      try {
        // Find the image for this entity
        const files = await this.fileService.getFilesByEntity(
          config.entityType,
          config.entityId,
          {
            status: "active",
          }
        );

        const image = files.find((f) => f.label === config.imageLabel);

        if (!image) {
          failed++;
          errors.push(
            `No ${config.imageLabel} found for ${config.entityType} ${config.entityId}`
          );
          continue;
        }

        const result = await this.linkImageToEntity(
          config.entityType,
          config.entityId,
          config.imageLabel,
          config.imageFieldName,
          image._id,
          config.lastModifiedBy
        );

        if (result.linked) {
          successful++;
        } else {
          failed++;
          errors.push(
            result.error ||
              `Failed to link ${config.imageLabel} to ${config.entityType} ${config.entityId}`
          );
        }
      } catch (error) {
        failed++;
        errors.push(
          `Error processing ${config.entityType} ${config.entityId}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    return { successful, failed, errors };
  }

  /**
   * Get all orphaned images for a specific entity type
   * Images that exist but are not linked to any entity
   */
  async getOrphanedImages(
    entityType: EntityType,
    imageLabel: Label
  ): Promise<{
    orphanedImages: Array<{
      fileId: Types.ObjectId;
      entityId: string;
      url: string;
      uploadedAt: Date;
    }>;
    count: number;
  }> {
    try {
      // This would need to be implemented in your file service
      // For now, we'll return an empty result
      return {
        orphanedImages: [],
        count: 0,
      };
    } catch (error) {
      console.error(`Error getting orphaned ${imageLabel}:`, error);
      return {
        orphanedImages: [],
        count: 0,
      };
    }
  }
}