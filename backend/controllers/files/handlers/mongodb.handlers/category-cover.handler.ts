// controllers/files/handlers/category-cover.handlers.ts
import { Response } from "express";
import { Types } from "mongoose";
import { MongoDBFileService } from "../../../../services/files/mongodb.files.service";
import { CategoryModel } from "../../../../models/category.model";
import {
  handleError,
  validateObjectId,
  AuthenticatedRequest,
} from "../../../../utils/controller-utils/controller.utils";

export class CategoryCoverHandlers {
  constructor(private fileService: MongoDBFileService) {}

  private async getActiveCategoryCover(categoryId: string) {
    const files = await this.fileService.getFilesByEntity(
      "category",
      categoryId,
      {
        status: "active",
      }
    );
    return files.find((f) => f.label === "category_cover");
  }

  private async unlinkCategoryCover(
    categoryId: string,
    fileId: Types.ObjectId,
    userId: string
  ) {
    await CategoryModel.updateOne(
      {
        _id: new Types.ObjectId(categoryId),
        catCoverId: fileId,
        isDeleted: false,
      },
      {
        $unset: { catCoverId: 1 },
        lastModifiedBy: new Types.ObjectId(userId),
      }
    );
  }

  private async linkCategoryCover(
    categoryId: string,
    fileId: Types.ObjectId,
    userId: string
  ) {
    const category = await CategoryModel.findOne({
      _id: new Types.ObjectId(categoryId),
      isDeleted: false,
    });

    if (!category) return { linked: false, exists: false };

    try {
      await CategoryModel.findByIdAndUpdate(
        category._id,
        {
          catCoverId: fileId,
          lastModifiedBy: new Types.ObjectId(userId),
        },
        { new: true }
      );
      return { linked: true, exists: true };
    } catch (error) {
      console.warn("Failed to link category cover:", error);
      return { linked: false, exists: true };
    }
  }

  getRecord = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { categoryId } = req.params;
      if (!validateObjectId(categoryId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid category ID" });
        return;
      }

      const file = await this.getActiveCategoryCover(categoryId);
      if (!file) {
        res
          .status(404)
          .json({ success: false, message: "Category cover image not found" });
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
      handleError(res, error, "Failed to get category cover image record");
    }
  };

  getHistory = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { categoryId } = req.params;
      const { limit = "10", skip = "0" } = req.query;

      if (!validateObjectId(categoryId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid category ID" });
        return;
      }

      const [activeFiles, archivedFiles] = await Promise.all([
        this.fileService.getFilesByEntity("category", categoryId, {
          status: "active",
          limit: 1,
        }),
        this.fileService.getFilesByEntity("category", categoryId, {
          status: "archived",
          limit: parseInt(limit as string),
          skip: parseInt(skip as string),
          sort: { archivedAt: -1 },
        }),
      ]);

      const current = activeFiles.find((f) => f.label === "category_cover");
      const history = archivedFiles.filter((f) => f.label === "category_cover");

      res.status(200).json({
        success: true,
        data: {
          current: current || null,
          history,
          totalArchived: history.length,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to get category cover history");
    }
  };

  updateMetadata = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { categoryId } = req.params;
      const { description, tags } = req.body;
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

      const file = await this.getActiveCategoryCover(categoryId);
      if (!file) {
        res
          .status(404)
          .json({ success: false, message: "Category cover image not found" });
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
        message: "Category cover metadata updated successfully",
        data: updatedFile,
      });
    } catch (error) {
      handleError(res, error, "Failed to update category cover metadata");
    }
  };

  archive = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      const file = await this.getActiveCategoryCover(categoryId);
      if (!file) {
        res
          .status(404)
          .json({ success: false, message: "Category cover image not found" });
        return;
      }

      await this.unlinkCategoryCover(categoryId, file._id, userId);
      const archivedFile = await this.fileService.archiveFile(file._id);

      res.status(200).json({
        success: true,
        message: "Category cover image archived successfully",
        data: archivedFile,
      });
    } catch (error) {
      handleError(res, error, "Failed to archive category cover image");
    }
  };

  restore = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { categoryId, fileId } = req.params;
      const userId = req.userId;

      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      if (!validateObjectId(categoryId) || !validateObjectId(fileId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid category ID or file ID" });
        return;
      }

      const file = await this.fileService.getFileById(fileId);
      if (!file) {
        res.status(404).json({ success: false, message: "File not found" });
        return;
      }

      if (file.label !== "category_cover") {
        res.status(400).json({
          success: false,
          message: "This file is not a category cover image",
        });
        return;
      }

      if (file.entityId?.toString() !== categoryId) {
        res.status(400).json({
          success: false,
          message: "This file does not belong to the specified category",
        });
        return;
      }

      // Archive current if exists
      const currentFile = await this.getActiveCategoryCover(categoryId);
      if (currentFile) {
        await this.unlinkCategoryCover(categoryId, currentFile._id, userId);
        await this.fileService.archiveFile(currentFile._id);
      }

      const restoredFile = await this.fileService.restoreFile(fileId);
      const linkResult = await this.linkCategoryCover(
        categoryId,
        restoredFile?._id!,
        userId
      );

      res.status(200).json({
        success: true,
        message: "Category cover image restored successfully",
        data: {
          ...restoredFile,
          linkedToCategory: linkResult.linked,
          categoryExists: linkResult.exists,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to restore category cover image");
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

      const file = await this.getActiveCategoryCover(categoryId);
      if (!file) {
        res
          .status(404)
          .json({ success: false, message: "Category cover image not found" });
        return;
      }

      await this.unlinkCategoryCover(categoryId, file._id, userId);
      const deleted = await this.fileService.deleteFile(file._id);

      if (!deleted) {
        res.status(500).json({
          success: false,
          message: "Failed to delete category cover image",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Category cover image deleted permanently",
      });
    } catch (error) {
      handleError(res, error, "Failed to delete category cover image");
    }
  };

  getStats = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { categoryId } = req.params;

      if (!validateObjectId(categoryId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid category ID" });
        return;
      }

      const [activeFiles, archivedFiles] = await Promise.all([
        this.fileService.getFilesByEntity("category", categoryId, {
          status: "active",
        }),
        this.fileService.getFilesByEntity("category", categoryId, {
          status: "archived",
        }),
      ]);

      const activeCovers = activeFiles.filter(
        (f) => f.label === "category_cover"
      );
      const archivedCovers = archivedFiles.filter(
        (f) => f.label === "category_cover"
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
      handleError(res, error, "Failed to get category cover statistics");
    }
  };

  cleanupArchived = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { categoryId } = req.params;
      const { daysOld = "30" } = req.query;
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

      const archivedFiles = await this.fileService.getFilesByEntity(
        "category",
        categoryId,
        { status: "archived" }
      );

      const archivedCovers = archivedFiles.filter(
        (f) => f.label === "category_cover"
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
        message: `${deletedCount} old category cover(s) cleaned up successfully`,
        deletedCount,
      });
    } catch (error) {
      handleError(res, error, "Failed to cleanup archived category covers");
    }
  };
}
