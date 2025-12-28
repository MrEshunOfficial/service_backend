// middleware/role.middleware.ts
import { Request, Response, NextFunction } from "express";
import { UserRole } from "../types/base.types";
import { ProfileModel } from "../models/profiles/userProfile.model";

/**
 * Middleware to check if user has the required role(s) based on their profile
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

      // Find user profile
      const userProfile = await ProfileModel.findOne({
        userId: req.user._id,
        isDeleted: { $ne: true },
      });

      // Check if user has a profile
      if (!userProfile) {
        res.status(403).json({
          message: "Profile required",
          error: "User does not have a registered profile",
        });
        return;
      }

      // Check if user's profile role matches any of the required roles
      if (!roles.includes(userProfile.role as UserRole)) {
        res.status(403).json({
          message: "Access denied",
          error: `This action requires ${roles.join(
            " or "
          )} role. Your profile role is ${userProfile.role}`,
        });
        return;
      }

      // Attach profile to request for downstream use
      (req as any).userProfile = userProfile;
      (req as any).userProfileId = userProfile._id;

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
 * Middleware to allow both customers and providers based on profile role
 * Used for shared operations
 */
export const requireCustomerOrProvider = async (
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

    // Find user profile
    const userProfile = await ProfileModel.findOne({
      userId: req.user._id,
      isDeleted: { $ne: true },
    });

    if (!userProfile) {
      res.status(403).json({
        message: "Profile required",
        error: "User does not have a registered profile",
      });
      return;
    }

    // Check if profile role is either CUSTOMER or PROVIDER
    if (
      userProfile.role !== UserRole.CUSTOMER &&
      userProfile.role !== UserRole.PROVIDER
    ) {
      res.status(403).json({
        message: "Access denied",
        error: "This action requires customer or provider role",
      });
      return;
    }

    // Attach profile to request
    (req as any).userProfile = userProfile;
    (req as any).userProfileId = userProfile._id;

    next();
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Middleware to check if user has a profile with PROVIDER role
 * Attaches profile to request
 */
export const requireProvider = async (
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

    // Find user profile
    const userProfile = await ProfileModel.findOne({
      userId: req.user._id,
      isDeleted: { $ne: true },
    });

    if (!userProfile) {
      res.status(403).json({
        message: "Profile required",
        error: "User does not have a registered profile",
      });
      return;
    }

    // Check if profile role is PROVIDER
    if (userProfile.role !== UserRole.PROVIDER) {
      res.status(403).json({
        message: "Provider access required",
        error: `Your profile role is ${userProfile.role}, but this action requires provider role`,
      });
      return;
    }

    // Attach profile to request
    (req as any).userProfile = userProfile;
    (req as any).userProfileId = userProfile._id;

    next();
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Middleware to check if user has a profile with CUSTOMER role
 * Attaches profile to request
 */
export const requireCustomer = async (
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

    // Find user profile
    const userProfile = await ProfileModel.findOne({
      userId: req.user._id,
      isDeleted: { $ne: true },
    });

    if (!userProfile) {
      res.status(403).json({
        message: "Profile required",
        error: "User does not have a registered profile",
      });
      return;
    }

    // Check if profile role is CUSTOMER
    if (userProfile.role !== UserRole.CUSTOMER) {
      res.status(403).json({
        message: "Customer access required",
        error: `Your profile role is ${userProfile.role}, but this action requires customer role`,
      });
      return;
    }

    // Attach profile to request
    (req as any).userProfile = userProfile;
    (req as any).userProfileId = userProfile._id;

    next();
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Middleware to optionally attach user profile if it exists
 * Does not fail if user doesn't have a profile
 */
export const attachUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user) {
      const userProfile = await ProfileModel.findOne({
        userId: req.user._id,
        isDeleted: { $ne: true },
      });

      if (userProfile) {
        (req as any).userProfile = userProfile;
        (req as any).userProfileId = userProfile._id;
      }
    }
    next();
  } catch (error) {
    // Don't fail - just continue without profile
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
 * Helper function to get user profile from request
 * Use in controllers to access the user profile
 */
export const getUserProfile = (req: Request): any | undefined => {
  return (req as any).userProfile;
};

/**
 * Helper function to get user profile ID from request
 * Use in controllers to access the user profile ID
 */
export const getUserProfileId = (req: Request): string | undefined => {
  return (req as any).userProfileId?.toString();
};

/**
 * Helper function to check if request has user profile
 */
export const hasUserProfile = (req: Request): boolean => {
  return !!(req as any).userProfile;
};

/**
 * Helper function to get user role from profile
 */
export const getUserRole = (req: Request): UserRole | undefined => {
  const profile = (req as any).userProfile;
  return profile?.role;
};
