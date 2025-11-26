// controllers/files/handlers/service-cover.handlers.ts
import { Response } from "express";
import { Types } from "mongoose";
import { MongoDBFileService } from "../../../../services/files/mongodb.files.service";
import { ServiceModel } from "../../../../models/service.model";
import {
  handleError,
  validateObjectId,
  AuthenticatedRequest,
} from "../../../../utils/controller-utils/controller.utils";

export class ServiceCoverHandlers {
  constructor(private fileService: MongoDBFileService) {}

  private async getActiveServiceCover(serviceId: string) {
    const files = await this.fileService.getFilesByEntity(
      "service",
      serviceId,
      {
        status: "active",
      }
    );
    return files.find((f) => f.label === "service_cover");
  }

  private async unlinkServiceCover(
    serviceId: string,
    fileId: Types.ObjectId,
    userId: string
  ) {
    await ServiceModel.updateOne(
      {
        _id: new Types.ObjectId(serviceId),
        coverImage: fileId,
        deletedAt: null,
      },
      {
        $unset: { coverImage: 1 },
      }
    );
  }

  private async linkServiceCover(
    serviceId: string,
    fileId: Types.ObjectId,
    userId: string
  ) {
    const service = await ServiceModel.findOne({
      _id: new Types.ObjectId(serviceId),
      deletedAt: null,
    });

    if (!service) return { linked: false, exists: false };

    try {
      await ServiceModel.findByIdAndUpdate(
        service._id,
        {
          coverImage: fileId,
        },
        { new: true }
      );
      return { linked: true, exists: true };
    } catch (error) {
      console.warn("Failed to link service cover:", error);
      return { linked: false, exists: true };
    }
  }

  getRecord = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { serviceId } = req.params;
      if (!validateObjectId(serviceId)) {
        res.status(400).json({ success: false, message: "Invalid service ID" });
        return;
      }

      const file = await this.getActiveServiceCover(serviceId);
      if (!file) {
        res
          .status(404)
          .json({ success: false, message: "Service cover image not found" });
        return;
      }

      await this.fileService.markAsAccessed(file._id);

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
      handleError(res, error, "Failed to get service cover image record");
    }
  };

  getHistory = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { serviceId } = req.params;
      const { limit = "10", skip = "0" } = req.query;

      if (!validateObjectId(serviceId)) {
        res.status(400).json({ success: false, message: "Invalid service ID" });
        return;
      }

      const [activeFiles, archivedFiles] = await Promise.all([
        this.fileService.getFilesByEntity("service", serviceId, {
          status: "active",
          limit: 1,
        }),
        this.fileService.getFilesByEntity("service", serviceId, {
          status: "archived",
          limit: parseInt(limit as string),
          skip: parseInt(skip as string),
          sort: { archivedAt: -1 },
        }),
      ]);

      const current = activeFiles.find((f) => f.label === "service_cover");
      const history = archivedFiles.filter((f) => f.label === "service_cover");

      res.status(200).json({
        success: true,
        data: {
          current: current || null,
          history,
          totalArchived: history.length,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to get service cover history");
    }
  };

  updateMetadata = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { serviceId } = req.params;
      const { description, tags } = req.body;
      const userId = req.userId;

      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      if (!validateObjectId(serviceId)) {
        res.status(400).json({ success: false, message: "Invalid service ID" });
        return;
      }

      const file = await this.getActiveServiceCover(serviceId);
      if (!file) {
        res
          .status(404)
          .json({ success: false, message: "Service cover image not found" });
        return;
      }

      const updateData: any = {};
      if (description !== undefined) updateData.description = description;
      if (tags !== undefined) updateData.tags = tags;

      const updatedFile = await this.fileService.updateFile(
        file._id,
        updateData
      );

      res.status(200).json({
        success: true,
        message: "Service cover metadata updated successfully",
        data: updatedFile,
      });
    } catch (error) {
      handleError(res, error, "Failed to update service cover metadata");
    }
  };

  archive = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { serviceId } = req.params;
      const userId = req.userId;

      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      if (!validateObjectId(serviceId)) {
        res.status(400).json({ success: false, message: "Invalid service ID" });
        return;
      }

      const file = await this.getActiveServiceCover(serviceId);
      if (!file) {
        res
          .status(404)
          .json({ success: false, message: "Service cover image not found" });
        return;
      }

      await this.unlinkServiceCover(serviceId, file._id, userId);
      const archivedFile = await this.fileService.archiveFile(file._id);

      res.status(200).json({
        success: true,
        message: "Service cover image archived successfully",
        data: archivedFile,
      });
    } catch (error) {
      handleError(res, error, "Failed to archive service cover image");
    }
  };

  restore = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { serviceId, fileId } = req.params;
      const userId = req.userId;

      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      if (!validateObjectId(serviceId) || !validateObjectId(fileId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid service ID or file ID" });
        return;
      }

      const file = await this.fileService.getFileById(fileId);
      if (!file) {
        res.status(404).json({ success: false, message: "File not found" });
        return;
      }

      if (file.label !== "service_cover") {
        res.status(400).json({
          success: false,
          message: "This file is not a service cover image",
        });
        return;
      }

      if (file.entityId?.toString() !== serviceId) {
        res.status(400).json({
          success: false,
          message: "This file does not belong to the specified service",
        });
        return;
      }

      // Archive current if exists
      const currentFile = await this.getActiveServiceCover(serviceId);
      if (currentFile) {
        await this.unlinkServiceCover(serviceId, currentFile._id, userId);
        await this.fileService.archiveFile(currentFile._id);
      }

      const restoredFile = await this.fileService.restoreFile(fileId);
      const linkResult = await this.linkServiceCover(
        serviceId,
        restoredFile?._id!,
        userId
      );

      res.status(200).json({
        success: true,
        message: "Service cover image restored successfully",
        data: {
          ...restoredFile,
          linkedToService: linkResult.linked,
          serviceExists: linkResult.exists,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to restore service cover image");
    }
  };

  delete = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { serviceId } = req.params;
      const userId = req.userId;

      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      if (!validateObjectId(serviceId)) {
        res.status(400).json({ success: false, message: "Invalid service ID" });
        return;
      }

      const file = await this.getActiveServiceCover(serviceId);
      if (!file) {
        res
          .status(404)
          .json({ success: false, message: "Service cover image not found" });
        return;
      }

      await this.unlinkServiceCover(serviceId, file._id, userId);
      const deleted = await this.fileService.deleteFile(file._id);

      if (!deleted) {
        res.status(500).json({
          success: false,
          message: "Failed to delete service cover image",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Service cover image deleted permanently",
      });
    } catch (error) {
      handleError(res, error, "Failed to delete service cover image");
    }
  };

  getStats = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { serviceId } = req.params;

      if (!validateObjectId(serviceId)) {
        res.status(400).json({ success: false, message: "Invalid service ID" });
        return;
      }

      const [activeFiles, archivedFiles] = await Promise.all([
        this.fileService.getFilesByEntity("service", serviceId, {
          status: "active",
        }),
        this.fileService.getFilesByEntity("service", serviceId, {
          status: "archived",
        }),
      ]);

      const activeCovers = activeFiles.filter(
        (f) => f.label === "service_cover"
      );
      const archivedCovers = archivedFiles.filter(
        (f) => f.label === "service_cover"
      );

      const totalSize = [...activeCovers, ...archivedCovers].reduce(
        (sum, file) => sum + (file.fileSize || 0),
        0
      );

      const current = activeCovers[0] || null;

      res.status(200).json({
        success: true,
        data: {
          current: current
            ? {
                fileId: current._id,
                url: current.url,
                thumbnailUrl: current.thumbnailUrl,
                fileSize: current.fileSize,
                uploadedAt: current.uploadedAt,
              }
            : null,
          totalCoverImages: activeCovers.length + archivedCovers.length,
          activeCount: activeCovers.length,
          archivedCount: archivedCovers.length,
          totalStorageUsed: totalSize,
          totalStorageUsedMB: (totalSize / (1024 * 1024)).toFixed(2),
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to get service cover statistics");
    }
  };

  cleanupArchived = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { serviceId } = req.params;
      const { daysOld = "30" } = req.query;
      const userId = req.userId;

      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      if (!validateObjectId(serviceId)) {
        res.status(400).json({ success: false, message: "Invalid service ID" });
        return;
      }

      const archivedFiles = await this.fileService.getFilesByEntity(
        "service",
        serviceId,
        { status: "archived" }
      );

      const archivedCovers = archivedFiles.filter(
        (f) => f.label === "service_cover"
      );

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(daysOld as string));

      const oldCovers = archivedCovers.filter((file) => {
        const archivedAt = file.uploadedAt;
        return archivedAt && new Date(archivedAt) < cutoffDate;
      });

      const fileIds = oldCovers.map((f) => f._id);
      const deletedCount = await this.fileService.bulkDeleteFiles(fileIds);

      res.status(200).json({
        success: true,
        message: `${deletedCount} old service cover(s) cleaned up successfully`,
        deletedCount,
      });
    } catch (error) {
      handleError(res, error, "Failed to cleanup archived service covers");
    }
  };
}
