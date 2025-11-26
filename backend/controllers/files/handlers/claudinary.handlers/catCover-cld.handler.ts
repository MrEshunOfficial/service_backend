// controllers/files/handlers/cloudinary.handlers/category-cover.handler.ts
import { Response } from "express";
import { Types } from "mongoose";
import { CloudinaryFileService } from "../../../../services/files/claudinary.files.service";
import { MongoDBFileService } from "../../../../services/files/mongodb.files.service";
import { CategoryModel } from "../../../../models/category.model";
import {
  handleError,
  validateObjectId,
  AuthenticatedRequest,
} from "../../../../utils/controller-utils/controller.utils";

export class CategoryCoverHandler {
  private cloudinaryService: CloudinaryFileService;
  private mongoService: MongoDBFileService;

  private readonly CONFIG = {
    entityType: "category" as const,
    label: "category_cover",
    folderPrefix: "categories",
    maxSize: 10 * 1024 * 1024, // 10MB
    fileIdField: "catCoverId",
    queryField: "_id",
  };

  constructor(
    cloudinaryService: CloudinaryFileService,
    mongoService: MongoDBFileService
  ) {
    this.cloudinaryService = cloudinaryService;
    this.mongoService = mongoService;
  }

  private async findEntity(entityId: string) {
    return await CategoryModel.findOne({
      _id: new Types.ObjectId(entityId),
      isDeleted: false,
    });
  }

  private async updateEntity(
    entityId: string,
    fileId: Types.ObjectId,
    userId: string
  ) {
    return await CategoryModel.findByIdAndUpdate(
      new Types.ObjectId(entityId),
      {
        catCoverId: fileId,
        lastModifiedBy: new Types.ObjectId(userId),
      },
      { new: true }
    );
  }

  private async unlinkEntity(
    entityId: string,
    fileId: Types.ObjectId,
    userId: string
  ) {
    const category = await CategoryModel.findOne({
      _id: new Types.ObjectId(entityId),
      catCoverId: fileId,
      isDeleted: false,
    });
    if (!category) return null;

    return await CategoryModel.findByIdAndUpdate(category._id, {
      $unset: { catCoverId: 1 },
      lastModifiedBy: new Types.ObjectId(userId),
    });
  }

  upload = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: "No file uploaded" });
        return;
      }

      const { categoryId } = req.params;
      const userId = req.userId;

      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      if (!validateObjectId(categoryId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid category ID" });
        return;
      }

      const file = req.file;

      // Validate file is an image
      if (!file.mimetype.startsWith("image/")) {
        res.status(400).json({
          success: false,
          message: `${this.CONFIG.label} must be an image file`,
        });
        return;
      }

      // Validate file size
      if (file.size > this.CONFIG.maxSize) {
        res.status(400).json({
          success: false,
          message: `${this.CONFIG.label} must be under ${
            this.CONFIG.maxSize / (1024 * 1024)
          }MB`,
        });
        return;
      }

      // Check if entity exists
      const entity = await this.findEntity(categoryId);

      // Delete old file if exists
      const oldFiles = await this.mongoService.getFilesByEntity(
        this.CONFIG.entityType,
        categoryId,
        { status: "active" }
      );

      const oldFile = oldFiles.find((f) => f.label === this.CONFIG.label);

      if (oldFile) {
        if (oldFile.metadata?.publicId) {
          try {
            await this.cloudinaryService.deleteFile(
              oldFile.metadata.publicId,
              "image"
            );
          } catch (error) {
            console.warn(
              `Failed to delete old ${this.CONFIG.label} from Cloudinary:`,
              error
            );
          }
        }
        await this.mongoService.archiveFile(oldFile._id);
      }

      // Upload new file to Cloudinary
      const uploadResult = await this.cloudinaryService.uploadFile(
        file.buffer,
        file.originalname,
        {
          folderName: `${this.CONFIG.folderPrefix}/${categoryId}/${this.CONFIG.label}`,
          isPublic: true,
          resourceType: "image",
          tags: [
            this.CONFIG.entityType,
            this.CONFIG.label,
            categoryId.toString(),
          ],
          description: `${this.CONFIG.entityType} ${this.CONFIG.label}`,
          entityType: this.CONFIG.entityType,
          entityId: crypto.randomUUID(),
          uploaderId: new Types.ObjectId(userId),
          label: this.CONFIG.label,
        }
      );

      // Create MongoDB record
      const fileRecord = await this.mongoService.createFile({
        uploaderId: new Types.ObjectId(userId),
        url: uploadResult.secureUrl,
        fileName: uploadResult.fileName,
        fileSize: uploadResult.fileSize,
        mimeType: file.mimetype,
        extension: uploadResult.extension,
        thumbnailUrl: uploadResult.thumbnailUrl,
        storageProvider: "cloudinary",
        metadata: {
          publicId: uploadResult.publicId,
          format: uploadResult.format,
          resourceType: uploadResult.resourceType,
          width: uploadResult.width,
          height: uploadResult.height,
        },
        tags: [
          this.CONFIG.entityType,
          this.CONFIG.label,
          categoryId.toString(),
        ],
        description: `${this.CONFIG.entityType} ${this.CONFIG.label}`,
        entityType: this.CONFIG.entityType,
        entityId: new Types.ObjectId(categoryId),
        label: this.CONFIG.label,
        status: "active",
      });

      // Auto-link to entity if entity exists
      let linkedToEntity = false;
      if (entity) {
        try {
          await this.updateEntity(categoryId, fileRecord._id, userId);
          linkedToEntity = true;
        } catch (linkError) {
          console.warn(
            `File uploaded but failed to link to ${this.CONFIG.entityType}:`,
            linkError
          );
        }
      }

      const responseMessage = linkedToEntity
        ? `${this.CONFIG.label} uploaded and linked successfully`
        : `${this.CONFIG.label} uploaded successfully. It will be automatically linked when the ${this.CONFIG.entityType} is created.`;

      res.status(200).json({
        success: true,
        message: responseMessage,
        data: {
          fileId: fileRecord._id,
          url: uploadResult.secureUrl,
          thumbnailUrl: uploadResult.thumbnailUrl,
          width: uploadResult.width,
          height: uploadResult.height,
          linkedToEntity,
          entityExists: !!entity,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to upload category cover image");
    }
  };

  get = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { categoryId } = req.params;

      if (!validateObjectId(categoryId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid category ID" });
        return;
      }

      const files = await this.mongoService.getFilesByEntity(
        this.CONFIG.entityType,
        categoryId,
        { status: "active" }
      );

      const file = files.find((f) => f.label === this.CONFIG.label);

      if (!file) {
        res.status(404).json({
          success: false,
          message: `${this.CONFIG.label} not found`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          fileId: file._id,
          url: file.url,
          thumbnailUrl: file.thumbnailUrl,
          uploadedAt: file.uploadedAt,
          metadata: file.metadata,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to get category cover image");
    }
  };

  delete = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { categoryId } = req.params;
      const userId = req.userId;

      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      if (!validateObjectId(categoryId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid category ID" });
        return;
      }

      const files = await this.mongoService.getFilesByEntity(
        this.CONFIG.entityType,
        categoryId,
        { status: "active" }
      );

      const file = files.find((f) => f.label === this.CONFIG.label);

      if (!file) {
        res.status(404).json({
          success: false,
          message: `${this.CONFIG.label} not found`,
        });
        return;
      }

      // Delete from Cloudinary
      if (file.metadata?.publicId) {
        await this.cloudinaryService.deleteFile(
          file.metadata.publicId,
          "image"
        );
      }

      // Unlink from entity if linked
      await this.unlinkEntity(categoryId, file._id, userId);

      // Delete from MongoDB
      await this.mongoService.deleteFile(file._id);

      res.status(200).json({
        success: true,
        message: "Category cover image deleted successfully",
      });
    } catch (error) {
      handleError(res, error, "Failed to delete category cover image");
    }
  };

  getOptimized = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { categoryId } = req.params;
      const { width, height, quality, format } = req.query;

      if (!validateObjectId(categoryId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid category ID" });
        return;
      }

      const files = await this.mongoService.getFilesByEntity(
        this.CONFIG.entityType,
        categoryId,
        { status: "active" }
      );

      const file = files.find((f) => f.label === this.CONFIG.label);

      if (!file) {
        res.status(404).json({
          success: false,
          message: `${this.CONFIG.label} not found`,
        });
        return;
      }

      if (!file.metadata?.publicId) {
        res.status(400).json({
          success: false,
          message: `${this.CONFIG.label} does not have Cloudinary public ID`,
        });
        return;
      }

      const allowedFormats = ["auto", "webp", "jpg", "png"] as const;
      type AllowedFormat = (typeof allowedFormats)[number];

      const optimizedUrl = this.cloudinaryService.getOptimizedUrl(
        file.metadata.publicId,
        {
          width: width ? parseInt(width as string) : undefined,
          quality:
            quality === "auto"
              ? "auto"
              : quality
              ? parseInt(quality as string)
              : undefined,
          format: allowedFormats.includes(format as any)
            ? (format as AllowedFormat)
            : undefined,
        }
      );

      res.status(200).json({
        success: true,
        data: {
          optimizedUrl,
          originalUrl: file.url,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to generate optimized category cover");
    }
  };
}
