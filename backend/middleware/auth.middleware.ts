// middleware/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model";

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log("Cookies object:", req.cookies);
    console.log("Authorization header:", req.headers.authorization);

    // Get token from cookies or Authorization header
    let token: string | undefined;
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Access token required",
      });
      return;
    }

    // Verify JWT secret exists
    if (!process.env.JWT_SECRET) {
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
      return;
    }

    // Verify token
    let decoded: { userId: string };
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: string };
    } catch (jwtError) {
      // Clear invalid token cookie
      res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });

      res.status(401).json({
        success: false,
        message: "Invalid or expired token",
        error:
          jwtError instanceof Error ? jwtError.message : "Unknown JWT error",
      });
      return;
    }

    // Find user in database
    const user = await User.findById(decoded.userId);
    console.log("User found:", user ? "Yes" : "No");

    // CRITICAL FIX: If user doesn't exist in DB, clear token and reject
    if (!user) {
      console.log("❌ User not found in database, clearing token");

      // Clear the invalid token cookie
      res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });

      res.status(401).json({
        success: false,
        message: "Invalid token - user account not found",
        userDeleted: true, // Flag to help frontend handle this case
      });
      return;
    }

    // Attach user data to request
    req.userId = decoded.userId;
    req.user = user;

    next();
  } catch (error) {
    console.error("Authentication error:", error);

    // Clear potentially corrupted token
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.status(401).json({
      success: false,
      message: "Authentication failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return;
  }
};

export const requireVerification = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user?.isEmailVerified) {
    res.status(403).json({
      success: false,
      message: "Email verification required",
    });
    return;
  }
  next();
};

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Check if user exists and is admin
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  if (!req.user.isAdmin && !req.user.isSuperAdmin) {
    res.status(403).json({
      success: false,
      message: "Admin access required",
    });
    return;
  }
  next();
};

export const requireSuperAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Check if user exists and is super admin
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  if (!req.user.isSuperAdmin) {
    res.status(403).json({
      success: false,
      message: "Super admin access required",
    });
    return;
  }
  next();
};

/**
 * Optional authentication middleware
 * Attaches user to request if valid token exists, but doesn't fail if no token
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from cookies or Authorization header
    let token: string | undefined;
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    // If no token, continue without authentication
    if (!token) {
      next();
      return;
    }

    // Verify JWT secret exists
    if (!process.env.JWT_SECRET) {
      next();
      return;
    }

    // Try to verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as {
        userId: string;
      };

      // Find user - IMPORTANT: Check if user still exists
      const user = await User.findById(decoded.userId);
      if (user) {
        req.userId = decoded.userId;
        req.user = user;
      } else {
        // User was deleted - clear the invalid token
        console.log("User deleted, clearing token in optionalAuth");
        res.clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
        });
      }
    } catch (jwtError) {
      // Invalid token - clear it and continue as unauthenticated
      console.log("Invalid token in optionalAuth, clearing cookie");
      res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
    }

    next();
  } catch (error) {
    // Any error - continue without auth
    next();
  }
};
