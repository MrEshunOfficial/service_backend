import { Types } from "mongoose";

/**
 * File document interface with instance methods
 */
export interface File {
  _id: Types.ObjectId;
  uploaderId?: Types.ObjectId;

  extension?: string;
  thumbnailUrl?: string;
  url: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  storageProvider: "local" | "s3" | "cloudinary" | "gcs" | "mega";

  // Additional fields
  metadata?: Record<string, any>;
  tags?: string[];
  description?: string;

  // Entity linking fields
  entityType?: string;
  entityId?: Types.ObjectId;
  label?: string;

  // File status
  status: "active" | "archived";

  // Access tracking
  lastAccessedAt?: Date;

  // Timestamps
  uploadedAt: Date;
  deletedAt?: Date;
}
