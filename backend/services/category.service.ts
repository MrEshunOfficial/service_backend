// services/category.service.ts
import { Types } from "mongoose";
import { CategoryModel } from "../models/category.model";
import { MongoDBFileService } from "./files/mongodb.files.service";
import {
  Category,
  CategoryDocument,
  CategoryObject,
} from "../types/category.types";
import { ImageLinkingService } from "../utils/controller-utils/ImageLinkingService";

export class CategoryService {
  private fileService: MongoDBFileService;
  private imageLinkingService: ImageLinkingService;

  constructor() {
    this.fileService = new MongoDBFileService();
    this.imageLinkingService = new ImageLinkingService();
  }

  /**
   * Create a new category
   * Automatically links any orphaned cover image uploaded before category creation
   */
  async createCategory(
    categoryData: Partial<Category>,
    createdBy?: string
  ): Promise<Category> {
    try {
      const { catName, slug, parentCategoryId } = categoryData;

      if (!catName?.trim()) {
        throw new Error("Category name is required");
      }

      const trimmedName = catName.trim();

      // 1. Check for duplicate NAME (including soft-deleted ones)
      const existingByName = await CategoryModel.findOne({
        catName: {
          $regex: `^${this.escapeRegex(trimmedName)}$`,
          $options: "i",
        },
      });

      if (existingByName) {
        if (existingByName.isDeleted) {
          throw new Error(
            `A deleted category with the name "${trimmedName}" exists. Please restore it or choose a different name.`
          );
        } else {
          throw new Error(
            `A category with the name "${trimmedName}" already exists. Please choose a different name.`
          );
        }
      }

      // 2. Check for duplicate SLUG (if provided)
      if (slug) {
        const trimmedSlug = slug.trim();
        const existingBySlug = await CategoryModel.findOne({
          slug: trimmedSlug,
        });

        if (existingBySlug) {
          if (existingBySlug.isDeleted) {
            throw new Error(
              `A deleted category with slug "${trimmedSlug}" exists. Please choose a different slug.`
            );
          } else {
            throw new Error(
              `Category with slug "${trimmedSlug}" already exists`
            );
          }
        }
      }

      // 3. Validate parent category if provided
      if (parentCategoryId) {
        const parentCategory = await CategoryModel.findOne({
          _id: parentCategoryId,
          isDeleted: false,
          isActive: true,
        });

        if (!parentCategory) {
          throw new Error("Parent category not found or inactive");
        }
      }

      // 4. Create the category
      const category = await CategoryModel.create({
        ...categoryData,
        catName: trimmedName,
        slug: slug?.trim(),
        createdBy: createdBy ? new Types.ObjectId(createdBy) : undefined,
        lastModifiedBy: createdBy ? new Types.ObjectId(createdBy) : undefined,
      });

      // 5. Link orphaned cover image
      const linkResult = await this.imageLinkingService.linkOrphanedImage(
        "category",
        category._id.toString(),
        "category_cover",
        "catCoverId",
        createdBy
      );

      if (linkResult.linked) {
        const updatedCategory = await CategoryModel.findById(category._id);
        return updatedCategory as Category;
      }

      return category as Category;
    } catch (error) {
      // Handle MongoDB duplicate key error
      if ((error as any).code === 11000) {
        const field = Object.keys((error as any).keyPattern || {})[0];
        if (field === "catName") {
          throw new Error(
            "A category with this name already exists. Please choose a different name."
          );
        } else if (field === "slug") {
          throw new Error("Category with this slug already exists");
        }
        throw new Error("Duplicate entry detected");
      }

      throw error instanceof Error
        ? error
        : new Error("Failed to create category");
    }
  }

  // Helper method to escape special regex characters
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Get category by ID
   */
  async getCategoryById(
    categoryId: string,
    includeDetails: boolean = false
  ): Promise<Category | null> {
    try {
      if (!Types.ObjectId.isValid(categoryId)) {
        throw new Error("Invalid category ID");
      }

      const query = CategoryModel.findOne({
        _id: new Types.ObjectId(categoryId),
        isDeleted: false,
      });

      if (includeDetails) {
        query
          .populate("parentCategoryId", "catName slug")
          .populate("catCoverId", "url thumbnailUrl uploadedAt")
          .populate("createdBy", "email firstName lastName")
          .populate("lastModifiedBy", "email firstName lastName")
          .populate({
            path: "subcategories",
            select: "catName slug catDesc isActive",
          })
          .populate({
            path: "services",
            select: "serviceName slug isActive",
            options: { limit: 10 },
          });
      }

      return (await query.lean()) as Category | null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get category by slug
   */
  async getCategoryBySlug(
    slug: string,
    includeDetails: boolean = false
  ): Promise<Category | null> {
    try {
      const query = CategoryModel.findOne({
        slug: slug.toLowerCase(),
        isDeleted: false,
      });

      if (includeDetails) {
        query
          .populate("parentCategoryId", "catName slug")
          .populate("catCoverId", "url thumbnailUrl uploadedAt")
          .populate({
            path: "subcategories",
            select: "catName slug catDesc isActive catCoverId",
            populate: {
              path: "catCoverId",
              select: "url thumbnailUrl",
            },
          })
          .populate({
            path: "services",
            select: "serviceName slug isActive",
            options: { limit: 10 },
          });
      }

      return (await query.lean()) as Category | null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all active categories
   */
  async getActiveCategories(
    limit: number = 50,
    skip: number = 0
  ): Promise<{ categories: Category[]; total: number; hasMore: boolean }> {
    try {
      const [categories, total] = await Promise.all([
        CategoryModel.findActive()
          .limit(limit)
          .skip(skip)
          .populate("catCoverId", "url thumbnailUrl")
          .populate("parentCategoryId", "catName slug")
          .sort({ catName: 1 })
          .lean(),
        CategoryModel.countDocuments({ isDeleted: false, isActive: true }),
      ]);

      return {
        categories: categories as unknown as Category[],
        total,
        hasMore: skip + categories.length < total,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get top-level categories (no parent)
   */
  async getTopLevelCategories(
    includeSubcategories: boolean = false
  ): Promise<Category[]> {
    try {
      const query = CategoryModel.findTopLevel()
        .populate("catCoverId", "url thumbnailUrl")
        .sort({ catName: 1 });

      if (includeSubcategories) {
        query.populate({
          path: "subcategories",
          select: "catName slug catDesc isActive catCoverId",
          populate: {
            path: "catCoverId",
            select: "url thumbnailUrl",
          },
        });
      }

      return (await query.lean()) as unknown as Category[];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get subcategories of a parent category
   */
  async getSubcategories(parentCategoryId: string): Promise<Category[]> {
    try {
      if (!Types.ObjectId.isValid(parentCategoryId)) {
        throw new Error("Invalid parent category ID");
      }

      return (await CategoryModel.find({
        parentCategoryId: new Types.ObjectId(parentCategoryId),
        isDeleted: false,
        isActive: true,
      })
        .populate("catCoverId", "url thumbnailUrl")
        .sort({ catName: 1 })
        .lean()) as Category[];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update category
   */
  async updateCategory(
    categoryId: string,
    updates: Partial<Category>,
    lastModifiedBy?: string
  ): Promise<Category | null> {
    try {
      if (!Types.ObjectId.isValid(categoryId)) {
        throw new Error("Invalid category ID");
      }

      // Check if slug is being updated and if it's unique
      if (updates.slug) {
        const existingCategory = await CategoryModel.findOne({
          slug: updates.slug,
          _id: { $ne: new Types.ObjectId(categoryId) },
          isDeleted: false,
        });

        if (existingCategory) {
          throw new Error("Category with this slug already exists");
        }
      }

      // Validate parent category if being updated
      if (updates.parentCategoryId) {
        // Prevent circular reference
        if (updates.parentCategoryId.toString() === categoryId) {
          throw new Error("Category cannot be its own parent");
        }

        const parentCategory = await CategoryModel.findOne({
          _id: updates.parentCategoryId,
          isDeleted: false,
          isActive: true,
        });

        if (!parentCategory) {
          throw new Error("Parent category not found or inactive");
        }

        // Check if parent is a subcategory of the current category
        const isCircular = await this.checkCircularReference(
          categoryId,
          updates.parentCategoryId.toString()
        );

        if (isCircular) {
          throw new Error("Cannot set parent: would create circular reference");
        }
      }

      const category = await CategoryModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(categoryId),
          isDeleted: false,
        },
        {
          ...updates,
          lastModifiedBy: lastModifiedBy
            ? new Types.ObjectId(lastModifiedBy)
            : undefined,
        },
        { new: true, runValidators: true }
      ).lean();

      if (!category) {
        throw new Error("Category not found");
      }

      return category as Category;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check for circular reference in category hierarchy
   */
  private async checkCircularReference(
    categoryId: string,
    potentialParentId: string
  ): Promise<boolean> {
    let currentId = potentialParentId;

    while (currentId) {
      if (currentId === categoryId) {
        return true;
      }

      const parent = await CategoryModel.findOne({
        _id: new Types.ObjectId(currentId),
        isDeleted: false,
      });

      if (!parent || !parent.parentCategoryId) {
        break;
      }

      currentId = parent.parentCategoryId.toString();
    }

    return false;
  }

  /**
   * Soft delete category
   * Also soft deletes all subcategories recursively
   */
  async deleteCategory(
    categoryId: string,
    deletedBy?: string
  ): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(categoryId)) {
        throw new Error("Invalid category ID");
      }

      const category = (await CategoryModel.findOne({
        _id: new Types.ObjectId(categoryId),
        isDeleted: false,
      })) as CategoryDocument | null;

      if (!category) {
        throw new Error("Category not found");
      }

      // Get all subcategories recursively
      const subcategoryIds = await this.getAllSubcategoryIds(categoryId);

      // Soft delete the category and all subcategories
      await Promise.all([
        category.softDelete(
          deletedBy ? new Types.ObjectId(deletedBy) : undefined
        ),
        ...subcategoryIds.map((id) =>
          CategoryModel.findByIdAndUpdate(id, {
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy: deletedBy ? new Types.ObjectId(deletedBy) : undefined,
          })
        ),
      ]);

      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all subcategory IDs recursively
   */
  private async getAllSubcategoryIds(
    parentId: string
  ): Promise<Types.ObjectId[]> {
    const subcategories = await CategoryModel.find({
      parentCategoryId: new Types.ObjectId(parentId),
      isDeleted: false,
    });

    let allIds: Types.ObjectId[] = subcategories.map((cat) => cat._id);

    for (const subcat of subcategories) {
      const childIds = await this.getAllSubcategoryIds(subcat._id.toString());
      allIds = allIds.concat(childIds);
    }

    return allIds;
  }

  /**
   * Restore soft deleted category
   */
  async restoreCategory(categoryId: string): Promise<Category | null> {
    try {
      if (!Types.ObjectId.isValid(categoryId)) {
        throw new Error("Invalid category ID");
      }

      const category = (await CategoryModel.findOne({
        _id: new Types.ObjectId(categoryId),
        isDeleted: true,
      })) as CategoryDocument | null;

      if (!category) {
        throw new Error("Deleted category not found");
      }

      // Check if parent category is active (if category has parent)
      if (category.parentCategoryId) {
        const parentCategory = await CategoryModel.findOne({
          _id: category.parentCategoryId,
          isDeleted: false,
          isActive: true,
        });

        if (!parentCategory) {
          throw new Error(
            "Cannot restore category: parent category is deleted or inactive"
          );
        }
      }

      await category.restore();

      return (await CategoryModel.findById(
        categoryId
      ).lean()) as Category | null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Permanently delete category (hard delete)
   * WARNING: This action cannot be undone
   */
  async permanentlyDeleteCategory(categoryId: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(categoryId)) {
        throw new Error("Invalid category ID");
      }

      const category = await CategoryModel.findById(categoryId);

      if (!category) {
        throw new Error("Category not found");
      }

      // Check if category has active subcategories
      const activeSubcategories = await CategoryModel.countDocuments({
        parentCategoryId: new Types.ObjectId(categoryId),
        isDeleted: false,
      });

      if (activeSubcategories > 0) {
        throw new Error(
          "Cannot permanently delete category with active subcategories"
        );
      }

      await CategoryModel.deleteOne({ _id: category._id });

      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update category cover image ID
   * Uses ImageLinkingService for proper image linking
   */
  async updateCoverImageId(
    categoryId: string,
    catCoverId: Types.ObjectId | null,
    lastModifiedBy?: string
  ): Promise<Category | null> {
    try {
      if (!Types.ObjectId.isValid(categoryId)) {
        throw new Error("Invalid category ID");
      }

      if (catCoverId === null) {
        // Unlinking image
        const updateData: any = {
          $unset: { catCoverId: 1 },
          lastModifiedBy: lastModifiedBy
            ? new Types.ObjectId(lastModifiedBy)
            : undefined,
        };

        const category = await CategoryModel.findOneAndUpdate(
          {
            _id: new Types.ObjectId(categoryId),
            isDeleted: false,
          },
          updateData,
          { new: true }
        ).lean();

        return category as Category | null;
      } else {
        // Linking image using ImageLinkingService
        const linkResult = await this.imageLinkingService.linkImageToEntity(
          "category",
          categoryId,
          "category_cover",
          "catCoverId",
          catCoverId,
          lastModifiedBy
        );

        if (linkResult.linked) {
          return (await CategoryModel.findById(
            categoryId
          ).lean()) as Category | null;
        }

        throw new Error("Failed to link cover image");
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get category with complete details including cover image URL
   */
  async getCompleteCategory(categoryId: string): Promise<{
    category: Category | null;
    coverImage?: {
      url: string;
      thumbnailUrl?: string;
      uploadedAt: Date;
    };
    parentCategory?: {
      id: Types.ObjectId;
      name: string;
      slug: string;
    };
    subcategoriesCount?: number;
    servicesCount?: number;
  }> {
    try {
      if (!Types.ObjectId.isValid(categoryId)) {
        throw new Error("Invalid category ID");
      }

      const category = await CategoryModel.findOne({
        _id: new Types.ObjectId(categoryId),
        isDeleted: false,
      })
        .populate("parentCategoryId", "catName slug")
        .populate("subcategories")
        .populate("services");

      if (!category) {
        return { category: null };
      }

      const categoryObj = category.toObject() as CategoryObject;
      const result: any = { category: categoryObj };

      // Get cover image details if exists
      if (categoryObj.catCoverId) {
        const file = await this.fileService.getFileById(
          categoryObj.catCoverId.toString()
        );

        if (file && file.status === "active") {
          result.coverImage = {
            url: file.url,
            thumbnailUrl: file.thumbnailUrl,
            uploadedAt: file.uploadedAt,
          };
        }
      }

      // Add parent category info
      if (categoryObj.parentCategoryId) {
        const parent = categoryObj.parentCategoryId as any;
        result.parentCategory = {
          id: parent._id,
          name: parent.catName,
          slug: parent.slug,
        };
      }

      // Add counts
      result.subcategoriesCount = categoryObj.subcategories?.length || 0;
      result.servicesCount = categoryObj.services?.length || 0;

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search categories by name or description
   */
  async searchCategories(
    searchTerm: string,
    limit: number = 20,
    skip: number = 0,
    activeOnly: boolean = true
  ): Promise<{ categories: Category[]; total: number; hasMore: boolean }> {
    try {
      const query: any = {
        $text: { $search: searchTerm },
        isDeleted: false,
      };

      if (activeOnly) {
        query.isActive = true;
      }

      const [categories, total] = await Promise.all([
        CategoryModel.find(query)
          .limit(limit)
          .skip(skip)
          .populate("catCoverId", "url thumbnailUrl")
          .populate("parentCategoryId", "catName slug")
          .sort({ score: { $meta: "textScore" } })
          .lean(),
        CategoryModel.countDocuments(query),
      ]);

      return {
        categories: categories as Category[],
        total,
        hasMore: skip + categories.length < total,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get categories by tag
   */
  async getCategoriesByTag(
    tag: string,
    limit: number = 20,
    skip: number = 0
  ): Promise<{ categories: Category[]; total: number; hasMore: boolean }> {
    try {
      const query = {
        tags: { $in: [tag] },
        isDeleted: false,
        isActive: true,
      };

      const [categories, total] = await Promise.all([
        CategoryModel.find(query)
          .limit(limit)
          .skip(skip)
          .populate("catCoverId", "url thumbnailUrl")
          .populate("parentCategoryId", "catName slug")
          .sort({ catName: 1 })
          .lean(),
        CategoryModel.countDocuments(query),
      ]);

      return {
        categories: categories as Category[],
        total,
        hasMore: skip + categories.length < total,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all unique tags from categories
   */
  async getAllTags(): Promise<string[]> {
    try {
      const categories = await CategoryModel.find(
        { isDeleted: false, isActive: true },
        { tags: 1 }
      ).lean();

      const tagsSet = new Set<string>();
      categories.forEach((category) => {
        category.tags?.forEach((tag) => tagsSet.add(tag));
      });

      return Array.from(tagsSet).sort();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get category hierarchy (full tree structure)
   */
  async getCategoryHierarchy(): Promise<CategoryObject[]> {
    try {
      const topLevelCategories = await CategoryModel.findTopLevel()
        .populate("catCoverId", "url thumbnailUrl")
        .sort({ catName: 1 });

      const hierarchy = await Promise.all(
        topLevelCategories.map(async (category) => {
          const categoryObj = category.toObject() as CategoryObject;
          categoryObj.subcategories = await this.buildSubcategoryTree(
            category._id.toString()
          );
          return categoryObj;
        })
      );

      return hierarchy;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Build subcategory tree recursively
   */
  private async buildSubcategoryTree(
    parentId: string
  ): Promise<CategoryObject[]> {
    const subcategories = await CategoryModel.find({
      parentCategoryId: new Types.ObjectId(parentId),
      isDeleted: false,
      isActive: true,
    })
      .populate("catCoverId", "url thumbnailUrl")
      .sort({ catName: 1 });

    return await Promise.all(
      subcategories.map(async (subcat) => {
        const subcatObj = subcat.toObject() as CategoryObject;
        subcatObj.subcategories = await this.buildSubcategoryTree(
          subcat._id.toString()
        );
        return subcatObj;
      })
    );
  }

  /**
   * Get category statistics
   */
  async getCategoryStats(categoryId?: string): Promise<{
    totalCategories: number;
    activeCategories: number;
    inactiveCategories: number;
    deletedCategories: number;
    topLevelCategories: number;
    categoriesWithCover: number;
    averageSubcategoriesPerCategory: number;
  }> {
    try {
      const query: any = categoryId
        ? { _id: new Types.ObjectId(categoryId) }
        : {};

      const [
        totalCategories,
        activeCategories,
        inactiveCategories,
        deletedCategories,
        topLevelCategories,
        categoriesWithCover,
      ] = await Promise.all([
        CategoryModel.countDocuments({ ...query, isDeleted: false }),
        CategoryModel.countDocuments({
          ...query,
          isDeleted: false,
          isActive: true,
        }),
        CategoryModel.countDocuments({
          ...query,
          isDeleted: false,
          isActive: false,
        }),
        CategoryModel.countDocuments({ ...query, isDeleted: true }),
        CategoryModel.countDocuments({
          ...query,
          isDeleted: false,
          parentCategoryId: null,
        }),
        CategoryModel.countDocuments({
          ...query,
          isDeleted: false,
          catCoverId: { $ne: null },
        }),
      ]);

      // Calculate average subcategories
      const categoriesWithSubcats = await CategoryModel.aggregate([
        { $match: { isDeleted: false } },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "parentCategoryId",
            as: "subcats",
          },
        },
        {
          $project: {
            subcatCount: { $size: "$subcats" },
          },
        },
        {
          $group: {
            _id: null,
            avgSubcats: { $avg: "$subcatCount" },
          },
        },
      ]);

      const averageSubcategoriesPerCategory =
        categoriesWithSubcats.length > 0
          ? categoriesWithSubcats[0].avgSubcats
          : 0;

      return {
        totalCategories,
        activeCategories,
        inactiveCategories,
        deletedCategories,
        topLevelCategories,
        categoriesWithCover,
        averageSubcategoriesPerCategory: parseFloat(
          averageSubcategoriesPerCategory.toFixed(2)
        ),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if category exists
   */
  async categoryExists(categoryId: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(categoryId)) {
        return false;
      }

      const count = await CategoryModel.countDocuments({
        _id: new Types.ObjectId(categoryId),
        isDeleted: false,
      });

      return count > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if slug is available
   */
  async isSlugAvailable(
    slug: string,
    excludeCategoryId?: string
  ): Promise<boolean> {
    try {
      const query: any = {
        slug: slug.toLowerCase(),
        isDeleted: false,
      };

      if (excludeCategoryId && Types.ObjectId.isValid(excludeCategoryId)) {
        query._id = { $ne: new Types.ObjectId(excludeCategoryId) };
      }

      const count = await CategoryModel.countDocuments(query);

      return count === 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Bulk update categories
   */
  async bulkUpdateCategories(
    categoryIds: string[],
    updates: Partial<Category>,
    lastModifiedBy?: string
  ): Promise<{ modifiedCount: number }> {
    try {
      const objectIds = categoryIds.map((id) => new Types.ObjectId(id));

      const updateData: any = {
        ...updates,
        lastModifiedBy: lastModifiedBy
          ? new Types.ObjectId(lastModifiedBy)
          : undefined,
      };

      const result = await CategoryModel.updateMany(
        {
          _id: { $in: objectIds },
          isDeleted: false,
        },
        updateData
      );

      return { modifiedCount: result.modifiedCount };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Toggle category active status
   */
  async toggleActiveStatus(
    categoryId: string,
    lastModifiedBy?: string
  ): Promise<Category | null> {
    try {
      if (!Types.ObjectId.isValid(categoryId)) {
        throw new Error("Invalid category ID");
      }

      const category = (await CategoryModel.findOne({
        _id: new Types.ObjectId(categoryId),
        isDeleted: false,
      })) as CategoryDocument | null;

      if (!category) {
        throw new Error("Category not found");
      }

      category.isActive = !category.isActive;
      category.lastModifiedBy = lastModifiedBy
        ? new Types.ObjectId(lastModifiedBy)
        : undefined;

      await category.save();

      return category.toObject() as Category;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all categories (admin function)
   */
async getAllCategories(
  limit: number = 50,
  skip: number = 0,
  includeDeleted: boolean = false
): Promise<{ categories: Category[]; total: number; hasMore: boolean }> {
  try {
    const query: any = includeDeleted ? {} : { isDeleted: false };

    // Step 1: Check raw data
    const testCategory = await CategoryModel.findOne(query).lean();
    console.log('Test category catCoverId:', testCategory?.catCoverId);

    // Step 2: Check if File exists
    if (testCategory?.catCoverId) {
      const file = await this.fileService.getFileById(testCategory.catCoverId.toString());
      console.log('File exists:', !!file, 'File data:', file);
    }

    const [categories, total] = await Promise.all([
      CategoryModel.find(query)
        .limit(limit)
        .skip(skip)
        .populate("catCoverId", "url thumbnailUrl uploadedAt")  // Simplified
        .populate("parentCategoryId", "catName slug")
        .populate("createdBy", "email firstName lastName")
        .populate("lastModifiedBy", "email firstName lastName")
        .sort({ createdAt: -1 })
        .lean(),
      CategoryModel.countDocuments(query),
    ]);

    return {
      categories: categories as Category[],
      total,
      hasMore: skip + categories.length < total,
    };
  } catch (error) {
    console.error('getAllCategories error:', error);
    throw error;
  }
}

  /**
   * Get image status for a category
   * Useful for debugging image linking issues
   */
  async getCategoryImageStatus(categoryId: string) {
    try {
      return await this.imageLinkingService.getImageStatus(
        "category",
        categoryId,
        "category_cover",
        "catCoverId"
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Repair broken category cover image links
   */
  async repairCategoryCoverLinks(specificCategoryId?: string) {
    try {
      return await this.imageLinkingService.repairBrokenLinks(
        "category",
        "category_cover",
        "catCoverId",
        specificCategoryId
      );
    } catch (error) {
      throw error;
    }
  }
}
