// controllers/oauth.controller.ts
import { Request, Response } from "express";
import { generateTokenAndSetCookie } from "../utils/generateTokenAndSetCookie";
import {
  GoogleAuthRequestBody,
  AppleAuthRequestBody,
  AuthResponse,
  LinkProviderRequestBody,
  AuthenticatedRequest,
} from "../types/user.types";
import { oAuthService } from "../services/oauth.service";
import { User } from "../models/user.model";

export const googleAuth = async (
  req: Request<{}, AuthResponse, GoogleAuthRequestBody>,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      res.status(400).json({
        message: "Google ID token is required",
        error: "Missing required parameter: idToken",
      });
      return;
    }

    // Verify Google token and get user data
    const userData = await oAuthService.verifyGoogleUser(idToken);

    // Authenticate with OAuth
    const result = await oAuthService.authenticateWithOAuth("google", userData);

    // Fetch complete user with all fields
    const completeUser = await User.findById(result.user.id);
    
    if (!completeUser) {
      res.status(500).json({
        message: "User authentication failed",
        error: "User not found after creation",
      });
      return;
    }

    // Generate JWT token with admin flags
    const token = generateTokenAndSetCookie(
      res, 
      completeUser._id.toString(),
      {
        isEmailVerified: completeUser.isEmailVerified,
        isAdmin: completeUser.isAdmin,
        isSuperAdmin: completeUser.isSuperAdmin,
      }
    );

    res.status(200).json({
      message: "Google authentication successful",
      user: result.user,
      token,
      hasProfile: result.hasProfile,
      profile: null,
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(400).json({
      message: "Google authentication failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const appleAuth = async (
  req: Request<{}, AuthResponse, AppleAuthRequestBody>,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    const { idToken, user: appleUserData } = req.body;

    if (!idToken) {
      res.status(400).json({
        message: "Apple ID token is required",
        error: "Missing required parameter: idToken",
      });
      return;
    }

    // Verify Apple token and get user data
    const userData = await oAuthService.verifyAppleUser(idToken, appleUserData);

    // Authenticate with OAuth
    const result = await oAuthService.authenticateWithOAuth("apple", userData);

    // Fetch complete user with all fields
    const completeUser = await User.findById(result.user.id);
    
    if (!completeUser) {
      res.status(500).json({
        message: "User authentication failed",
        error: "User not found after creation",
      });
      return;
    }

    // Generate JWT token with admin flags
    const token = generateTokenAndSetCookie(
      res, 
      completeUser._id.toString(),
      {
        isEmailVerified: completeUser.isEmailVerified,
        isAdmin: completeUser.isAdmin,
        isSuperAdmin: completeUser.isSuperAdmin,
      }
    );

    res.status(200).json({
      message: "Apple authentication successful",
      user: result.user,
      token,
      hasProfile: result.hasProfile,
      profile: null,
    });
  } catch (error) {
    console.error("Apple auth error:", error);
    res.status(400).json({
      message: "Apple authentication failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const linkProvider = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { provider, idToken }: LinkProviderRequestBody = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        message: "Authentication required",
        error: "No user ID found in request",
      });
      return;
    }

    if (!provider || !idToken) {
      res.status(400).json({
        message: "Provider and ID token are required",
        error: "Missing required parameters",
      });
      return;
    }

    // Validate provider
    if (provider !== "google" && provider !== "apple") {
      res.status(400).json({
        message: "Invalid provider",
        error: "Supported providers are 'google' and 'apple'",
      });
      return;
    }

    // Link provider through service
    const result = await oAuthService.linkProviderToUser(
      userId,
      provider,
      idToken
    );

    res.status(200).json({
      message: `${provider} account linked successfully`,
      user: result.user,
    });
  } catch (error) {
    console.error("Link provider error:", error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message === "User not found") {
        res.status(404).json({
          message: "User not found",
          error: "User account does not exist",
        });
        return;
      }

      if (error.message === "This account is already linked to another user") {
        res.status(400).json({
          message: "This account is already linked to another user",
          error: "Provider account already in use",
        });
        return;
      }
    }

    res.status(500).json({
      message: "Failed to link provider account",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};