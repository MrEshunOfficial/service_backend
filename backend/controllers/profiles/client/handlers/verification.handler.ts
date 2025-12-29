// handlers/profiles/client/verification.handler.ts
import { Response } from "express";
import { clientProfileService } from "../../../../services/profiles/client.profile.service";
import { AuthenticatedRequest } from "../../../../types/user.types";
import {
  handleError,
  validateObjectId,
} from "../../../../utils/controller-utils/controller.utils";

/**
 * Client Verification Handlers
 * Handles verification operations for client profiles
 */
export class ClientVerificationHandlers {
  /**
   * PATCH /api/clients/:clientId/verification
   * Update verification status
   */
  async updateVerificationStatus(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { clientId } = req.params;
      const { phoneVerified, emailVerified, idVerified } = req.body;

      if (!validateObjectId(clientId)) {
        res.status(400).json({
          success: false,
          message: "Invalid client ID format",
        });
        return;
      }

      if (
        phoneVerified === undefined &&
        emailVerified === undefined &&
        idVerified === undefined
      ) {
        res.status(400).json({
          success: false,
          message: "At least one verification field is required",
        });
        return;
      }

      const verificationData: any = {};
      if (phoneVerified !== undefined)
        verificationData.phoneVerified = phoneVerified;
      if (emailVerified !== undefined)
        verificationData.emailVerified = emailVerified;
      if (idVerified !== undefined) verificationData.idVerified = idVerified;

      const client = await clientProfileService.updateVerificationStatus(
        clientId,
        verificationData
      );

      res.status(200).json({
        success: true,
        message: "Verification status updated successfully",
        data: {
          client,
          verificationStatus: {
            phoneVerified: client.verificationDetails?.phoneVerified || false,
            emailVerified: client.verificationDetails?.emailVerified || false,
            idVerified: client.verificationDetails?.idVerified || false,
            overallVerified: client.isVerified,
            verifiedAt: client.verificationDetails?.verifiedAt,
          },
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to update verification status");
    }
  }

  /**
   * POST /api/clients/:clientId/verify-phone
   * Verify phone number
   */
  async verifyPhone(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;

      if (!validateObjectId(clientId)) {
        res.status(400).json({
          success: false,
          message: "Invalid client ID format",
        });
        return;
      }

      const client = await clientProfileService.updateVerificationStatus(
        clientId,
        { phoneVerified: true }
      );

      res.status(200).json({
        success: true,
        message: "Phone verified successfully",
        data: { client },
      });
    } catch (error) {
      handleError(res, error, "Failed to verify phone");
    }
  }

  /**
   * POST /api/clients/:clientId/verify-email
   * Verify email
   */
  async verifyEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;

      if (!validateObjectId(clientId)) {
        res.status(400).json({
          success: false,
          message: "Invalid client ID format",
        });
        return;
      }

      const client = await clientProfileService.updateVerificationStatus(
        clientId,
        { emailVerified: true }
      );

      res.status(200).json({
        success: true,
        message: "Email verified successfully",
        data: { client },
      });
    } catch (error) {
      handleError(res, error, "Failed to verify email");
    }
  }

  /**
   * POST /api/clients/:clientId/verify-id
   * Verify ID document
   */
  async verifyId(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;

      if (!validateObjectId(clientId)) {
        res.status(400).json({
          success: false,
          message: "Invalid client ID format",
        });
        return;
      }

      const client = await clientProfileService.updateVerificationStatus(
        clientId,
        { idVerified: true }
      );

      res.status(200).json({
        success: true,
        message: "ID verified successfully",
        data: { client },
      });
    } catch (error) {
      handleError(res, error, "Failed to verify ID");
    }
  }

  /**
   * GET /api/clients/:clientId/verification-status
   * Get verification status
   */
  async getVerificationStatus(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { clientId } = req.params;

      if (!validateObjectId(clientId)) {
        res.status(400).json({
          success: false,
          message: "Invalid client ID format",
        });
        return;
      }

      const stats = await clientProfileService.getClientStats(clientId);

      res.status(200).json({
        success: true,
        message: "Verification status retrieved successfully",
        data: {
          verificationStatus: stats.verificationStatus,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to retrieve verification status");
    }
  }
}

export default new ClientVerificationHandlers();
