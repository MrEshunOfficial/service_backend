// controllers/auth.controller.ts (Refactored)
import { Request, Response } from "express";
import { authService, getUserResponse } from "../services/auth.service";
import { generateTokenAndSetCookie } from "../utils/generateTokenAndSetCookie";
import {
  SignupRequestBody,
  LoginRequestBody,
  ResetPasswordRequestBody,
  VerifyEmailRequestBody,
  UpdatePasswordRequestBody,
  ResendVerificationRequestBody,
  AuthResponse,
  AuthenticatedRequest,
} from "../types/user.types";

// Helper functions for consistent responses
const sendErrorResponse = (res: Response, status: number, message: string) => {
  res.status(status).json({ message });
};

const sendSuccessResponse = (
  res: Response,
  status: number,
  message: string,
  data?: any
) => {
  res.status(status).json({ message, ...data });
};

const validateRequired = (
  fields: Record<string, any>,
  res: Response
): boolean => {
  const missing = Object.entries(fields).find(([_, value]) => !value);
  if (missing) {
    sendErrorResponse(res, 400, `${missing[0]} is required`);
    return false;
  }
  return true;
};

const validatePassword = (password: string, res: Response): boolean => {
  if (password.length < 6) {
    sendErrorResponse(res, 400, "Password must be at least 6 characters long");
    return false;
  }
  return true;
};

// Error handler wrapper
const handleAsync = (fn: Function) => async (req: Request, res: Response) => {
  try {
    await fn(req, res);
  } catch (error: any) {
    console.error(`Controller error:`, error);

    // Handle service-specific errors
    const errorMessages: Record<string, { status: number; message: string }> = {
      USER_EXISTS: { status: 400, message: "User already exists" },
      INVALID_CREDENTIALS: {
        status: 400,
        message: "Invalid email or password",
      },
      EMAIL_NOT_VERIFIED: {
        status: 401,
        message: "Please verify your email before logging in",
      },
      INVALID_TOKEN: { status: 400, message: "Invalid or expired token" },
      EMAIL_ALREADY_VERIFIED: {
        status: 400,
        message: "Email is already verified",
      },
      OAUTH_NO_VERIFICATION: {
        status: 400,
        message: "This account doesn't require email verification",
      },
      EMAIL_SEND_FAILED: { status: 500, message: "Failed to send email" },
      OAUTH_NO_PASSWORD: {
        status: 400,
        message:
          "This account uses OAuth authentication and doesn't have a password to reset",
      },
      OAUTH_NO_PASSWORD_CHANGE: {
        status: 400,
        message: "Password change not available for OAuth accounts",
      },
      INVALID_CURRENT_PASSWORD: {
        status: 400,
        message: "Current password is incorrect",
      },
      USER_NOT_FOUND: { status: 404, message: "User not found" },
      DELETED_ACCOUNT_NOT_FOUND: {
        status: 404,
        message: "Deleted account not found",
      },
      DELETED_USER_NOT_FOUND: {
        status: 404,
        message: "Deleted user not found",
      },
      INVALID_ROLE: { status: 400, message: "Invalid system role" },
    };

    const errorInfo = errorMessages[error.message];
    if (errorInfo) {
      // Handle special case for email not verified
      if (error.message === "EMAIL_NOT_VERIFIED") {
        return res.status(errorInfo.status).json({
          message: errorInfo.message,
          requiresVerification: true,
          email: error.email,
        });
      }
      return sendErrorResponse(res, errorInfo.status, errorInfo.message);
    }

    // Generic server error
    sendErrorResponse(res, 500, "Internal server error");
  }
};

// Permission middleware helpers
const requireAdmin = (req: AuthenticatedRequest, res: Response): boolean => {
  const user = req.user;
  if (!user?.isAdmin) {
    sendErrorResponse(res, 403, "Admin access required");
    return false;
  }
  return true;
};

const requireSuperAdmin = (
  req: AuthenticatedRequest,
  res: Response
): boolean => {
  const user = req.user;
  if (!user?.isSuperAdmin) {
    sendErrorResponse(res, 403, "Super admin access required");
    return false;
  }
  return true;
};

// AUTHENTICATION CONTROLLERS
export const signup = handleAsync(
  async (
    req: Request<{}, AuthResponse, SignupRequestBody>,
    res: Response<AuthResponse>
  ) => {
    const { name, email, password } = req.body;

    if (
      !validateRequired({ name, email, password }, res) ||
      !validatePassword(password, res)
    )
      return;

    const user = await authService.signup({ name, email, password });
    const token = generateTokenAndSetCookie(res, user._id.toString());

    sendSuccessResponse(res, 201, "User created successfully", {
      user: getUserResponse(user),
      token,
    });
  }
);

export const login = handleAsync(
  async (
    req: Request<{}, AuthResponse, LoginRequestBody>,
    res: Response<AuthResponse>
  ) => {
    const { email, password } = req.body;

    if (!validateRequired({ email, password }, res)) return;

    const user = await authService.login({ email, password });
    const token = generateTokenAndSetCookie(res, user._id.toString());

    sendSuccessResponse(res, 200, "Login successful", {
      user: getUserResponse(user),
      token,
    });
  }
);

export const logout = handleAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId;

    if (userId) {
      await authService.logout(userId);
    }

    res.clearCookie("token");
    sendSuccessResponse(res, 200, "Logout successful");
  }
);

// EMAIL VERIFICATION CONTROLLERS
export const verifyEmail = handleAsync(
  async (
    req: Request<{}, AuthResponse, VerifyEmailRequestBody>,
    res: Response<AuthResponse>
  ) => {
    const { token } = req.body;

    if (!validateRequired({ token }, res)) return;

    const user = await authService.verifyEmail({ token });

    sendSuccessResponse(res, 200, "Email verified successfully", {
      user: getUserResponse(user),
    });
  }
);

export const resendVerification = handleAsync(
  async (
    req: Request<{}, AuthResponse, ResendVerificationRequestBody>,
    res: Response<AuthResponse>
  ) => {
    const { email } = req.body;

    if (!validateRequired({ email }, res)) return;

    await authService.resendVerification({ email });

    sendSuccessResponse(
      res,
      200,
      "If the email exists and is unverified, a verification email has been sent"
    );
  }
);

// PASSWORD MANAGEMENT CONTROLLERS
export const forgotPassword = handleAsync(
  async (
    req: Request<{}, AuthResponse, ResetPasswordRequestBody>,
    res: Response<AuthResponse>
  ) => {
    const { email } = req.body;

    if (!validateRequired({ email }, res)) return;

    await authService.forgotPassword({ email });

    sendSuccessResponse(
      res,
      200,
      "If the email exists, a reset link has been sent"
    );
  }
);

export const resetPassword = handleAsync(
  async (
    req: Request<{}, AuthResponse, UpdatePasswordRequestBody>,
    res: Response<AuthResponse>
  ) => {
    const { token, password } = req.body;

    if (
      !validateRequired({ token, password }, res) ||
      !validatePassword(password, res)
    )
      return;

    await authService.resetPassword({ token, password });

    sendSuccessResponse(res, 200, "Password reset successful");
  }
);

export const changePassword = handleAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.userId;

    if (
      !validateRequired({ currentPassword, newPassword }, res) ||
      !validatePassword(newPassword, res)
    )
      return;

    await authService.changePassword(userId!, currentPassword, newPassword);

    sendSuccessResponse(res, 200, "Password changed successfully");
  }
);

// TOKEN MANAGEMENT
export const refreshToken = handleAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId;
    const user = await authService.refreshToken(userId!);
    const token = generateTokenAndSetCookie(res, user._id.toString());

    sendSuccessResponse(res, 200, "Token refreshed successfully", {
      user: getUserResponse(user),
      token,
    });
  }
);

// ACCOUNT MANAGEMENT
export const deleteAccount = handleAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId;
    await authService.deleteAccount(userId!);
    res.clearCookie("token");

    sendSuccessResponse(res, 200, "Account deleted successfully");
  }
);

export const restoreAccount = handleAsync(
  async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!validateRequired({ email }, res)) return;

    const user = await authService.restoreAccount(email);

    sendSuccessResponse(res, 200, "Account restored successfully", {
      user: getUserResponse(user),
    });
  }
);

export const permanentlyDeleteAccount = handleAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId;
    await authService.permanentlyDeleteAccount(userId!);
    res.clearCookie("token");

    sendSuccessResponse(res, 200, "Account permanently deleted");
  }
);

// ADMIN CONTROLLERS
export const getAllUsers = handleAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!requireAdmin(req, res)) return;

    const { page, limit, search, status, role } = req.query;
    const result = await authService.getAllUsers({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search: search as string,
      status: status as string,
      role: role as string,
    });

    sendSuccessResponse(res, 200, "Users retrieved successfully", {
      users: result.users.map(getUserResponse),
      pagination: result.pagination,
    });
  }
);

export const updateUserRole = handleAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!requireSuperAdmin(req, res)) return;

    const { userId } = req.params;
    const { systemRole } = req.body;

    if (!validateRequired({ systemRole }, res)) return;

    const user = await authService.updateUserRole(userId, systemRole);

    sendSuccessResponse(res, 200, "User role updated successfully", {
      user: getUserResponse(user),
    });
  }
);

export const getUserById = handleAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!requireAdmin(req, res)) return;

    const { userId } = req.params;
    const user = await authService.getUserById(userId);

    sendSuccessResponse(res, 200, "User retrieved successfully", {
      user: getUserResponse(user),
    });
  }
);

export const deleteUser = handleAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!requireSuperAdmin(req, res)) return;

    const { userId } = req.params;
    const adminId = req.userId;

    await authService.deleteUser(userId, adminId);

    sendSuccessResponse(res, 200, "User deleted successfully");
  }
);

export const restoreUser = handleAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!requireSuperAdmin(req, res)) return;

    const { userId } = req.params;
    const user = await authService.restoreUser(userId);

    sendSuccessResponse(res, 200, "User restored successfully", {
      user: getUserResponse(user),
    });
  }
);
