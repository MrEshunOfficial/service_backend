// services/oauth.service.ts
import { User } from "../models/user.model";
import { SystemRole, AuthProvider } from "../types/base.types";
import { OAuthUserData } from "../types/user.types";

import { verifyGoogleToken, verifyAppleToken } from "../utils/oath.utils";

interface OAuthResult {
  user: {
    id: any;
    name: string;
    email: string;
    systemRole: SystemRole;
    isEmailVerified: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    authProvider: AuthProvider;
  };
  hasProfile: boolean;
  isNewUser: boolean;
}

interface LinkProviderResult {
  user: {
    id: any;
    name: string;
    email: string;
    authProvider: AuthProvider;
    isEmailVerified: boolean;
    systemRole: SystemRole;
    isAdmin: boolean;
    isSuperAdmin: boolean;
  };
}

class OAuthService {
  // Helper function to check if email is super admin
  private isSuperAdminEmail(email: string): boolean {
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    if (!superAdminEmail) {
      console.warn("SUPER_ADMIN_EMAIL environment variable is not set");
      return false;
    }
    return email.toLowerCase() === superAdminEmail.toLowerCase();
  }

  // Helper function to apply super admin properties
  private applySuperAdminProperties(userDoc: any): any {
    userDoc.systemRole = SystemRole.SUPER_ADMIN;
    userDoc.systemAdminName =
      process.env.SUPER_ADMIN_NAME || "System Administrator";
    userDoc.isSuperAdmin = true;
    userDoc.isAdmin = true;
    userDoc.isEmailVerified = true;
    return userDoc;
  }

  // Verify and extract user data from Google token
  async verifyGoogleUser(idToken: string): Promise<OAuthUserData> {
    const googleUser = await verifyGoogleToken(idToken);

    return {
      email: googleUser.email,
      name: googleUser.name,
      avatar: googleUser.avatar || undefined,
      providerId: googleUser.id,
      provider: "google",
    };
  }

  // Verify and extract user data from Apple token
  async verifyAppleUser(
    idToken: string,
    appleUserData?: { name?: { firstName: string; lastName: string } }
  ): Promise<OAuthUserData> {
    const appleUser = await verifyAppleToken(idToken);

    // Apple sometimes provides user data separately
    let userName = appleUser.name;
    if (appleUserData?.name) {
      userName = `${appleUserData.name.firstName} ${appleUserData.name.lastName}`;
    }

    return {
      email: appleUser.email,
      name: userName,
      providerId: appleUser.id,
      provider: "apple",
    };
  }

  // Generic OAuth authentication handler
  async authenticateWithOAuth(
    provider: "google" | "apple",
    userData: OAuthUserData
  ): Promise<OAuthResult> {
    // Check if super admin email
    const isSuper = this.isSuperAdminEmail(userData.email);

    // Check if user exists
    let user = await User.findOne({
      $or: [
        { email: userData.email },
        { authProvider: provider, authProviderId: userData.providerId },
      ],
    });

    let isNewUser = false;

    if (user) {
      // User exists, update provider info if needed
      if (user.authProvider === AuthProvider.CREDENTIALS) {
        // Link OAuth account to existing email-based account
        user.authProvider = provider as AuthProvider;
        user.authProviderId = userData.providerId;
        user.isEmailVerified = true;
      }

      // Apply super admin properties if needed and not already set
      if (isSuper && !user.isSuperAdmin) {
        this.applySuperAdminProperties(user);
      }

      // Update security tracking
      user.security = {
        ...user.security,
        lastLogin: new Date(),
      };

      await user.save();
    } else {
      // Create new user
      isNewUser = true;
      console.log(`Creating new ${provider} user: ${userData.email}`);

      const newUserData: any = {
        name: userData.name,
        email: userData.email,
        authProvider: provider as AuthProvider,
        authProviderId: userData.providerId,
        isEmailVerified: true, // OAuth users are verified by default
        security: {
          lastLogin: new Date(),
        },
      };

      user = new User(newUserData);

      // Apply super admin properties if needed
      if (isSuper) {
        this.applySuperAdminProperties(user);
      }

      await user.save();
    }

    // Prepare response data
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      systemRole: user.systemRole,
      isEmailVerified: user.isEmailVerified,
      isAdmin: user.isAdmin,
      isSuperAdmin: user.isSuperAdmin,
      authProvider: user.authProvider,
    };

    return {
      user: userResponse,
      hasProfile: !!user.profileId,
      isNewUser,
    };
  }

  // Link OAuth provider to existing user account
  async linkProviderToUser(
    userId: string,
    provider: "google" | "apple",
    idToken: string
  ): Promise<LinkProviderResult> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    let providerUser: {
      id: any;
      avatar?: any;
      email?: any;
      name?: any;
      emailVerified?: boolean | undefined;
    };

    // Verify provider token
    if (provider === "google") {
      providerUser = await verifyGoogleToken(idToken);
    } else if (provider === "apple") {
      providerUser = await verifyAppleToken(idToken);
    } else {
      throw new Error(
        "Invalid provider. Supported providers are 'google' and 'apple'"
      );
    }

    // Check if provider account is already linked to another user
    const existingUser = await User.findOne({
      authProvider: provider as AuthProvider,
      authProviderId: providerUser.id,
      _id: { $ne: userId },
    });

    if (existingUser) {
      throw new Error("This account is already linked to another user");
    }

    // Check if super admin email and apply properties if needed
    const isSuper = this.isSuperAdminEmail(user.email);
    if (isSuper && !user.isSuperAdmin) {
      this.applySuperAdminProperties(user);
    }

    // Link the provider account
    user.authProvider = provider as AuthProvider;
    user.authProviderId = providerUser.id;
    user.isEmailVerified = true; // Linking OAuth makes account verified

    await user.save();

    // Prepare response
    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        authProvider: user.authProvider,
        isEmailVerified: user.isEmailVerified,
        systemRole: user.systemRole,
        isAdmin: user.isAdmin,
        isSuperAdmin: user.isSuperAdmin,
      },
    };
  }
}

export const oAuthService = new OAuthService();
