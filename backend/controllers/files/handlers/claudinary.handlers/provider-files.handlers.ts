// controllers/files/handlers/cloudinary.handlers/provider-files.handlers.ts
import { Response } from "express";
import { Types } from "mongoose";
import { CloudinaryFileService } from "../../../../services/files/claudinary.files.service";
import { MongoDBFileService } from "../../../../services/files/mongodb.files.service";
import { ProviderModel } from "../../../../models/profiles/provider.model";
import {
  handleError,
  AuthenticatedRequest,
  validateObjectId,
} from "../../../../utils/controller-utils/controller.utils";
import ProfileModel from "../../../../models/profiles/userProfile.model";

/**
 * Provider ID Images Upload Handler (Cloudinary)
 * Handles uploading identification documents to Cloudinary
 */
export class ProviderIdImagesUploadHandler {
  private cloudinaryService: CloudinaryFileService;
  private mongoService: MongoDBFileService;

  private readonly CONFIG = {
    entityType: "provider" as const,
    label: "provider_id_image",
    folderPrefix: "providers",
    maxSize: 10 * 1024 * 1024, // 10MB for ID documents
    maxFiles: 5, // Maximum ID images per provider
  };

  constructor(
    cloudinaryService: CloudinaryFileService,
    mongoService: MongoDBFileService
  ) {
    this.cloudinaryService = cloudinaryService;
    this.mongoService = mongoService;
  }

  private async findProvider(providerId: string) {
    return await ProviderModel.findOne({
      _id: new Types.ObjectId(providerId),
      isDeleted: false,
    });
  }

  private async linkIdImages(
    providerId: string,
    fileIds: Types.ObjectId[]
  ): Promise<{ linked: boolean; exists: boolean }> {
    const provider = await this.findProvider(providerId);
    if (!provider) return { linked: false, exists: false };

    try {
      if (!provider.IdDetails) {
        console.warn("Provider IdDetails not initialized");
        return { linked: false, exists: true };
      }

      // Append new images to existing ones
      const existingIds = provider.IdDetails.fileImage || [];
      provider.IdDetails.fileImage = [...existingIds, ...fileIds];
      await provider.save();

      return { linked: true, exists: true };
    } catch (error) {
      console.warn("Failed to link ID images:", error);
      return { linked: false, exists: true };
    }
  }

  /**
   * Upload single ID image
   */
  uploadSingle = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: "No file uploaded" });
        return;
      }

      const { providerId } = req.params;
      const userId = req.userId;

      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      if (!validateObjectId(providerId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid provider ID" });
        return;
      }

      const file = req.file;

      // Validate file is an image or PDF
      const allowedTypes = ["image/", "application/pdf"];
      if (!allowedTypes.some((type) => file.mimetype.startsWith(type))) {
        res.status(400).json({
          success: false,
          message: "ID images must be image files or PDFs",
        });
        return;
      }

      // Validate file size
      if (file.size > this.CONFIG.maxSize) {
        res.status(400).json({
          success: false,
          message: `File must be under ${
            this.CONFIG.maxSize / (1024 * 1024)
          }MB`,
        });
        return;
      }

      // Check if provider exists
      const provider = await this.findProvider(providerId);

      // Check max files limit
      const existingFiles = await this.mongoService.getFilesByEntity(
        this.CONFIG.entityType,
        providerId,
        { status: "active" }
      );

      const existingIdImages = existingFiles.filter(
        (f) => f.label === this.CONFIG.label
      );

      if (existingIdImages.length >= this.CONFIG.maxFiles) {
        res.status(400).json({
          success: false,
          message: `Maximum ${this.CONFIG.maxFiles} ID images allowed per provider`,
        });
        return;
      }

      // Upload to Cloudinary
      const resourceType = file.mimetype.startsWith("image/") ? "image" : "raw";
      const uploadResult = await this.cloudinaryService.uploadFile(
        file.buffer,
        file.originalname,
        {
          folderName: `${this.CONFIG.folderPrefix}/${providerId}/${this.CONFIG.label}`,
          isPublic: false, // ID documents should be private
          resourceType,
          tags: [
            this.CONFIG.entityType,
            this.CONFIG.label,
            providerId.toString(),
          ],
          description: `Provider ID document`,
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
          providerId.toString(),
        ],
        description: `Provider ID document`,
        entityType: this.CONFIG.entityType,
        entityId: new Types.ObjectId(providerId),
        label: this.CONFIG.label,
        status: "active",
      });

      // Auto-link to provider if provider exists
      let linkedToProvider = false;
      if (provider && provider.IdDetails) {
        try {
          const linkResult = await this.linkIdImages(providerId, [
            fileRecord._id,
          ]);
          linkedToProvider = linkResult.linked;
        } catch (linkError) {
          console.warn(
            "File uploaded but failed to link to provider:",
            linkError
          );
        }
      }

      const responseMessage = linkedToProvider
        ? "ID image uploaded and linked successfully"
        : provider && !provider.IdDetails
        ? "ID image uploaded. Please initialize IdDetails with ID type and number first."
        : "ID image uploaded. It will be linked when the provider profile is created.";

      res.status(200).json({
        success: true,
        message: responseMessage,
        data: {
          fileId: fileRecord._id,
          url: uploadResult.secureUrl,
          fileName: uploadResult.fileName,
          linkedToProvider,
          providerExists: !!provider,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to upload ID image");
    }
  };

  /**
   * Upload multiple ID images at once
   */
  uploadMultiple = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        res.status(400).json({ success: false, message: "No files uploaded" });
        return;
      }

      const { providerId } = req.params;
      const userId = req.userId;

      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      if (!validateObjectId(providerId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid provider ID" });
        return;
      }

      const files = req.files as Express.Multer.File[];

      // Check max files limit
      const existingFiles = await this.mongoService.getFilesByEntity(
        this.CONFIG.entityType,
        providerId,
        { status: "active" }
      );

      const existingIdImages = existingFiles.filter(
        (f) => f.label === this.CONFIG.label
      );

      if (existingIdImages.length + files.length > this.CONFIG.maxFiles) {
        res.status(400).json({
          success: false,
          message: `Maximum ${this.CONFIG.maxFiles} ID images allowed. You currently have ${existingIdImages.length}.`,
        });
        return;
      }

      const provider = await this.findProvider(providerId);

      // Upload all files
      const uploadResults = [];
      const fileIds: Types.ObjectId[] = [];

      for (const file of files) {
        try {
          // Validate file type
          const allowedTypes = ["image/", "application/pdf"];
          if (!allowedTypes.some((type) => file.mimetype.startsWith(type))) {
            uploadResults.push({
              fileName: file.originalname,
              success: false,
              error: "Invalid file type",
            });
            continue;
          }

          // Validate file size
          if (file.size > this.CONFIG.maxSize) {
            uploadResults.push({
              fileName: file.originalname,
              success: false,
              error: "File too large",
            });
            continue;
          }

          // Upload to Cloudinary
          const resourceType = file.mimetype.startsWith("image/")
            ? "image"
            : "raw";
          const uploadResult = await this.cloudinaryService.uploadFile(
            file.buffer,
            file.originalname,
            {
              folderName: `${this.CONFIG.folderPrefix}/${providerId}/${this.CONFIG.label}`,
              isPublic: false,
              resourceType,
              tags: [
                this.CONFIG.entityType,
                this.CONFIG.label,
                providerId.toString(),
              ],
              description: `Provider ID document`,
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
              providerId.toString(),
            ],
            description: `Provider ID document`,
            entityType: this.CONFIG.entityType,
            entityId: new Types.ObjectId(providerId),
            label: this.CONFIG.label,
            status: "active",
          });

          fileIds.push(fileRecord._id);
          uploadResults.push({
            fileName: file.originalname,
            success: true,
            fileId: fileRecord._id,
            url: uploadResult.secureUrl,
          });
        } catch (error) {
          uploadResults.push({
            fileName: file.originalname,
            success: false,
            error: error instanceof Error ? error.message : "Upload failed",
          });
        }
      }

      // Link all successfully uploaded files to provider
      let linkedToProvider = false;
      if (provider && provider.IdDetails && fileIds.length > 0) {
        try {
          const linkResult = await this.linkIdImages(providerId, fileIds);
          linkedToProvider = linkResult.linked;
        } catch (linkError) {
          console.warn(
            "Files uploaded but failed to link to provider:",
            linkError
          );
        }
      }

      const successCount = uploadResults.filter((r) => r.success).length;
      const failCount = uploadResults.filter((r) => !r.success).length;

      res.status(200).json({
        success: successCount > 0,
        message: `${successCount} file(s) uploaded successfully${
          failCount > 0 ? `, ${failCount} failed` : ""
        }`,
        data: {
          uploadResults,
          linkedToProvider,
          providerExists: !!provider,
          totalUploaded: successCount,
          totalFailed: failCount,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to upload ID images");
    }
  };

  /**
   * Delete ID image from Cloudinary and database
   */
  delete = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { providerId, fileId } = req.params;
      const userId = req.userId;

      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      if (!validateObjectId(providerId) || !validateObjectId(fileId)) {
        res.status(400).json({ success: false, message: "Invalid ID" });
        return;
      }

      const file = await this.mongoService.getFileById(fileId);

      if (!file || file.label !== this.CONFIG.label) {
        res.status(404).json({
          success: false,
          message: "ID image not found",
        });
        return;
      }

      // Delete from Cloudinary
      if (file.metadata?.publicId) {
        const resourceType = file.mimeType?.startsWith("image/")
          ? "image"
          : "raw";
        await this.cloudinaryService.deleteFile(
          file.metadata.publicId,
          resourceType
        );
      }

      // Unlink from provider
      const provider = await this.findProvider(providerId);
      if (provider && provider.IdDetails) {
        provider.IdDetails.fileImage = provider.IdDetails.fileImage.filter(
          (id) => id.toString() !== fileId
        );
        await provider.save();
      }

      // Delete from MongoDB
      await this.mongoService.deleteFile(fileId);

      res.status(200).json({
        success: true,
        message: "ID image deleted successfully",
      });
    } catch (error) {
      handleError(res, error, "Failed to delete ID image");
    }
  };
}

/**
 * Provider Gallery Images Upload Handler (Cloudinary)
 * Handles uploading business gallery images to Cloudinary
 */
export class ProviderGalleryImagesUploadHandler {
  private cloudinaryService: CloudinaryFileService;
  private mongoService: MongoDBFileService;

  private readonly CONFIG = {
    entityType: "provider" as const,
    label: "provider_gallery",
    folderPrefix: "providers",
    maxSize: 8 * 1024 * 1024, // 8MB for gallery images
    maxFiles: 20, // Maximum gallery images per provider
  };

  constructor(
    cloudinaryService: CloudinaryFileService,
    mongoService: MongoDBFileService
  ) {
    this.cloudinaryService = cloudinaryService;
    this.mongoService = mongoService;
  }

  private async findProvider(providerId: string) {
    return await ProviderModel.findOne({
      _id: new Types.ObjectId(providerId),
      isDeleted: false,
    });
  }

  private async linkGalleryImages(
    providerId: string,
    fileIds: Types.ObjectId[]
  ): Promise<{ linked: boolean; exists: boolean }> {
    const provider = await this.findProvider(providerId);
    if (!provider) return { linked: false, exists: false };

    try {
      // Append new images to existing ones
      const existingIds = provider.BusinessGalleryImages || [];
      provider.BusinessGalleryImages = [...existingIds, ...fileIds];
      await provider.save();

      return { linked: true, exists: true };
    } catch (error) {
      console.warn("Failed to link gallery images:", error);
      return { linked: false, exists: true };
    }
  }

  /**
   * Upload single gallery image
   */
  uploadSingle = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: "No file uploaded" });
        return;
      }

      const { providerId } = req.params;
      const userId = req.userId;

      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      if (!validateObjectId(providerId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid provider ID" });
        return;
      }

      const file = req.file;

      // Validate file is an image
      if (!file.mimetype.startsWith("image/")) {
        res.status(400).json({
          success: false,
          message: "Gallery images must be image files",
        });
        return;
      }

      // Validate file size
      if (file.size > this.CONFIG.maxSize) {
        res.status(400).json({
          success: false,
          message: `File must be under ${
            this.CONFIG.maxSize / (1024 * 1024)
          }MB`,
        });
        return;
      }

      // Check if provider exists
      const provider = await this.findProvider(providerId);

      // Check max files limit
      const existingFiles = await this.mongoService.getFilesByEntity(
        this.CONFIG.entityType,
        providerId,
        { status: "active" }
      );

      const existingGalleryImages = existingFiles.filter(
        (f) => f.label === this.CONFIG.label
      );

      if (existingGalleryImages.length >= this.CONFIG.maxFiles) {
        res.status(400).json({
          success: false,
          message: `Maximum ${this.CONFIG.maxFiles} gallery images allowed per provider`,
        });
        return;
      }

      // Upload to Cloudinary
      const uploadResult = await this.cloudinaryService.uploadFile(
        file.buffer,
        file.originalname,
        {
          folderName: `${this.CONFIG.folderPrefix}/${providerId}/${this.CONFIG.label}`,
          isPublic: true, // Gallery images are public
          resourceType: "image",
          tags: [
            this.CONFIG.entityType,
            this.CONFIG.label,
            providerId.toString(),
          ],
          description: `Provider business gallery image`,
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
          providerId.toString(),
        ],
        description: `Provider business gallery image`,
        entityType: this.CONFIG.entityType,
        entityId: new Types.ObjectId(providerId),
        label: this.CONFIG.label,
        status: "active",
      });

      // Auto-link to provider if provider exists
      let linkedToProvider = false;
      if (provider) {
        try {
          const linkResult = await this.linkGalleryImages(providerId, [
            fileRecord._id,
          ]);
          linkedToProvider = linkResult.linked;
        } catch (linkError) {
          console.warn(
            "File uploaded but failed to link to provider:",
            linkError
          );
        }
      }

      const responseMessage = linkedToProvider
        ? "Gallery image uploaded and linked successfully"
        : "Gallery image uploaded. It will be linked when the provider profile is created.";

      res.status(200).json({
        success: true,
        message: responseMessage,
        data: {
          fileId: fileRecord._id,
          url: uploadResult.secureUrl,
          thumbnailUrl: uploadResult.thumbnailUrl,
          width: uploadResult.width,
          height: uploadResult.height,
          linkedToProvider,
          providerExists: !!provider,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to upload gallery image");
    }
  };

  /**
   * Upload multiple gallery images at once
   */
  /**
   * Upload multiple gallery images at once
   * Uses authenticated user's ID, not providerId
   * Allows upload BEFORE provider profile creation
   */
  uploadMultiple = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        res.status(400).json({ success: false, message: "No files uploaded" });
        return;
      }

      const userId = req.userId;

      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      const files = req.files as Express.Multer.File[];

      // Check if provider profile exists for this user
      const userProfile = await ProfileModel.findOne({
        userId: new Types.ObjectId(userId),
        isDeleted: false,
      });

      let providerId: string | null = null;
      let provider = null;

      if (userProfile) {
        provider = await ProviderModel.findOne({
          profile: userProfile._id,
          isDeleted: false,
        });

        if (provider) {
          providerId = provider._id.toString();
        }
      }

      // Check max files limit if provider exists
      if (providerId) {
        const existingFiles = await this.mongoService.getFilesByEntity(
          this.CONFIG.entityType,
          providerId,
          { status: "active" }
        );

        const existingGalleryImages = existingFiles.filter(
          (f) => f.label === this.CONFIG.label
        );

        if (
          existingGalleryImages.length + files.length >
          this.CONFIG.maxFiles
        ) {
          res.status(400).json({
            success: false,
            message: `Maximum ${this.CONFIG.maxFiles} gallery images allowed. You currently have ${existingGalleryImages.length}.`,
          });
          return;
        }
      }

      // Upload all files
      const uploadResults = [];
      const fileIds: Types.ObjectId[] = [];

      for (const file of files) {
        try {
          // Validate file is an image
          if (!file.mimetype.startsWith("image/")) {
            uploadResults.push({
              fileName: file.originalname,
              success: false,
              error: "Must be an image file",
            });
            continue;
          }

          // Validate file size
          if (file.size > this.CONFIG.maxSize) {
            uploadResults.push({
              fileName: file.originalname,
              success: false,
              error: "File too large",
            });
            continue;
          }

          // Upload to Cloudinary - use userId in folder path, not providerId
          const uploadResult = await this.cloudinaryService.uploadFile(
            file.buffer,
            file.originalname,
            {
              folderName: `${this.CONFIG.folderPrefix}/${userId}/${this.CONFIG.label}`,
              isPublic: true,
              resourceType: "image",
              tags: [
                this.CONFIG.entityType,
                this.CONFIG.label,
                userId.toString(),
              ],
              description: `Provider business gallery image`,
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
              userId.toString(),
            ],
            description: `Provider business gallery image`,
            entityType: this.CONFIG.entityType,
            entityId: new Types.ObjectId(providerId || userId), // Use providerId if exists, else userId
            label: this.CONFIG.label,
            status: "active",
          });

          fileIds.push(fileRecord._id);
          uploadResults.push({
            fileName: file.originalname,
            success: true,
            fileId: fileRecord._id,
            url: uploadResult.secureUrl,
            thumbnailUrl: uploadResult.thumbnailUrl,
          });
        } catch (error) {
          uploadResults.push({
            fileName: file.originalname,
            success: false,
            error: error instanceof Error ? error.message : "Upload failed",
          });
        }
      }

      // Link all successfully uploaded files to provider if it exists
      let linkedToProvider = false;
      if (provider && fileIds.length > 0 && providerId) {
        try {
          const linkResult = await this.linkGalleryImages(providerId, fileIds);
          linkedToProvider = linkResult.linked;
        } catch (linkError) {
          console.warn(
            "Files uploaded but failed to link to provider:",
            linkError
          );
        }
      }

      const successCount = uploadResults.filter((r) => r.success).length;
      const failCount = uploadResults.filter((r) => !r.success).length;

      const responseMessage = linkedToProvider
        ? `${successCount} gallery image(s) uploaded and linked successfully${
            failCount > 0 ? `, ${failCount} failed` : ""
          }`
        : `${successCount} gallery image(s) uploaded successfully${
            failCount > 0 ? `, ${failCount} failed` : ""
          }. They will be automatically linked when you create your provider profile.`;

      res.status(200).json({
        success: successCount > 0,
        message: responseMessage,
        data: {
          uploadResults,
          linkedToProvider,
          providerExists: !!provider,
          totalUploaded: successCount,
          totalFailed: failCount,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to upload gallery images");
    }
  };

  /**
   * Delete gallery image from Cloudinary and database
   */
  delete = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { providerId, fileId } = req.params;
      const userId = req.userId;

      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      if (!validateObjectId(providerId) || !validateObjectId(fileId)) {
        res.status(400).json({ success: false, message: "Invalid ID" });
        return;
      }

      const file = await this.mongoService.getFileById(fileId);

      if (!file || file.label !== this.CONFIG.label) {
        res.status(404).json({
          success: false,
          message: "Gallery image not found",
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

      // Unlink from provider
      const provider = await this.findProvider(providerId);
      if (provider) {
        provider.BusinessGalleryImages = (
          provider.BusinessGalleryImages || []
        ).filter((id) => id.toString() !== fileId);
        await provider.save();
      }

      // Delete from MongoDB
      await this.mongoService.deleteFile(fileId);

      res.status(200).json({
        success: true,
        message: "Gallery image deleted successfully",
      });
    } catch (error) {
      handleError(res, error, "Failed to delete gallery image");
    }
  };

  /**
   * Get optimized version of gallery image
   */
  getOptimized = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { providerId, fileId } = req.params;
      const { width, quality, format } = req.query;

      if (!validateObjectId(providerId) || !validateObjectId(fileId)) {
        res.status(400).json({ success: false, message: "Invalid ID" });
        return;
      }

      const file = await this.mongoService.getFileById(fileId);

      if (!file || file.label !== this.CONFIG.label) {
        res.status(404).json({
          success: false,
          message: "Gallery image not found",
        });
        return;
      }

      if (!file.metadata?.publicId) {
        res.status(400).json({
          success: false,
          message: "Image does not have Cloudinary public ID",
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
      handleError(res, error, "Failed to generate optimized gallery image");
    }
  };
}
