// handlers/profiles/client/management.handler.ts
import { Response } from "express";
import {
  clientProfileService,
  PopulationLevel,
} from "../../../../services/profiles/client.profile.service";
import {
  ManageFavoritesRequestBody,
  ManageAddressRequestBody,
  AddPaymentMethodRequestBody,
} from "../../../../types/profiles/client.profile.types";
import { AuthenticatedRequest } from "../../../../types/user.types";
import {
  handleError,
  validateObjectId,
} from "../../../../utils/controller-utils/controller.utils";

/**
 * Client Management Handlers
 * Handles favorites, addresses, payment methods, and preferences
 */
export class ClientManagementHandlers {
  /**
   * POST /api/clients/:clientId/favorites
   * Add or remove favorite services/providers
   */
  async manageFavorites(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { clientId } = req.params;
      const data: ManageFavoritesRequestBody = req.body;

      if (!validateObjectId(clientId)) {
        res.status(400).json({
          success: false,
          message: "Invalid client ID format",
        });
        return;
      }

      if (!data.action || (data.action !== "add" && data.action !== "remove")) {
        res.status(400).json({
          success: false,
          message: "Action must be 'add' or 'remove'",
        });
        return;
      }

      if (!data.serviceId && !data.providerId) {
        res.status(400).json({
          success: false,
          message: "Either serviceId or providerId is required",
        });
        return;
      }

      if (data.serviceId && !validateObjectId(data.serviceId)) {
        res.status(400).json({
          success: false,
          message: "Invalid service ID format",
        });
        return;
      }

      if (data.providerId && !validateObjectId(data.providerId)) {
        res.status(400).json({
          success: false,
          message: "Invalid provider ID format",
        });
        return;
      }

      const client = await clientProfileService.manageFavorites(clientId, data);

      res.status(200).json({
        success: true,
        message: `Favorite ${
          data.action === "add" ? "added" : "removed"
        } successfully`,
        data: { client },
      });
    } catch (error) {
      handleError(res, error, "Failed to manage favorites");
    }
  }

  /**
   * POST /api/clients/me/favorites
   * Manage favorites for current user
   */
  async manageMyFavorites(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?._id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const data: ManageFavoritesRequestBody = req.body;

      // Get client profile
      const clientProfile = await clientProfileService.getClientByUserId(
        userId.toString(),
        PopulationLevel.MINIMAL
      );

      if (!clientProfile) {
        res.status(404).json({
          success: false,
          message: "Client profile not found",
        });
        return;
      }

      const client = await clientProfileService.manageFavorites(
        clientProfile._id.toString(),
        data
      );

      res.status(200).json({
        success: true,
        message: `Favorite ${
          data.action === "add" ? "added" : "removed"
        } successfully`,
        data: { client },
      });
    } catch (error) {
      handleError(res, error, "Failed to manage favorites");
    }
  }

  /**
   * POST /api/clients/:clientId/addresses
   * Manage saved addresses
   */
  async manageAddress(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;
      const data: ManageAddressRequestBody = req.body;

      if (!validateObjectId(clientId)) {
        res.status(400).json({
          success: false,
          message: "Invalid client ID format",
        });
        return;
      }

      if (
        !data.action ||
        !["add", "remove", "set_default"].includes(data.action)
      ) {
        res.status(400).json({
          success: false,
          message: "Action must be 'add', 'remove', or 'set_default'",
        });
        return;
      }

      if (data.action === "add" && !data.address) {
        res.status(400).json({
          success: false,
          message: "Address is required for add action",
        });
        return;
      }

      if (
        (data.action === "remove" || data.action === "set_default") &&
        data.addressIndex === undefined
      ) {
        res.status(400).json({
          success: false,
          message: "Address index is required for this action",
        });
        return;
      }

      const client = await clientProfileService.manageAddress(clientId, data);

      const actionMessages = {
        add: "Address added successfully",
        remove: "Address removed successfully",
        set_default: "Default address updated successfully",
      };

      res.status(200).json({
        success: true,
        message: actionMessages[data.action],
        data: { client },
      });
    } catch (error) {
      handleError(res, error, "Failed to manage address");
    }
  }

  /**
   * POST /api/clients/me/addresses
   * Manage addresses for current user
   */
  async manageMyAddress(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?._id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const data: ManageAddressRequestBody = req.body;

      // Get client profile
      const clientProfile = await clientProfileService.getClientByUserId(
        userId.toString(),
        PopulationLevel.MINIMAL
      );

      if (!clientProfile) {
        res.status(404).json({
          success: false,
          message: "Client profile not found",
        });
        return;
      }

      const client = await clientProfileService.manageAddress(
        clientProfile._id.toString(),
        data
      );

      const actionMessages = {
        add: "Address added successfully",
        remove: "Address removed successfully",
        set_default: "Default address updated successfully",
      };

      res.status(200).json({
        success: true,
        message: actionMessages[data.action],
        data: { client },
      });
    } catch (error) {
      handleError(res, error, "Failed to manage address");
    }
  }

  /**
   * POST /api/clients/:clientId/payment-methods
   * Add payment method
   */
  async addPaymentMethod(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { clientId } = req.params;
      const data: AddPaymentMethodRequestBody = req.body;

      if (!validateObjectId(clientId)) {
        res.status(400).json({
          success: false,
          message: "Invalid client ID format",
        });
        return;
      }

      if (!data.type) {
        res.status(400).json({
          success: false,
          message: "Payment type and details are required",
        });
        return;
      }

      const client = await clientProfileService.addPaymentMethod(
        clientId,
        data
      );

      res.status(200).json({
        success: true,
        message: "Payment method added successfully",
        data: { client },
      });
    } catch (error) {
      handleError(res, error, "Failed to add payment method");
    }
  }

  /**
   * DELETE /api/clients/:clientId/payment-methods/:paymentMethodId
   * Remove payment method
   */
  async removePaymentMethod(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { clientId, paymentMethodId } = req.params;

      if (!validateObjectId(clientId)) {
        res.status(400).json({
          success: false,
          message: "Invalid client ID format",
        });
        return;
      }

      const client = await clientProfileService.removePaymentMethod(
        clientId,
        paymentMethodId
      );

      res.status(200).json({
        success: true,
        message: "Payment method removed successfully",
        data: { client },
      });
    } catch (error) {
      handleError(res, error, "Failed to remove payment method");
    }
  }

  /**
   * PATCH /api/clients/:clientId/communication-preferences
   * Update communication preferences
   */
  async updateCommunicationPreferences(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { clientId } = req.params;
      const preferences = req.body;

      if (!validateObjectId(clientId)) {
        res.status(400).json({
          success: false,
          message: "Invalid client ID format",
        });
        return;
      }

      const client = await clientProfileService.updateCommunicationPreferences(
        clientId,
        preferences
      );

      res.status(200).json({
        success: true,
        message: "Communication preferences updated successfully",
        data: { client },
      });
    } catch (error) {
      handleError(res, error, "Failed to update communication preferences");
    }
  }

  /**
   * PATCH /api/clients/me/communication-preferences
   * Update communication preferences for current user
   */
  async updateMyCommunicationPreferences(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?._id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const preferences = req.body;

      // Get client profile
      const clientProfile = await clientProfileService.getClientByUserId(
        userId.toString(),
        PopulationLevel.MINIMAL
      );

      if (!clientProfile) {
        res.status(404).json({
          success: false,
          message: "Client profile not found",
        });
        return;
      }

      const client = await clientProfileService.updateCommunicationPreferences(
        clientProfile._id.toString(),
        preferences
      );

      res.status(200).json({
        success: true,
        message: "Communication preferences updated successfully",
        data: { client },
      });
    } catch (error) {
      handleError(res, error, "Failed to update communication preferences");
    }
  }

  /**
   * PATCH /api/clients/:clientId/emergency-contact
   * Update emergency contact
   */
  async updateEmergencyContact(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { clientId } = req.params;
      const { name, relationship, phoneNumber } = req.body;

      if (!validateObjectId(clientId)) {
        res.status(400).json({
          success: false,
          message: "Invalid client ID format",
        });
        return;
      }

      if (!name || !relationship || !phoneNumber) {
        res.status(400).json({
          success: false,
          message: "Name, relationship, and phone number are required",
        });
        return;
      }

      const client = await clientProfileService.updateEmergencyContact(
        clientId,
        { name, relationship, phoneNumber }
      );

      res.status(200).json({
        success: true,
        message: "Emergency contact updated successfully",
        data: { client },
      });
    } catch (error) {
      handleError(res, error, "Failed to update emergency contact");
    }
  }

  /**
   * DELETE /api/clients/:clientId/emergency-contact
   * Remove emergency contact
   */
  async removeEmergencyContact(
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

      const client = await clientProfileService.removeEmergencyContact(
        clientId
      );

      res.status(200).json({
        success: true,
        message: "Emergency contact removed successfully",
        data: { client },
      });
    } catch (error) {
      handleError(res, error, "Failed to remove emergency contact");
    }
  }

  /**
   * PATCH /api/clients/:clientId/preferred-categories
   * Update preferred categories
   */
  async updatePreferredCategories(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { clientId } = req.params;
      const { categoryIds } = req.body;

      if (!validateObjectId(clientId)) {
        res.status(400).json({
          success: false,
          message: "Invalid client ID format",
        });
        return;
      }

      if (!Array.isArray(categoryIds)) {
        res.status(400).json({
          success: false,
          message: "Category IDs must be an array",
        });
        return;
      }

      for (const categoryId of categoryIds) {
        if (!validateObjectId(categoryId)) {
          res.status(400).json({
            success: false,
            message: `Invalid category ID: ${categoryId}`,
          });
          return;
        }
      }

      const client = await clientProfileService.updatePreferredCategories(
        clientId,
        categoryIds
      );

      res.status(200).json({
        success: true,
        message: "Preferred categories updated successfully",
        data: { client },
      });
    } catch (error) {
      handleError(res, error, "Failed to update preferred categories");
    }
  }

  /**
   * PATCH /api/clients/:clientId/language-preference
   * Update language preference
   */
  async updateLanguagePreference(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { clientId } = req.params;
      const { language } = req.body;

      if (!validateObjectId(clientId)) {
        res.status(400).json({
          success: false,
          message: "Invalid client ID format",
        });
        return;
      }

      if (!language) {
        res.status(400).json({
          success: false,
          message: "Language is required",
        });
        return;
      }

      const client = await clientProfileService.updateLanguagePreference(
        clientId,
        language
      );

      res.status(200).json({
        success: true,
        message: "Language preference updated successfully",
        data: { client },
      });
    } catch (error) {
      handleError(res, error, "Failed to update language preference");
    }
  }
}

export default new ClientManagementHandlers();
