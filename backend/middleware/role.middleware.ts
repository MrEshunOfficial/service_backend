// middleware/role.middleware.ts
import { Request, Response, NextFunction } from "express";
import { UserRole } from "../types/base.types";
import { ProviderModel } from "../models/profiles/provider.model";

/**
 * Middleware to check if user has the required role(s)
 * Works with the existing authenticateToken middleware
 * @param roles - Array of allowed roles
 */
export const requireRole = (roles: UserRole[]) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Check if user is authenticated (set by authenticateToken middleware)
      if (!req.user) {
        res.status(401).json({
          message: "Authentication required",
          error: "User not authenticated",
        });
        return;
      }

      // If customer role is required
      if (roles.includes(UserRole.CUSTOMER)) {
        // All authenticated users can act as customers
        // Just verify they have a valid user account
        if (req.user._id) {
          next();
          return;
        }
      }

      // If provider role is required
      if (roles.includes(UserRole.PROVIDER)) {
        // Check if user has a provider profile
        const providerProfile = await ProviderModel.findOne({
          profile: req.user._id,
          isDeleted: { $ne: true },
        });

        if (!providerProfile) {
          res.status(403).json({
            message: "Provider access required",
            error: "User does not have a provider profile",
          });
          return;
        }

        // Attach provider profile ID to request object (not modifying req.user)
        (req as any).providerProfileId = providerProfile._id;
        next();
        return;
      }

      // If we reach here, no valid role was found
      res.status(403).json({
        message: "Access denied",
        error: "User does not have the required role",
      });
    } catch (error) {
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
};

/**
 * Middleware to check if user is a provider and has an approved profile
 * Attaches providerProfileId to request
 */
export const requireApprovedProvider = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        message: "Authentication required",
        error: "User not authenticated",
      });
      return;
    }

    // Find provider profile
    const providerProfile = await ProviderModel.findOne({
      profile: req.user._id,
      isDeleted: { $ne: true },
    });

    if (!providerProfile) {
      res.status(403).json({
        message: "Provider access required",
        error: "User does not have a provider profile",
      });
      return;
    }

    // Attach provider profile ID to request object
    (req as any).providerProfileId = providerProfile._id;
    next();
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Middleware to optionally attach provider profile if user is a provider
 * Does not fail if user is not a provider
 */
export const attachProviderProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user) {
      const providerProfile = await ProviderModel.findOne({
        profile: req.user._id,
        isDeleted: { $ne: true },
      });

      if (providerProfile) {
        (req as any).providerProfileId = providerProfile._id;
      }
    }
    next();
  } catch (error) {
    // Don't fail - just continue without provider profile
    next();
  }
};

/**
 * Middleware to check if user can access a specific resource
 * Checks if user is the owner OR is an admin
 */
export const requireOwnerOrAdmin = (ownerIdField: string = "userId") => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          message: "Authentication required",
          error: "User not authenticated",
        });
        return;
      }

      // Get the owner ID from request params, body, or existing resource
      const ownerId =
        req.params[ownerIdField] ||
        req.body[ownerIdField] ||
        (req as any).resource?.[ownerIdField];

      // Check if user is owner or admin
      const isOwner = req.user._id.toString() === ownerId?.toString();
      const isAdmin = req.user.isAdmin || req.user.isSuperAdmin;

      if (!isOwner && !isAdmin) {
        res.status(403).json({
          message: "Access denied",
          error: "You do not have permission to access this resource",
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
};

/**
 * Helper function to get provider profile ID from request
 * Use in controllers to access the provider profile ID
 */
export const getProviderProfileId = (req: Request): string | undefined => {
  return (req as any).providerProfileId?.toString();
};

/**
 * Helper function to check if request has provider profile
 */
export const hasProviderProfile = (req: Request): boolean => {
  return !!(req as any).providerProfileId;
};
