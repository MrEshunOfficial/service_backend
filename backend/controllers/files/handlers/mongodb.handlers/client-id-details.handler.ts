// controllers/files/handlers/mongodb-client-id-details.handler.ts
import { Response } from "express";
import { Types } from "mongoose";
import { ClientModel } from "../../../../models/profiles/clientProfileModel";
import { MongoDBFileService } from "../../../../services/files/mongodb.files.service";
import { AuthenticatedRequest } from "../../../../types/user.types";
import {
  validateObjectId,
  handleError,
} from "../../../../utils/controller-utils/controller.utils";

/**
 * Client ID Images Handler
 * Manages identification documents for client profiles
 */
export class ClientIdImagesHandlers {
  constructor(private fileService: MongoDBFileService) {}

  private async getActiveIdImages(clientId: string) {
    const files = await this.fileService.getFilesByEntity("client", clientId, {
      status: "active",
    });
    return files.filter((f) => f.label === "client_id_image");
  }

  private async unlinkIdImage(clientId: string, fileId: Types.ObjectId) {
    const client = await ClientModel.findOne({
      _id: new Types.ObjectId(clientId),
      isDeleted: false,
    });

    if (!client || !client.idDetails) return;

    client.idDetails.fileImage = client.idDetails.fileImage.filter(
      (id) => id.toString() !== fileId.toString()
    );

    await client.save();
  }

  private async linkIdImages(
    clientId: string,
    fileIds: Types.ObjectId[]
  ): Promise<{ linked: boolean; exists: boolean }> {
    const client = await ClientModel.findOne({
      _id: new Types.ObjectId(clientId),
      isDeleted: false,
    });

    if (!client) return { linked: false, exists: false };

    try {
      if (!client.idDetails) {
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
   * Get all active ID images for a client
   */
  getRecords = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { clientId } = req.params;

      if (!validateObjectId(clientId)) {
        res.status(400).json({ success: false, message: "Invalid client ID" });
        return;
      }

      const files = await this.getActiveIdImages(clientId);

      if (files.length === 0) {
        res.status(404).json({
          success: false,
          message: "No ID images found for this client",
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
      const { clientId, fileId } = req.params;

      if (!validateObjectId(clientId) || !validateObjectId(fileId)) {
        res.status(400).json({ success: false, message: "Invalid ID" });
        return;
      }

      const file = await this.fileService.getFileById(fileId);

      if (!file || file.label !== "client_id_image") {
        res.status(404).json({
          success: false,
          message: "ID image not found",
        });
        return;
      }

      if (file.entityId?.toString() !== clientId) {
        res.status(403).json({
          success: false,
          message: "ID image does not belong to this client",
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
      const { clientId } = req.params;
      const { limit = "10", skip = "0" } = req.query;

      if (!validateObjectId(clientId)) {
        res.status(400).json({ success: false, message: "Invalid client ID" });
        return;
      }

      const [activeFiles, archivedFiles] = await Promise.all([
        this.fileService.getFilesByEntity("client", clientId, {
          status: "active",
        }),
        this.fileService.getFilesByEntity("client", clientId, {
          status: "archived",
          limit: parseInt(limit as string),
          skip: parseInt(skip as string),
          sort: { archivedAt: -1 },
        }),
      ]);

      const activeIdImages = activeFiles.filter(
        (f) => f.label === "client_id_image"
      );
      const archivedIdImages = archivedFiles.filter(
        (f) => f.label === "client_id_image"
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
      const { clientId, fileId } = req.params;
      const { description, tags } = req.body;

      if (!validateObjectId(clientId) || !validateObjectId(fileId)) {
        res.status(400).json({ success: false, message: "Invalid ID" });
        return;
      }

      const file = await this.fileService.getFileById(fileId);

      if (!file || file.label !== "client_id_image") {
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
      const { clientId, fileId } = req.params;

      if (!validateObjectId(clientId) || !validateObjectId(fileId)) {
        res.status(400).json({ success: false, message: "Invalid ID" });
        return;
      }

      const file = await this.fileService.getFileById(fileId);

      if (!file || file.label !== "client_id_image") {
        res.status(404).json({
          success: false,
          message: "ID image not found",
        });
        return;
      }

      await this.unlinkIdImage(clientId, file._id);
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
      const { clientId, fileId } = req.params;

      if (!validateObjectId(clientId) || !validateObjectId(fileId)) {
        res.status(400).json({ success: false, message: "Invalid ID" });
        return;
      }

      const file = await this.fileService.getFileById(fileId);

      if (!file || file.label !== "client_id_image") {
        res.status(404).json({
          success: false,
          message: "File not found or not an ID image",
        });
        return;
      }

      const restoredFile = await this.fileService.restoreFile(fileId);
      const linkResult = await this.linkIdImages(clientId, [
        restoredFile?._id!,
      ]);

      res.status(200).json({
        success: true,
        message: "ID image restored successfully",
        data: {
          ...restoredFile,
          linkedToClient: linkResult.linked,
          clientExists: linkResult.exists,
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
      const { clientId, fileId } = req.params;

      if (!validateObjectId(clientId) || !validateObjectId(fileId)) {
        res.status(400).json({ success: false, message: "Invalid ID" });
        return;
      }

      const file = await this.fileService.getFileById(fileId);

      if (!file || file.label !== "client_id_image") {
        res.status(404).json({
          success: false,
          message: "ID image not found",
        });
        return;
      }

      await this.unlinkIdImage(clientId, file._id);
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
   * Get statistics for client ID images
   */
  getStats = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { clientId } = req.params;

      if (!validateObjectId(clientId)) {
        res.status(400).json({ success: false, message: "Invalid client ID" });
        return;
      }

      const [activeFiles, archivedFiles] = await Promise.all([
        this.fileService.getFilesByEntity("client", clientId, {
          status: "active",
        }),
        this.fileService.getFilesByEntity("client", clientId, {
          status: "archived",
        }),
      ]);

      const activeIdImages = activeFiles.filter(
        (f) => f.label === "client_id_image"
      );
      const archivedIdImages = archivedFiles.filter(
        (f) => f.label === "client_id_image"
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

  /**
   * Cleanup old archived ID images
   */
  cleanupArchived = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { clientId } = req.params;
      const { daysOld = "90" } = req.query; // Default 90 days for ID documents

      if (!validateObjectId(clientId)) {
        res.status(400).json({ success: false, message: "Invalid client ID" });
        return;
      }

      const archivedFiles = await this.fileService.getFilesByEntity(
        "client",
        clientId,
        {
          status: "archived",
        }
      );

      const archivedIdImages = archivedFiles.filter(
        (f) => f.label === "client_id_image"
      );

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(daysOld as string));

      const oldIdImages = archivedIdImages.filter((file) => {
        const archivedAt = file.uploadedAt;
        return archivedAt && new Date(archivedAt) < cutoffDate;
      });

      const fileIds = oldIdImages.map((f) => f._id);
      const deletedCount = await this.fileService.bulkDeleteFiles(fileIds);

      res.status(200).json({
        success: true,
        message: `${deletedCount} old ID image(s) cleaned up successfully`,
        deletedCount,
      });
    } catch (error) {
      handleError(res, error, "Failed to cleanup archived ID images");
    }
  };

  /**
   * Bulk archive multiple ID images
   */
  bulkArchive = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { clientId } = req.params;
      const { fileIds } = req.body;

      if (!validateObjectId(clientId)) {
        res.status(400).json({ success: false, message: "Invalid client ID" });
        return;
      }

      if (!Array.isArray(fileIds) || fileIds.length === 0) {
        res.status(400).json({
          success: false,
          message: "fileIds must be a non-empty array",
        });
        return;
      }

      // Validate all fileIds
      const invalidIds = fileIds.filter((id) => !validateObjectId(id));
      if (invalidIds.length > 0) {
        res.status(400).json({
          success: false,
          message: "Invalid file IDs provided",
          invalidIds,
        });
        return;
      }

      const results = {
        archived: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (const fileId of fileIds) {
        try {
          const file = await this.fileService.getFileById(fileId);

          if (!file || file.label !== "client_id_image") {
            results.failed++;
            results.errors.push(`File ${fileId} not found or invalid`);
            continue;
          }

          await this.unlinkIdImage(clientId, file._id);
          await this.fileService.archiveFile(file._id);
          results.archived++;
        } catch (error) {
          results.failed++;
          results.errors.push(
            `Failed to archive ${fileId}: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }

      res.status(200).json({
        success: results.archived > 0,
        message: `${results.archived} ID image(s) archived, ${results.failed} failed`,
        data: results,
      });
    } catch (error) {
      handleError(res, error, "Failed to bulk archive ID images");
    }
  };

  /**
   * Bulk restore multiple ID images
   */
  bulkRestore = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { clientId } = req.params;
      const { fileIds } = req.body;

      if (!validateObjectId(clientId)) {
        res.status(400).json({ success: false, message: "Invalid client ID" });
        return;
      }

      if (!Array.isArray(fileIds) || fileIds.length === 0) {
        res.status(400).json({
          success: false,
          message: "fileIds must be a non-empty array",
        });
        return;
      }

      // Validate all fileIds
      const invalidIds = fileIds.filter((id) => !validateObjectId(id));
      if (invalidIds.length > 0) {
        res.status(400).json({
          success: false,
          message: "Invalid file IDs provided",
          invalidIds,
        });
        return;
      }

      const results = {
        restored: 0,
        failed: 0,
        errors: [] as string[],
      };

      const restoredFileIds: Types.ObjectId[] = [];

      for (const fileId of fileIds) {
        try {
          const file = await this.fileService.getFileById(fileId);

          if (!file || file.label !== "client_id_image") {
            results.failed++;
            results.errors.push(`File ${fileId} not found or invalid`);
            continue;
          }

          const restoredFile = await this.fileService.restoreFile(fileId);
          if (restoredFile) {
            restoredFileIds.push(restoredFile._id);
            results.restored++;
          }
        } catch (error) {
          results.failed++;
          results.errors.push(
            `Failed to restore ${fileId}: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }

      // Link all restored files to client
      if (restoredFileIds.length > 0) {
        await this.linkIdImages(clientId, restoredFileIds);
      }

      res.status(200).json({
        success: results.restored > 0,
        message: `${results.restored} ID image(s) restored, ${results.failed} failed`,
        data: results,
      });
    } catch (error) {
      handleError(res, error, "Failed to bulk restore ID images");
    }
  };

  /**
   * Bulk delete multiple ID images permanently
   */
  bulkDelete = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { clientId } = req.params;
      const { fileIds } = req.body;

      if (!validateObjectId(clientId)) {
        res.status(400).json({ success: false, message: "Invalid client ID" });
        return;
      }

      if (!Array.isArray(fileIds) || fileIds.length === 0) {
        res.status(400).json({
          success: false,
          message: "fileIds must be a non-empty array",
        });
        return;
      }

      // Validate all fileIds
      const invalidIds = fileIds.filter((id) => !validateObjectId(id));
      if (invalidIds.length > 0) {
        res.status(400).json({
          success: false,
          message: "Invalid file IDs provided",
          invalidIds,
        });
        return;
      }

      // Verify all files belong to this client and are ID images
      const validFileIds: Types.ObjectId[] = [];
      for (const fileId of fileIds) {
        const file = await this.fileService.getFileById(fileId);
        if (
          file &&
          file.label === "client_id_image" &&
          file.entityId?.toString() === clientId
        ) {
          validFileIds.push(new Types.ObjectId(fileId));
          await this.unlinkIdImage(clientId, file._id);
        }
      }

      const deletedCount = await this.fileService.bulkDeleteFiles(validFileIds);

      res.status(200).json({
        success: deletedCount > 0,
        message: `${deletedCount} ID image(s) deleted permanently`,
        data: {
          deletedCount,
          requestedCount: fileIds.length,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to bulk delete ID images");
    }
  };

  /**
   * Verify ID images are properly linked to client profile
   */
  verifyLinks = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { clientId } = req.params;

      if (!validateObjectId(clientId)) {
        res.status(400).json({ success: false, message: "Invalid client ID" });
        return;
      }

      const client = await ClientModel.findOne({
        _id: new Types.ObjectId(clientId),
        isDeleted: false,
      });

      if (!client) {
        res.status(404).json({
          success: false,
          message: "Client not found",
        });
        return;
      }

      const activeFiles = await this.getActiveIdImages(clientId);
      const linkedFileIds = client.idDetails?.fileImage || [];

      const filesInDb = activeFiles.map((f) => f._id.toString());
      const filesInProfile = linkedFileIds.map((id) => id.toString());

      const orphanedFiles = filesInDb.filter(
        (id) => !filesInProfile.includes(id)
      );
      const missingFiles = filesInProfile.filter(
        (id) => !filesInDb.includes(id)
      );

      res.status(200).json({
        success: true,
        data: {
          totalFilesInDb: filesInDb.length,
          totalFilesInProfile: filesInProfile.length,
          orphanedFiles: orphanedFiles.length,
          missingFiles: missingFiles.length,
          orphanedFileIds: orphanedFiles,
          missingFileIds: missingFiles,
          needsSync: orphanedFiles.length > 0 || missingFiles.length > 0,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to verify ID image links");
    }
  };

  /**
   * Sync ID images between database and client profile
   */
  syncLinks = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { clientId } = req.params;

      if (!validateObjectId(clientId)) {
        res.status(400).json({ success: false, message: "Invalid client ID" });
        return;
      }

      const client = await ClientModel.findOne({
        _id: new Types.ObjectId(clientId),
        isDeleted: false,
      });

      if (!client) {
        res.status(404).json({
          success: false,
          message: "Client not found",
        });
        return;
      }

      const activeFiles = await this.getActiveIdImages(clientId);
      const activeFileIds = activeFiles.map((f) => f._id);

      // Update client profile with current active files
      if (client.idDetails) {
        client.idDetails.fileImage = activeFileIds;
        await client.save();
      }

      res.status(200).json({
        success: true,
        message: "ID images synchronized successfully",
        data: {
          syncedCount: activeFileIds.length,
          fileIds: activeFileIds,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to sync ID image links");
    }
  };
}
