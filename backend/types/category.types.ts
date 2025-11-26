// types/category.types.ts
import { Types, HydratedDocument } from "mongoose";
import { BaseEntity, SoftDeletable } from "./base.types";
import { Service } from "./service.types";

export interface Category extends BaseEntity, SoftDeletable {
  catName: string;
  catDesc: string;
  catCoverId?: Types.ObjectId;
  tags?: string[];
  isActive: boolean;
  parentCategoryId?: Types.ObjectId;
  slug: string;
  createdBy?: Types.ObjectId;
  lastModifiedBy?: Types.ObjectId;
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
}

// Extended structure with population data
export interface CategoryWithServices extends Category {
  services?: Service[];
  servicesCount?: number;
  popularServices?: Service[];
  subcategories?: CategoryWithServices[];
}

// Document type (preferred Mongoose v7+)
export type CategoryDocument = HydratedDocument<
  Category,
  {
    softDelete(deletedBy?: Types.ObjectId): Promise<CategoryDocument>;
    restore(): Promise<CategoryDocument>;
    subcategories?: Category[];
    services?: Service[];
  }
>;

// For .toObject() outputs that include virtuals
export interface CategoryObject extends Category {
  _id: Types.ObjectId;
  subcategories?: CategoryObject[];
  services?: any[];
}
