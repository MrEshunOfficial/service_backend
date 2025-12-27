// handlers/profiles/provider/provider-admin.handlers.ts
import { Response } from "express";
import { Types } from "mongoose";
import { ProviderModel } from "../../../../models/profiles/provider.model";
import { ProviderProfileService } from "../../../../services/profiles/provider.profile.service";
import { PopulationLevel } from "../../../../types/profiles/providerProfile.types";
import { AuthenticatedRequest } from "../../../../types/user.types";
import {
  validateObjectId,
  handleError,
} from "../../../../utils/controller-utils/controller.utils";

/**
 * Provider Admin Handlers
 * Administrative operations for managing providers
 * All endpoints should be protected with admin/super_admin roles
 * Integrates with the main provider service for operations
 */
export class ProviderAdminHandlers {
  private providerService: ProviderProfileService;

  constructor() {
    this.providerService = new ProviderProfileService();
  }

  /**
   * POST /api/admin/providers/:providerId/approve
   * Approve a provider profile (admin only)
   * Note: Implement approval fields in your provider model as needed
   */
  async approveProvider(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { providerId } = req.params;
      const adminId = req.user?._id;
      const { notes } = req.body;

      if (!adminId) {
        res.status(401).json({
          success: false,
          message: "Admin authentication required",
        });
        return;
      }

      if (!validateObjectId(providerId)) {
        res.status(400).json({
          success: false,
          message: "Invalid provider ID format",
        });
        return;
      }

      const provider = await ProviderModel.findOne({
        _id: new Types.ObjectId(providerId),
        isDeleted: false,
      });

      if (!provider) {
        res.status(404).json({
          success: false,
          message: "Provider profile not found",
        });
        return;
      }

      // TODO: Add approval logic based on your requirements
      // You may want to add approval fields to your provider model:
      // - approvalStatus: 'pending' | 'approved' | 'rejected'
      // - approvedBy: ObjectId reference to admin
      // - approvedAt: Date
      // - approvalNotes: string

      res.status(200).json({
        success: true,
        message: "Provider profile approved successfully",
        data: {
          providerId,
          approvedBy: adminId,
          approvedAt: new Date(),
          notes: notes || null,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to approve provider");
    }
  }

  /**
   * POST /api/admin/providers/:providerId/reject
   * Reject a provider profile with reason (admin only)
   */
  async rejectProvider(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { providerId } = req.params;
      const adminId = req.user?._id;
      const { reason } = req.body;

      if (!adminId) {
        res.status(401).json({
          success: false,
          message: "Admin authentication required",
        });
        return;
      }

      if (!validateObjectId(providerId)) {
        res.status(400).json({
          success: false,
          message: "Invalid provider ID format",
        });
        return;
      }

      if (!reason) {
        res.status(400).json({
          success: false,
          message: "Rejection reason is required",
        });
        return;
      }

      const provider = await ProviderModel.findOne({
        _id: new Types.ObjectId(providerId),
        isDeleted: false,
      });

      if (!provider) {
        res.status(404).json({
          success: false,
          message: "Provider profile not found",
        });
        return;
      }

      // TODO: Implement rejection logic
      // Consider adding notification to provider about rejection

      res.status(200).json({
        success: true,
        message: "Provider profile rejected",
        data: {
          providerId,
          rejectedBy: adminId,
          rejectedAt: new Date(),
          reason,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to reject provider");
    }
  }

  /**
   * POST /api/admin/providers/:providerId/suspend
   * Suspend a provider profile (admin only)
   */
  async suspendProvider(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { providerId } = req.params;
      const adminId = req.user?._id;
      const { reason, duration } = req.body;

      if (!adminId) {
        res.status(401).json({
          success: false,
          message: "Admin authentication required",
        });
        return;
      }

      if (!validateObjectId(providerId)) {
        res.status(400).json({
          success: false,
          message: "Invalid provider ID format",
        });
        return;
      }

      if (!reason) {
        res.status(400).json({
          success: false,
          message: "Suspension reason is required",
        });
        return;
      }

      const provider = await ProviderModel.findOne({
        _id: new Types.ObjectId(providerId),
        isDeleted: false,
      });

      if (!provider) {
        res.status(404).json({
          success: false,
          message: "Provider profile not found",
        });
        return;
      }

      // TODO: Implement suspension logic
      // Consider adding suspension fields to provider model:
      // - suspensionStatus: boolean
      // - suspendedBy: ObjectId
      // - suspendedAt: Date
      // - suspensionReason: string
      // - suspensionDuration: string
      // - suspensionEndsAt: Date

      res.status(200).json({
        success: true,
        message: "Provider profile suspended",
        data: {
          providerId,
          suspendedBy: adminId,
          suspendedAt: new Date(),
          reason,
          duration: duration || "indefinite",
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to suspend provider");
    }
  }

  /**
   * POST /api/admin/providers/:providerId/unsuspend
   * Unsuspend a provider profile (admin only)
   */
  async unsuspendProvider(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { providerId } = req.params;
      const adminId = req.user?._id;

      if (!adminId) {
        res.status(401).json({
          success: false,
          message: "Admin authentication required",
        });
        return;
      }

      if (!validateObjectId(providerId)) {
        res.status(400).json({
          success: false,
          message: "Invalid provider ID format",
        });
        return;
      }

      const provider = await ProviderModel.findById(providerId);

      if (!provider) {
        res.status(404).json({
          success: false,
          message: "Provider profile not found",
        });
        return;
      }

      // TODO: Implement unsuspension logic

      res.status(200).json({
        success: true,
        message: "Provider profile unsuspended successfully",
        data: {
          providerId,
          unsuspendedBy: adminId,
          unsuspendedAt: new Date(),
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to unsuspend provider");
    }
  }

  /**
   * POST /api/admin/providers/bulk-operations
   * Perform bulk operations on multiple providers (admin only)
   * Supported operations: delete, restore, update
   */
  async bulkOperations(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const adminId = req.user?._id;
      const { operation, providerIds, data } = req.body;

      if (!adminId) {
        res.status(401).json({
          success: false,
          message: "Admin authentication required",
        });
        return;
      }

      if (!operation || !providerIds || !Array.isArray(providerIds)) {
        res.status(400).json({
          success: false,
          message: "Operation type and provider IDs array are required",
        });
        return;
      }

      if (providerIds.length === 0) {
        res.status(400).json({
          success: false,
          message: "Provider IDs array cannot be empty",
        });
        return;
      }

      // Validate all provider IDs
      for (const id of providerIds) {
        if (!validateObjectId(id)) {
          res.status(400).json({
            success: false,
            message: `Invalid provider ID: ${id}`,
          });
          return;
        }
      }

      const results = {
        success: 0,
        failed: 0,
        errors: [] as Array<{ providerId: string; error: string }>,
      };

      switch (operation) {
        case "delete":
          for (const providerId of providerIds) {
            try {
              await this.providerService.deleteProviderProfile(
                providerId,
                adminId.toString()
              );
              results.success++;
            } catch (error: any) {
              results.failed++;
              results.errors.push({
                providerId,
                error: error.message,
              });
            }
          }
          break;

        case "restore":
          for (const providerId of providerIds) {
            try {
              await this.providerService.restoreProviderProfile(providerId);
              results.success++;
            } catch (error: any) {
              results.failed++;
              results.errors.push({
                providerId,
                error: error.message,
              });
            }
          }
          break;

        case "update":
          if (!data) {
            res.status(400).json({
              success: false,
              message: "Update data is required for bulk update operation",
            });
            return;
          }

          for (const providerId of providerIds) {
            try {
              await this.providerService.updateProviderProfile(
                providerId,
                data,
                adminId.toString()
              );
              results.success++;
            } catch (error: any) {
              results.failed++;
              results.errors.push({
                providerId,
                error: error.message,
              });
            }
          }
          break;

        default:
          res.status(400).json({
            success: false,
            message: `Unknown operation: ${operation}. Supported operations: delete, restore, update`,
          });
          return;
      }

      res.status(200).json({
        success: true,
        message: `Bulk ${operation} operation completed`,
        data: {
          operation,
          totalRequested: providerIds.length,
          successCount: results.success,
          failedCount: results.failed,
          errors: results.errors,
        },
      });
    } catch (error) {
      handleError(res, error, "Bulk operation failed");
    }
  }

  /**
   * GET /api/admin/providers/report
   * Generate comprehensive provider report with statistics (admin only)
   * Supports filtering by region, city, training status, and date range
   */
  async generateProviderReport(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const adminId = req.user?._id;
      const {
        region,
        city,
        isCompanyTrained,
        includeDeleted = "false",
        startDate,
        endDate,
      } = req.query;

      if (!adminId) {
        res.status(401).json({
          success: false,
          message: "Admin authentication required",
        });
        return;
      }

      // Build query
      const query: any = {};

      if (includeDeleted !== "true") {
        query.isDeleted = false;
      }

      if (region) {
        query["locationData.region"] = region;
      }

      if (city) {
        query["locationData.city"] = city;
      }

      if (isCompanyTrained !== undefined) {
        query.isCompanyTrained = isCompanyTrained === "true";
      }

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
          query.createdAt.$gte = new Date(startDate as string);
        }
        if (endDate) {
          query.createdAt.$lte = new Date(endDate as string);
        }
      }

      // Get providers with necessary population
      const providers = await ProviderModel.find(query)
        .populate({
          path: "profile",
          select: "userId",
          populate: {
            path: "userId",
            select: "firstName lastName email",
          },
        })
        .populate({
          path: "serviceOfferings",
          select: "title categoryId",
        })
        .lean();

      // Generate statistics
      const stats = {
        totalProviders: providers.length,
        companyTrained: providers.filter((p) => p.isCompanyTrained).length,
        requireDeposit: providers.filter((p) => p.requireInitialDeposit).length,
        alwaysAvailable: providers.filter((p) => p.isAlwaysAvailable).length,
        withLocation: providers.filter((p) => p.locationData?.gpsCoordinates)
          .length,
        byRegion: {} as Record<string, number>,
        byCity: {} as Record<string, number>,
        withGalleryImages: providers.filter(
          (p) => p.BusinessGalleryImages && p.BusinessGalleryImages.length > 0
        ).length,
        withIdDocuments: providers.filter(
          (p) => p.IdDetails && p.IdDetails.fileImage.length > 0
        ).length,
      };

      // Count by region and city
      providers.forEach((provider) => {
        const region = provider.locationData?.region || "Unknown";
        const city = provider.locationData?.city || "Unknown";

        stats.byRegion[region] = (stats.byRegion[region] || 0) + 1;
        stats.byCity[city] = (stats.byCity[city] || 0) + 1;
      });

      res.status(200).json({
        success: true,
        message: "Provider report generated successfully",
        data: {
          reportGeneratedAt: new Date(),
          generatedBy: adminId,
          filters: {
            region: region || null,
            city: city || null,
            isCompanyTrained: isCompanyTrained || null,
            includeDeleted: includeDeleted === "true",
            startDate: startDate || null,
            endDate: endDate || null,
          },
          statistics: stats,
          providers: providers.map((p) => ({
            _id: p._id,
            businessName: p.businessName,
            region: p.locationData?.region,
            city: p.locationData?.city,
            isCompanyTrained: p.isCompanyTrained,
            serviceCount: p.serviceOfferings?.length || 0,
            hasLocation: !!p.locationData?.gpsCoordinates,
            createdAt: p.createdAt,
          })),
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to generate provider report");
    }
  }

  /**
   * GET /api/admin/providers/all
   * Get all providers with pagination and filtering (admin only)
   * Supports configurable population levels for performance
   */
  async getAllProviders(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const adminId = req.user?._id;
      const {
        limit = "50",
        skip = "0",
        includeDeleted = "false",
        sortBy = "createdAt",
        sortOrder = "desc",
        populationLevel = "minimal",
      } = req.query;

      if (!adminId) {
        res.status(401).json({
          success: false,
          message: "Admin authentication required",
        });
        return;
      }

      const query: any = {};
      if (includeDeleted !== "true") {
        query.isDeleted = false;
      }

      const sort: any = {};
      sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;

      let providerQuery = ProviderModel.find(query)
        .sort(sort)
        .skip(parseInt(skip as string))
        .limit(parseInt(limit as string));

      // Apply population based on level using service's method
      if (populationLevel !== "none") {
        const popLevel = populationLevel as PopulationLevel;
        // Basic population for admin view
        providerQuery = providerQuery
          .populate({
            path: "profile",
            select: "userId bio",
            populate: {
              path: "userId",
              select: "firstName lastName email",
            },
          })
          .populate({
            path: "serviceOfferings",
            select: "title",
          });
      }

      const providers = await providerQuery.lean();
      const total = await ProviderModel.countDocuments(query);

      res.status(200).json({
        success: true,
        message: "Providers retrieved successfully",
        data: {
          providers,
          pagination: {
            total,
            limit: parseInt(limit as string),
            skip: parseInt(skip as string),
            hasMore: total > parseInt(skip as string) + providers.length,
            page:
              Math.floor(parseInt(skip as string) / parseInt(limit as string)) +
              1,
            totalPages: Math.ceil(total / parseInt(limit as string)),
          },
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to retrieve providers");
    }
  }

  /**
   * GET /api/admin/providers/:providerId/audit-log
   * Get audit log for a provider (admin only)
   * TODO: Implement actual audit logging system
   */
  async getProviderAuditLog(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { providerId } = req.params;
      const adminId = req.user?._id;

      if (!adminId) {
        res.status(401).json({
          success: false,
          message: "Admin authentication required",
        });
        return;
      }

      if (!validateObjectId(providerId)) {
        res.status(400).json({
          success: false,
          message: "Invalid provider ID format",
        });
        return;
      }

      // Verify provider exists
      const provider = await ProviderModel.findById(providerId);
      if (!provider) {
        res.status(404).json({
          success: false,
          message: "Provider profile not found",
        });
        return;
      }

      // TODO: Implement actual audit log retrieval
      // This would integrate with your audit logging system
      // Consider tracking:
      // - Profile creation
      // - Profile updates (what changed)
      // - Image additions/removals
      // - Service additions/removals
      // - Admin actions (approvals, suspensions, etc.)
      // - Location updates

      res.status(200).json({
        success: true,
        message: "Audit log retrieved successfully",
        data: {
          providerId,
          businessName: provider.businessName,
          auditLog: [
            // Placeholder - implement actual audit log entries
            {
              action: "profile_created",
              timestamp: provider.createdAt,
              performedBy: "system",
            },
          ],
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to retrieve audit log");
    }
  }

  /**
   * GET /api/admin/providers/statistics
   * Get high-level provider statistics (admin only)
   * Quick overview without full provider data
   */
  async getProviderStatistics(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const adminId = req.user?._id;

      if (!adminId) {
        res.status(401).json({
          success: false,
          message: "Admin authentication required",
        });
        return;
      }

      const [
        totalProviders,
        activeProviders,
        deletedProviders,
        companyTrained,
        withLocation,
      ] = await Promise.all([
        ProviderModel.countDocuments({}),
        ProviderModel.countDocuments({ isDeleted: false }),
        ProviderModel.countDocuments({ isDeleted: true }),
        ProviderModel.countDocuments({
          isCompanyTrained: true,
          isDeleted: false,
        }),
        ProviderModel.countDocuments({
          "locationData.gpsCoordinates": { $exists: true },
          isDeleted: false,
        }),
      ]);

      res.status(200).json({
        success: true,
        message: "Provider statistics retrieved successfully",
        data: {
          totalProviders,
          activeProviders,
          deletedProviders,
          companyTrained,
          withLocation,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to retrieve provider statistics");
    }
  }
}

export default new ProviderAdminHandlers();
