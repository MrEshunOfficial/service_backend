// controllers/files/handlers/cloudinary.handlers/client-id-details.handler.ts
import { Response } from "express";
import { Types } from "mongoose";
import { CloudinaryFileService } from "../../../../services/files/claudinary.files.service";
import { MongoDBFileService } from "../../../../services/files/mongodb.files.service";
import ProfileModel from "../../../../models/profiles/userProfile.model";
import {
  handleError,
  AuthenticatedRequest,
  validateObjectId,
} from "../../../../utils/controller-utils/controller.utils";
import { ClientModel } from "../../../../models/profiles/clientProfileModel";

/**
 * Client ID Images Upload Handler (Cloudinary)
 * Handles uploading client identification documents to Cloudinary
 */
export class ClientIdImagesUploadHandler {
  private cloudinaryService: CloudinaryFileService;
  private mongoService: MongoDBFileService;

  private readonly CONFIG = {
    entityType: "client" as const,
    label: "client_id_image",
    folderPrefix: "clients",
    maxSize: 10 * 1024 * 1024, // 10MB for ID documents
    maxFiles: 5, // Maximum ID images per client
  };

  constructor(
    cloudinaryService: CloudinaryFileService,
    mongoService: MongoDBFileService
  ) {
    this.cloudinaryService = cloudinaryService;
    this.mongoService = mongoService;
  }

  private async findClient(clientId: string) {
    return await ClientModel.findOne({
      _id: new Types.ObjectId(clientId),
      isDeleted: false,
    });
  }

  private async linkIdImages(
    clientId: string,
    fileIds: Types.ObjectId[]
  ): Promise<{ linked: boolean; exists: boolean }> {
    const client = await this.findClient(clientId);
    if (!client) return { linked: false, exists: false };

    try {
      if (!client.idDetails) {
        console.warn("Client idDetails not initialized");
        return { linked: false, exists: true };
      }

      // Append new images to existing ones
      const existingIds = client.idDetails.fileImage || [];
      client.idDetails.fileImage = [...existingIds, ...fileIds];
      await client.save();

      return { linked: true, exists: true };
    } catch (error) {
      console.warn("Failed to link ID images:", error);
      return { linked: false, exists: true };
    }
  }

  /**
   * Upload single ID image
   * Uses authenticated userId, allowing upload BEFORE client profile creation
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

      const userId = req.userId;

      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      // Find client profile if it exists
      const userProfile = await ProfileModel.findOne({
        userId: new Types.ObjectId(userId),
        isDeleted: false,
      });

      let clientId: string | null = null;
      let client = null;

      if (userProfile) {
        client = await ClientModel.findOne({
          profile: userProfile._id,
          isDeleted: false,
        });

        if (client) {
          clientId = client._id.toString();
        }
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

      // Check max files limit if client exists
      if (clientId) {
        const existingFiles = await this.mongoService.getFilesByEntity(
          this.CONFIG.entityType,
          clientId,
          { status: "active" }
        );

        const existingIdImages = existingFiles.filter(
          (f) => f.label === this.CONFIG.label
        );

        if (existingIdImages.length >= this.CONFIG.maxFiles) {
          res.status(400).json({
            success: false,
            message: `Maximum ${this.CONFIG.maxFiles} ID images allowed per client`,
          });
          return;
        }
      }

      // Upload to Cloudinary - use userId in folder path
      const resourceType = file.mimetype.startsWith("image/") ? "image" : "raw";
      const uploadResult = await this.cloudinaryService.uploadFile(
        file.buffer,
        file.originalname,
        {
          folderName: `${this.CONFIG.folderPrefix}/${userId}/${this.CONFIG.label}`,
          isPublic: false, // ID documents should be private
          resourceType,
          tags: [this.CONFIG.entityType, this.CONFIG.label, userId.toString()],
          description: `Client ID document`,
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
        tags: [this.CONFIG.entityType, this.CONFIG.label, userId.toString()],
        description: `Client ID document`,
        entityType: this.CONFIG.entityType,
        entityId: new Types.ObjectId(clientId || userId), // Use clientId if exists, else userId
        label: this.CONFIG.label,
        status: "active",
      });

      // Auto-link to client if client exists and has idDetails
      let linkedToClient = false;
      if (client && client.idDetails && clientId) {
        try {
          const linkResult = await this.linkIdImages(clientId, [
            fileRecord._id,
          ]);
          linkedToClient = linkResult.linked;
        } catch (linkError) {
          console.warn(
            "File uploaded but failed to link to client:",
            linkError
          );
        }
      }

      const responseMessage = linkedToClient
        ? "ID image uploaded and linked successfully"
        : client && !client.idDetails
        ? "ID image uploaded. Please initialize idDetails with ID type and number first."
        : "ID image uploaded. It will be linked when the client profile is created.";

      res.status(200).json({
        success: true,
        message: responseMessage,
        data: {
          fileId: fileRecord._id,
          url: uploadResult.secureUrl,
          fileName: uploadResult.fileName,
          linkedToClient,
          clientExists: !!client,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to upload ID image");
    }
  };

  /**
   * Upload multiple ID images at once
   * Uses authenticated userId, allowing upload BEFORE client profile creation
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

      // Find client profile if it exists
      const userProfile = await ProfileModel.findOne({
        userId: new Types.ObjectId(userId),
        isDeleted: false,
      });

      let clientId: string | null = null;
      let client = null;

      if (userProfile) {
        client = await ClientModel.findOne({
          profile: userProfile._id,
          isDeleted: false,
        });

        if (client) {
          clientId = client._id.toString();
        }
      }

      const files = req.files as Express.Multer.File[];

      // Check max files limit if client exists
      if (clientId) {
        const existingFiles = await this.mongoService.getFilesByEntity(
          this.CONFIG.entityType,
          clientId,
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
      }

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

          // Upload to Cloudinary - use userId in folder path
          const resourceType = file.mimetype.startsWith("image/")
            ? "image"
            : "raw";
          const uploadResult = await this.cloudinaryService.uploadFile(
            file.buffer,
            file.originalname,
            {
              folderName: `${this.CONFIG.folderPrefix}/${userId}/${this.CONFIG.label}`,
              isPublic: false,
              resourceType,
              tags: [
                this.CONFIG.entityType,
                this.CONFIG.label,
                userId.toString(),
              ],
              description: `Client ID document`,
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
            description: `Client ID document`,
            entityType: this.CONFIG.entityType,
            entityId: new Types.ObjectId(clientId || userId), // Use clientId if exists, else userId
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

      // Link all successfully uploaded files to client
      let linkedToClient = false;
      if (client && client.idDetails && fileIds.length > 0 && clientId) {
        try {
          const linkResult = await this.linkIdImages(clientId, fileIds);
          linkedToClient = linkResult.linked;
        } catch (linkError) {
          console.warn(
            "Files uploaded but failed to link to client:",
            linkError
          );
        }
      }

      const successCount = uploadResults.filter((r) => r.success).length;
      const failCount = uploadResults.filter((r) => !r.success).length;

      const responseMessage = linkedToClient
        ? `${successCount} ID image(s) uploaded and linked successfully${
            failCount > 0 ? `, ${failCount} failed` : ""
          }`
        : `${successCount} ID image(s) uploaded successfully${
            failCount > 0 ? `, ${failCount} failed` : ""
          }. They will be automatically linked when you create your client profile.`;

      res.status(200).json({
        success: successCount > 0,
        message: responseMessage,
        data: {
          uploadResults,
          linkedToClient,
          clientExists: !!client,
          totalUploaded: successCount,
          totalFailed: failCount,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to upload ID images");
    }
  };

  /**
   * Get all ID images for a client
   */
  getAll = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { clientId } = req.params;
      const userId = req.userId;

      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      if (!validateObjectId(clientId)) {
        res.status(400).json({ success: false, message: "Invalid client ID" });
        return;
      }

      const files = await this.mongoService.getFilesByEntity(
        this.CONFIG.entityType,
        clientId,
        { status: "active" }
      );

      const idImages = files.filter((f) => f.label === this.CONFIG.label);

      res.status(200).json({
        success: true,
        data: {
          images: idImages.map((img) => ({
            fileId: img._id,
            url: img.url,
            fileName: img.fileName,
            fileSize: img.fileSize,
            mimeType: img.mimeType,
            uploadedAt: img.uploadedAt,
            metadata: img.metadata,
          })),
          totalCount: idImages.length,
          maxAllowed: this.CONFIG.maxFiles,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to retrieve ID images");
    }
  };

  /**
   * Get single ID image
   */
  getSingle = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { clientId, fileId } = req.params;
      const userId = req.userId;

      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      if (!validateObjectId(clientId) || !validateObjectId(fileId)) {
        res.status(400).json({ success: false, message: "Invalid ID" });
        return;
      }

      const file = await this.mongoService.getFileById(fileId);

      if (
        !file ||
        file.label !== this.CONFIG.label ||
        file.entityId?.toString() !== clientId
      ) {
        res.status(404).json({
          success: false,
          message: "ID image not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          fileId: file._id,
          url: file.url,
          fileName: file.fileName,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          uploadedAt: file.uploadedAt,
          metadata: file.metadata,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to retrieve ID image");
    }
  };

  /**
   * Delete ID image from Cloudinary and database
   */
  delete = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { clientId, fileId } = req.params;
      const userId = req.userId;

      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      if (!validateObjectId(clientId) || !validateObjectId(fileId)) {
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

      // Unlink from client
      const client = await this.findClient(clientId);
      if (client && client.idDetails) {
        client.idDetails.fileImage = client.idDetails.fileImage.filter(
          (id) => id.toString() !== fileId
        );
        await client.save();
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

  /**
   * Delete all ID images for a client
   */
  deleteAll = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { clientId } = req.params;
      const userId = req.userId;

      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      if (!validateObjectId(clientId)) {
        res.status(400).json({ success: false, message: "Invalid client ID" });
        return;
      }

      const files = await this.mongoService.getFilesByEntity(
        this.CONFIG.entityType,
        clientId,
        { status: "active" }
      );

      const idImages = files.filter((f) => f.label === this.CONFIG.label);

      if (idImages.length === 0) {
        res.status(404).json({
          success: false,
          message: "No ID images found",
        });
        return;
      }

      let deletedCount = 0;
      let failedCount = 0;

      // Delete each image
      for (const file of idImages) {
        try {
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

          // Delete from MongoDB
          await this.mongoService.deleteFile(file._id);
          deletedCount++;
        } catch (error) {
          console.warn(`Failed to delete file ${file._id}:`, error);
          failedCount++;
        }
      }

      // Clear ID images array in client profile
      const client = await this.findClient(clientId);
      if (client && client.idDetails) {
        client.idDetails.fileImage = [];
        await client.save();
      }

      res.status(200).json({
        success: deletedCount > 0,
        message: `${deletedCount} ID image(s) deleted successfully${
          failedCount > 0 ? `, ${failedCount} failed` : ""
        }`,
        data: {
          deletedCount,
          failedCount,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to delete ID images");
    }
  };
}
