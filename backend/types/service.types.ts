// types/service.types.ts
import { Types, Model, HydratedDocument } from "mongoose";
import { BaseEntity, SoftDeletable } from "./base.types";

export interface Service extends BaseEntity, SoftDeletable {
  // Core service details (common)
  title: string;
  description: string;
  slug: string;
  tags: string[];
  categoryId: Types.ObjectId;
  coverImage?: Types.ObjectId;

  // Provider-specific fields (optional for system services)
  providerId?: Types.ObjectId;

  // Pricing and availability
  servicePricing?: {
    serviceBasePrice: number;
    includeTravelFee: boolean; // e.g., for services that require travel
    includeAdditionalFees: boolean; // e.g., materials, equipment, etc.
    currency: string; // 'GHS' or 'USD'
    platformCommissionRate: number; // e.g., 0.20 for 20%
    providerEarnings: number; // auto-calculated
  };

  isPrivate: boolean;

  // Moderation fields
  submittedBy?: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  isActive?: boolean;
}

// Instance methods interface
export interface ServiceMethods {
  softDelete(): Promise<this>;
  restore(): Promise<this>;
  approve(approverId: string): Promise<this>;
  reject(approverId: string, reason: string): Promise<this>;
}

// Virtuals interface
export interface ServiceVirtuals {
  isApproved: boolean;
  isRejected: boolean;
  isPending: boolean;
}

// Static methods interface
export interface ServiceModel
  extends Model<Service, {}, ServiceMethods, ServiceVirtuals> {
  findActive(): Promise<ServiceDocument[]>;
  findByCategory(categoryId: string): Promise<ServiceDocument[]>;
  findByProvider(providerId: string): Promise<ServiceDocument[]>;
  searchServices(
    searchTerm: string,
    filters?: {
      categoryId?: string;
      providerId?: string;
      minPrice?: number;
      maxPrice?: number;
    }
  ): Promise<ServiceDocument[]>;
}

// Complete document type with methods and virtuals
export type ServiceDocument = HydratedDocument<
  Service,
  ServiceMethods & ServiceVirtuals
>;

