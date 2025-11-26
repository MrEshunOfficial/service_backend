// controllers/files/handlers/profile-picture.handlers.ts
import { Response } from "express";
import { Types } from "mongoose";
import { MongoDBFileService } from "../../../../services/files/mongodb.files.service";
import { ProfileModel } from "../../../../models/profiles/userProfile.model";
import {
  handleError,
  validateObjectId,
  AuthenticatedRequest,
} from "../../../../utils/controller-utils/controller.utils";

export class ProfilePictureHandlers {
  constructor(private fileService: MongoDBFileService) {}

  private async getActiveProfilePicture(userId: string) {
    const files = await this.fileService.getFilesByEntity("user", userId, {
      status: "active",
    });
    return files.find((f) => f.label === "profile_picture");
  }

  private async unlinkProfilePicture(userId: string, fileId: Types.ObjectId) {
    await ProfileModel.updateOne(
      {
        userId: new Types.ObjectId(userId),
        profilePictureId: fileId,
        isDeleted: false,
      },
      {
        $unset: { profilePictureId: 1 },
        lastModified: new Date(),
      }
    );
  }

  private async linkProfilePicture(userId: string, fileId: Types.ObjectId) {
    const profile = await ProfileModel.findOne({
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!profile) return { linked: false, exists: false };

    try {
      await ProfileModel.findByIdAndUpdate(
        profile._id,
        {
          profilePictureId: fileId,
          lastModified: new Date(),
        },
        { new: true }
      );
      return { linked: true, exists: true };
    } catch (error) {
      console.warn("Failed to link profile picture:", error);
      return { linked: false, exists: true };
    }
  }

  getRecord = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      const file = await this.getActiveProfilePicture(userId);
      if (!file) {
        res
          .status(404)
          .json({ success: false, message: "Profile picture not found" });
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
      handleError(res, error, "Failed to get profile picture record");
    }
  };

  getUserRecord = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { userId } = req.params;
      if (!validateObjectId(userId)) {
        res.status(400).json({ success: false, message: "Invalid user ID" });
        return;
      }

      const file = await this.getActiveProfilePicture(userId);
      if (!file) {
        res
          .status(404)
          .json({ success: false, message: "Profile picture not found" });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          fileId: file._id,
          url: file.url,
          thumbnailUrl: file.thumbnailUrl,
          uploadedAt: file.uploadedAt,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to get profile picture record");
    }
  };

  getHistory = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      const { limit = "10", skip = "0" } = req.query;

      const [activeFiles, archivedFiles] = await Promise.all([
        this.fileService.getFilesByEntity("user", userId, {
          status: "active",
          limit: 1,
        }),
        this.fileService.getFilesByEntity("user", userId, {
          status: "archived",
          limit: parseInt(limit as string),
          skip: parseInt(skip as string),
          sort: { archivedAt: -1 },
        }),
      ]);

      const current = activeFiles.find((f) => f.label === "profile_picture");
      const history = archivedFiles.filter(
        (f) => f.label === "profile_picture"
      );

      res.status(200).json({
        success: true,
        data: {
          current: current || null,
          history,
          totalArchived: history.length,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to get profile picture history");
    }
  };

  updateMetadata = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      const { description, tags } = req.body;
      const file = await this.getActiveProfilePicture(userId);

      if (!file) {
        res
          .status(404)
          .json({ success: false, message: "Profile picture not found" });
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
        message: "Profile picture metadata updated successfully",
        data: updatedFile,
      });
    } catch (error) {
      handleError(res, error, "Failed to update profile picture metadata");
    }
  };

  archive = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      const file = await this.getActiveProfilePicture(userId);
      if (!file) {
        res
          .status(404)
          .json({ success: false, message: "Profile picture not found" });
        return;
      }

      await this.unlinkProfilePicture(userId, file._id);
      const archivedFile = await this.fileService.archiveFile(file._id);

      res.status(200).json({
        success: true,
        message: "Profile picture archived successfully",
        data: archivedFile,
      });
    } catch (error) {
      handleError(res, error, "Failed to archive profile picture");
    }
  };

  restore = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      const { fileId } = req.params;

      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      if (!validateObjectId(fileId)) {
        res.status(400).json({ success: false, message: "Invalid file ID" });
        return;
      }

      const file = await this.fileService.getFileById(fileId);
      if (!file) {
        res.status(404).json({ success: false, message: "File not found" });
        return;
      }

      if (file.uploaderId?.toString() !== userId) {
        res.status(403).json({
          success: false,
          message: "You don't have permission to restore this file",
        });
        return;
      }

      if (file.label !== "profile_picture") {
        res.status(400).json({
          success: false,
          message: "This file is not a profile picture",
        });
        return;
      }

      // Archive current if exists
      const currentFile = await this.getActiveProfilePicture(userId);
      if (currentFile) {
        await this.unlinkProfilePicture(userId, currentFile._id);
        await this.fileService.archiveFile(currentFile._id);
      }

      const restoredFile = await this.fileService.restoreFile(fileId);
      const linkResult = await this.linkProfilePicture(
        userId,
        restoredFile?._id!
      );

      res.status(200).json({
        success: true,
        message: "Profile picture restored successfully",
        data: {
          ...restoredFile,
          linkedToProfile: linkResult.linked,
          profileExists: linkResult.exists,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to restore profile picture");
    }
  };

  delete = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      const file = await this.getActiveProfilePicture(userId);
      if (!file) {
        res
          .status(404)
          .json({ success: false, message: "Profile picture not found" });
        return;
      }

      await this.unlinkProfilePicture(userId, file._id);
      const deleted = await this.fileService.deleteFile(file._id);

      if (!deleted) {
        res.status(500).json({
          success: false,
          message: "Failed to delete profile picture",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Profile picture deleted permanently",
      });
    } catch (error) {
      handleError(res, error, "Failed to delete profile picture");
    }
  };

  getStats = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      const [activeFiles, archivedFiles] = await Promise.all([
        this.fileService.getFilesByEntity("user", userId, { status: "active" }),
        this.fileService.getFilesByEntity("user", userId, {
          status: "archived",
        }),
      ]);

      const activeProfilePics = activeFiles.filter(
        (f) => f.label === "profile_picture"
      );
      const archivedProfilePics = archivedFiles.filter(
        (f) => f.label === "profile_picture"
      );

      const totalSize = [...activeProfilePics, ...archivedProfilePics].reduce(
        (sum, file) => sum + (file.fileSize || 0),
        0
      );

      const current = activeProfilePics[0] || null;

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
          totalProfilePictures:
            activeProfilePics.length + archivedProfilePics.length,
          activeCount: activeProfilePics.length,
          archivedCount: archivedProfilePics.length,
          totalStorageUsed: totalSize,
          totalStorageUsedMB: (totalSize / (1024 * 1024)).toFixed(2),
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to get profile picture statistics");
    }
  };

  cleanupArchived = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
        return;
      }

      const { daysOld = "30" } = req.query;

      const archivedFiles = await this.fileService.getFilesByEntity(
        "user",
        userId,
        {
          status: "archived",
        }
      );

      const archivedProfilePics = archivedFiles.filter(
        (f) => f.label === "profile_picture"
      );

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(daysOld as string));

      const oldProfilePics = archivedProfilePics.filter((file) => {
        const archivedAt = file.uploadedAt;
        return archivedAt && new Date(archivedAt) < cutoffDate;
      });

      const fileIds = oldProfilePics.map((f) => f._id);
      const deletedCount = await this.fileService.bulkDeleteFiles(fileIds);

      res.status(200).json({
        success: true,
        message: `${deletedCount} old profile picture(s) cleaned up successfully`,
        deletedCount,
      });
    } catch (error) {
      handleError(res, error, "Failed to cleanup archived profile pictures");
    }
  };
}
