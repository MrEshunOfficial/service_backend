// controllers/files/handlers/provider-files.handlers.ts
import { Response } from "express";
import { Types } from "mongoose";
import { ProviderModel } from "../../../../models/profiles/provider.model";
import { MongoDBFileService } from "../../../../services/files/mongodb.files.service";
import { AuthenticatedRequest } from "../../../../types/user.types";
import {
  validateObjectId,
  handleError,
} from "../../../../utils/controller-utils/controller.utils";

/**
 * Provider ID Images Handler
 * Manages identification documents for provider profiles
 */
export class ProviderIdImagesHandlers {
  constructor(private fileService: MongoDBFileService) {}

  private async getActiveIdImages(providerId: string) {
    const files = await this.fileService.getFilesByEntity(
      "provider",
      providerId,
      {
        status: "active",
      }
    );
    return files.filter((f) => f.label === "provider_id_image");
  }

  private async unlinkIdImage(providerId: string, fileId: Types.ObjectId) {
    const provider = await ProviderModel.findOne({
      _id: new Types.ObjectId(providerId),
      isDeleted: false,
    });

    if (!provider || !provider.IdDetails) return;

    provider.IdDetails.fileImage = provider.IdDetails.fileImage.filter(
      (id) => id.toString() !== fileId.toString()
    );

    await provider.save();
  }

  private async linkIdImages(
    providerId: string,
    fileIds: Types.ObjectId[]
  ): Promise<{ linked: boolean; exists: boolean }> {
    const provider = await ProviderModel.findOne({
      _id: new Types.ObjectId(providerId),
      isDeleted: false,
    });

    if (!provider) return { linked: false, exists: false };

    try {
      if (!provider.IdDetails) {
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
   * Get all active ID images for a provider
   */
  getRecords = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { providerId } = req.params;

      if (!validateObjectId(providerId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid provider ID" });
        return;
      }

      const files = await this.getActiveIdImages(providerId);

      if (files.length === 0) {
        res.status(404).json({
          success: false,
          message: "No ID images found for this provider",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          count: files.length,
          images: files.map((f) => ({
            fileId: f._id,
            url: f.url,
            fileName: f.fileName,
            uploadedAt: f.uploadedAt,
            metadata: f.metadata,
          })),
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to get ID images");
    }
  };

  /**
   * Get single ID image by file ID
   */
  getRecord = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { providerId, fileId } = req.params;

      if (!validateObjectId(providerId) || !validateObjectId(fileId)) {
        res.status(400).json({ success: false, message: "Invalid ID" });
        return;
      }

      const file = await this.fileService.getFileById(fileId);

      if (!file || file.label !== "provider_id_image") {
        res.status(404).json({
          success: false,
          message: "ID image not found",
        });
        return;
      }

      if (file.entityId?.toString() !== providerId) {
        res.status(403).json({
          success: false,
          message: "ID image does not belong to this provider",
        });
        return;
      }

      await this.fileService.markAsAccessed(file._id);

      res.status(200).json({
        success: true,
        data: {
          fileId: file._id,
          url: file.url,
          fileName: file.fileName,
          uploadedAt: file.uploadedAt,
          metadata: file.metadata,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to get ID image");
    }
  };

  /**
   * Get history of ID images (including archived)
   */
  getHistory = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { providerId } = req.params;
      const { limit = "10", skip = "0" } = req.query;

      if (!validateObjectId(providerId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid provider ID" });
        return;
      }

      const [activeFiles, archivedFiles] = await Promise.all([
        this.fileService.getFilesByEntity("provider", providerId, {
          status: "active",
        }),
        this.fileService.getFilesByEntity("provider", providerId, {
          status: "archived",
          limit: parseInt(limit as string),
          skip: parseInt(skip as string),
          sort: { archivedAt: -1 },
        }),
      ]);

      const activeIdImages = activeFiles.filter(
        (f) => f.label === "provider_id_image"
      );
      const archivedIdImages = archivedFiles.filter(
        (f) => f.label === "provider_id_image"
      );

      res.status(200).json({
        success: true,
        data: {
          current: activeIdImages,
          history: archivedIdImages,
          totalActive: activeIdImages.length,
          totalArchived: archivedIdImages.length,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to get ID images history");
    }
  };

  /**
   * Update metadata for an ID image
   */
  updateMetadata = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { providerId, fileId } = req.params;
      const { description, tags } = req.body;

      if (!validateObjectId(providerId) || !validateObjectId(fileId)) {
        res.status(400).json({ success: false, message: "Invalid ID" });
        return;
      }

      const file = await this.fileService.getFileById(fileId);

      if (!file || file.label !== "provider_id_image") {
        res.status(404).json({
          success: false,
          message: "ID image not found",
        });
        return;
      }

      const updateData: any = {};
      if (description !== undefined) updateData.description = description;
      if (tags !== undefined) updateData.tags = tags;

      const updatedFile = await this.fileService.updateFile(fileId, updateData);

      res.status(200).json({
        success: true,
        message: "ID image metadata updated successfully",
        data: updatedFile,
      });
    } catch (error) {
      handleError(res, error, "Failed to update ID image metadata");
    }
  };

  /**
   * Archive a single ID image
   */
  archive = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { providerId, fileId } = req.params;

      if (!validateObjectId(providerId) || !validateObjectId(fileId)) {
        res.status(400).json({ success: false, message: "Invalid ID" });
        return;
      }

      const file = await this.fileService.getFileById(fileId);

      if (!file || file.label !== "provider_id_image") {
        res.status(404).json({
          success: false,
          message: "ID image not found",
        });
        return;
      }

      await this.unlinkIdImage(providerId, file._id);
      const archivedFile = await this.fileService.archiveFile(file._id);

      res.status(200).json({
        success: true,
        message: "ID image archived successfully",
        data: archivedFile,
      });
    } catch (error) {
      handleError(res, error, "Failed to archive ID image");
    }
  };

  /**
   * Restore an archived ID image
   */
  restore = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { providerId, fileId } = req.params;

      if (!validateObjectId(providerId) || !validateObjectId(fileId)) {
        res.status(400).json({ success: false, message: "Invalid ID" });
        return;
      }

      const file = await this.fileService.getFileById(fileId);

      if (!file || file.label !== "provider_id_image") {
        res.status(404).json({
          success: false,
          message: "File not found or not an ID image",
        });
        return;
      }

      const restoredFile = await this.fileService.restoreFile(fileId);
      const linkResult = await this.linkIdImages(providerId, [
        restoredFile?._id!,
      ]);

      res.status(200).json({
        success: true,
        message: "ID image restored successfully",
        data: {
          ...restoredFile,
          linkedToProvider: linkResult.linked,
          providerExists: linkResult.exists,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to restore ID image");
    }
  };

  /**
   * Permanently delete an ID image
   */
  delete = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { providerId, fileId } = req.params;

      if (!validateObjectId(providerId) || !validateObjectId(fileId)) {
        res.status(400).json({ success: false, message: "Invalid ID" });
        return;
      }

      const file = await this.fileService.getFileById(fileId);

      if (!file || file.label !== "provider_id_image") {
        res.status(404).json({
          success: false,
          message: "ID image not found",
        });
        return;
      }

      await this.unlinkIdImage(providerId, file._id);
      const deleted = await this.fileService.deleteFile(file._id);

      if (!deleted) {
        res.status(500).json({
          success: false,
          message: "Failed to delete ID image",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "ID image deleted permanently",
      });
    } catch (error) {
      handleError(res, error, "Failed to delete ID image");
    }
  };

  /**
   * Get statistics for provider ID images
   */
  getStats = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { providerId } = req.params;

      if (!validateObjectId(providerId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid provider ID" });
        return;
      }

      const [activeFiles, archivedFiles] = await Promise.all([
        this.fileService.getFilesByEntity("provider", providerId, {
          status: "active",
        }),
        this.fileService.getFilesByEntity("provider", providerId, {
          status: "archived",
        }),
      ]);

      const activeIdImages = activeFiles.filter(
        (f) => f.label === "provider_id_image"
      );
      const archivedIdImages = archivedFiles.filter(
        (f) => f.label === "provider_id_image"
      );

      const totalSize = [...activeIdImages, ...archivedIdImages].reduce(
        (sum, file) => sum + (file.fileSize || 0),
        0
      );

      res.status(200).json({
        success: true,
        data: {
          totalIdImages: activeIdImages.length + archivedIdImages.length,
          activeCount: activeIdImages.length,
          archivedCount: archivedIdImages.length,
          totalStorageUsed: totalSize,
          totalStorageUsedMB: (totalSize / (1024 * 1024)).toFixed(2),
          activeImages: activeIdImages.map((f) => ({
            fileId: f._id,
            url: f.url,
            fileName: f.fileName,
            fileSize: f.fileSize,
            uploadedAt: f.uploadedAt,
          })),
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to get ID images statistics");
    }
  };
}

/**
 * Provider Gallery Images Handler
 * Manages business gallery images for provider profiles
 */
export class ProviderGalleryImagesHandlers {
  constructor(private fileService: MongoDBFileService) {}

  private async getActiveGalleryImages(providerId: string) {
    const files = await this.fileService.getFilesByEntity(
      "provider",
      providerId,
      {
        status: "active",
      }
    );
    return files.filter((f) => f.label === "provider_gallery");
  }

  private async unlinkGalleryImage(providerId: string, fileId: Types.ObjectId) {
    const provider = await ProviderModel.findOne({
      _id: new Types.ObjectId(providerId),
      isDeleted: false,
    });

    if (!provider) return;

    provider.BusinessGalleryImages = (
      provider.BusinessGalleryImages || []
    ).filter((id) => id.toString() !== fileId.toString());

    await provider.save();
  }

  private async linkGalleryImages(
    providerId: string,
    fileIds: Types.ObjectId[]
  ): Promise<{ linked: boolean; exists: boolean }> {
    const provider = await ProviderModel.findOne({
      _id: new Types.ObjectId(providerId),
      isDeleted: false,
    });

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
   * Get all active gallery images for a provider
   */
  getRecords = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { providerId } = req.params;

      if (!validateObjectId(providerId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid provider ID" });
        return;
      }

      const files = await this.getActiveGalleryImages(providerId);

      if (files.length === 0) {
        res.status(404).json({
          success: false,
          message: "No gallery images found for this provider",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          count: files.length,
          images: files.map((f) => ({
            fileId: f._id,
            url: f.url,
            thumbnailUrl: f.thumbnailUrl,
            fileName: f.fileName,
            uploadedAt: f.uploadedAt,
            metadata: f.metadata,
          })),
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to get gallery images");
    }
  };

  /**
   * Get single gallery image by file ID
   */
  getRecord = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { providerId, fileId } = req.params;

      if (!validateObjectId(providerId) || !validateObjectId(fileId)) {
        res.status(400).json({ success: false, message: "Invalid ID" });
        return;
      }

      const file = await this.fileService.getFileById(fileId);

      if (!file || file.label !== "provider_gallery") {
        res.status(404).json({
          success: false,
          message: "Gallery image not found",
        });
        return;
      }

      if (file.entityId?.toString() !== providerId) {
        res.status(403).json({
          success: false,
          message: "Gallery image does not belong to this provider",
        });
        return;
      }

      await this.fileService.markAsAccessed(file._id);

      res.status(200).json({
        success: true,
        data: {
          fileId: file._id,
          url: file.url,
          thumbnailUrl: file.thumbnailUrl,
          fileName: file.fileName,
          uploadedAt: file.uploadedAt,
          metadata: file.metadata,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to get gallery image");
    }
  };

  /**
   * Get history of gallery images (including archived)
   */
  getHistory = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { providerId } = req.params;
      const { limit = "20", skip = "0" } = req.query;

      if (!validateObjectId(providerId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid provider ID" });
        return;
      }

      const [activeFiles, archivedFiles] = await Promise.all([
        this.fileService.getFilesByEntity("provider", providerId, {
          status: "active",
        }),
        this.fileService.getFilesByEntity("provider", providerId, {
          status: "archived",
          limit: parseInt(limit as string),
          skip: parseInt(skip as string),
          sort: { archivedAt: -1 },
        }),
      ]);

      const activeGalleryImages = activeFiles.filter(
        (f) => f.label === "provider_gallery"
      );
      const archivedGalleryImages = archivedFiles.filter(
        (f) => f.label === "provider_gallery"
      );

      res.status(200).json({
        success: true,
        data: {
          current: activeGalleryImages,
          history: archivedGalleryImages,
          totalActive: activeGalleryImages.length,
          totalArchived: archivedGalleryImages.length,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to get gallery images history");
    }
  };

  /**
   * Update metadata for a gallery image
   */
  updateMetadata = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { providerId, fileId } = req.params;
      const { description, tags } = req.body;

      if (!validateObjectId(providerId) || !validateObjectId(fileId)) {
        res.status(400).json({ success: false, message: "Invalid ID" });
        return;
      }

      const file = await this.fileService.getFileById(fileId);

      if (!file || file.label !== "provider_gallery") {
        res.status(404).json({
          success: false,
          message: "Gallery image not found",
        });
        return;
      }

      const updateData: any = {};
      if (description !== undefined) updateData.description = description;
      if (tags !== undefined) updateData.tags = tags;

      const updatedFile = await this.fileService.updateFile(fileId, updateData);

      res.status(200).json({
        success: true,
        message: "Gallery image metadata updated successfully",
        data: updatedFile,
      });
    } catch (error) {
      handleError(res, error, "Failed to update gallery image metadata");
    }
  };

  /**
   * Archive a single gallery image
   */
  archive = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { providerId, fileId } = req.params;

      if (!validateObjectId(providerId) || !validateObjectId(fileId)) {
        res.status(400).json({ success: false, message: "Invalid ID" });
        return;
      }

      const file = await this.fileService.getFileById(fileId);

      if (!file || file.label !== "provider_gallery") {
        res.status(404).json({
          success: false,
          message: "Gallery image not found",
        });
        return;
      }

      await this.unlinkGalleryImage(providerId, file._id);
      const archivedFile = await this.fileService.archiveFile(file._id);

      res.status(200).json({
        success: true,
        message: "Gallery image archived successfully",
        data: archivedFile,
      });
    } catch (error) {
      handleError(res, error, "Failed to archive gallery image");
    }
  };

  /**
   * Restore an archived gallery image
   */
  restore = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { providerId, fileId } = req.params;

      if (!validateObjectId(providerId) || !validateObjectId(fileId)) {
        res.status(400).json({ success: false, message: "Invalid ID" });
        return;
      }

      const file = await this.fileService.getFileById(fileId);

      if (!file || file.label !== "provider_gallery") {
        res.status(404).json({
          success: false,
          message: "File not found or not a gallery image",
        });
        return;
      }

      const restoredFile = await this.fileService.restoreFile(fileId);
      const linkResult = await this.linkGalleryImages(providerId, [
        restoredFile?._id!,
      ]);

      res.status(200).json({
        success: true,
        message: "Gallery image restored successfully",
        data: {
          ...restoredFile,
          linkedToProvider: linkResult.linked,
          providerExists: linkResult.exists,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to restore gallery image");
    }
  };

  /**
   * Permanently delete a gallery image
   */
  delete = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { providerId, fileId } = req.params;

      if (!validateObjectId(providerId) || !validateObjectId(fileId)) {
        res.status(400).json({ success: false, message: "Invalid ID" });
        return;
      }

      const file = await this.fileService.getFileById(fileId);

      if (!file || file.label !== "provider_gallery") {
        res.status(404).json({
          success: false,
          message: "Gallery image not found",
        });
        return;
      }

      await this.unlinkGalleryImage(providerId, file._id);
      const deleted = await this.fileService.deleteFile(file._id);

      if (!deleted) {
        res.status(500).json({
          success: false,
          message: "Failed to delete gallery image",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Gallery image deleted permanently",
      });
    } catch (error) {
      handleError(res, error, "Failed to delete gallery image");
    }
  };

  /**
   * Get statistics for provider gallery images
   */
  getStats = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { providerId } = req.params;

      if (!validateObjectId(providerId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid provider ID" });
        return;
      }

      const [activeFiles, archivedFiles] = await Promise.all([
        this.fileService.getFilesByEntity("provider", providerId, {
          status: "active",
        }),
        this.fileService.getFilesByEntity("provider", providerId, {
          status: "archived",
        }),
      ]);

      const activeGalleryImages = activeFiles.filter(
        (f) => f.label === "provider_gallery"
      );
      const archivedGalleryImages = archivedFiles.filter(
        (f) => f.label === "provider_gallery"
      );

      const totalSize = [
        ...activeGalleryImages,
        ...archivedGalleryImages,
      ].reduce((sum, file) => sum + (file.fileSize || 0), 0);

      res.status(200).json({
        success: true,
        data: {
          totalGalleryImages:
            activeGalleryImages.length + archivedGalleryImages.length,
          activeCount: activeGalleryImages.length,
          archivedCount: archivedGalleryImages.length,
          totalStorageUsed: totalSize,
          totalStorageUsedMB: (totalSize / (1024 * 1024)).toFixed(2),
          activeImages: activeGalleryImages.map((f) => ({
            fileId: f._id,
            url: f.url,
            thumbnailUrl: f.thumbnailUrl,
            fileName: f.fileName,
            fileSize: f.fileSize,
            uploadedAt: f.uploadedAt,
          })),
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to get gallery images statistics");
    }
  };

  /**
   * Cleanup old archived gallery images
   */
  cleanupArchived = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { providerId } = req.params;
      const { daysOld = "30" } = req.query;

      if (!validateObjectId(providerId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid provider ID" });
        return;
      }

      const archivedFiles = await this.fileService.getFilesByEntity(
        "provider",
        providerId,
        {
          status: "archived",
        }
      );

      const archivedGalleryImages = archivedFiles.filter(
        (f) => f.label === "provider_gallery"
      );

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(daysOld as string));

      const oldGalleryImages = archivedGalleryImages.filter((file) => {
        const archivedAt = file.uploadedAt;
        return archivedAt && new Date(archivedAt) < cutoffDate;
      });

      const fileIds = oldGalleryImages.map((f) => f._id);
      const deletedCount = await this.fileService.bulkDeleteFiles(fileIds);

      res.status(200).json({
        success: true,
        message: `${deletedCount} old gallery image(s) cleaned up successfully`,
        deletedCount,
      });
    } catch (error) {
      handleError(res, error, "Failed to cleanup archived gallery images");
    }
  };
}
