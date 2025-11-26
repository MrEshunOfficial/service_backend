// services/auth.service.ts
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { User } from "../models/user.model";
import { sendEmail } from "../utils/sendEmail";
import {
  SignupRequestBody,
  LoginRequestBody,
  ResetPasswordRequestBody,
  VerifyEmailRequestBody,
  UpdatePasswordRequestBody,
  ResendVerificationRequestBody,
} from "../types/user.types";
import { SystemRole, AuthProvider } from "../types/base.types";
import {
  getVerificationEmailTemplate,
  getResetPasswordEmailTemplate,
} from "../utils/useEmailTemplate";
import {
  isSuperAdminEmail,
  applySuperAdminProperties,
} from "../utils/controller-utils/controller.utils";

// Helper function to update user security fields
const updateUserSecurity = (user: any, updates: Record<string, any>) => {
  if (!user.security) user.security = {};
  Object.assign(user.security, updates);
};

// Helper function to format user response
export const getUserResponse = (user: any) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  systemRole: user.systemRole,
  isVerified: user.isEmailVerified,
  isAdmin: user.isAdmin,
  isSuperAdmin: user.isSuperAdmin,
  provider: user.authProvider,
  avatar: user.avatar,
  lastLogin: user.security.lastLogin,
  security: user.security,
  createdAt: user.createdAt,
});

export class AuthService {
  // AUTHENTICATION METHODS
  async signup(data: SignupRequestBody) {
    const { name, email, password } = data;

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new Error("USER_EXISTS");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const isSuper = isSuperAdminEmail(email);

    // Create new user
    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashedPassword,
      authProvider: AuthProvider.CREDENTIALS,
      verificationToken,
      verificationExpires: new Date(Date.now() + 60 * 60 * 1000),
      lastLogin: new Date(),
      security: { lastLoginAt: new Date() },
    });

    // Apply super admin properties if applicable
    if (isSuper) {
      applySuperAdminProperties(newUser);
      newUser.isEmailVerified = true;
      newUser.verificationToken = undefined;
      newUser.verificationExpires = undefined;
    }

    await newUser.save();

    // Send verification email for non-super admins
    if (!isSuper) {
      try {
        await sendEmail({
          to: email,
          subject: "Verify Your Email Address",
          html: getVerificationEmailTemplate(name, verificationToken),
        });
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        // Don't throw - user creation succeeded
      }
    }

    return newUser;
  }

  async login(data: LoginRequestBody) {
    const { email, password } = data;

    // Find user with password field
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );

    if (
      !user ||
      user.authProvider !== AuthProvider.CREDENTIALS ||
      !user.password
    ) {
      throw new Error("INVALID_CREDENTIALS");
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error("INVALID_CREDENTIALS");
    }

    // Check email verification
    if (!user.isEmailVerified && !user.isSuperAdmin) {
      const error: any = new Error("EMAIL_NOT_VERIFIED");
      error.email = user.email;
      throw error;
    }

    // Update last login
    user.security.lastLogin = new Date();
    updateUserSecurity(user, { lastLoginAt: new Date() });
    await user.save();

    return user;
  }

  async logout(userId: string) {
    try {
      const user = await User.findById(userId);
      if (user) {
        updateUserSecurity(user, { lastLoggedOut: new Date() });
        await user.save();
      }
    } catch (updateError) {
      console.error("Failed to update logout timestamp:", updateError);
      // Don't throw - logout should still succeed
    }
  }

  // EMAIL VERIFICATION METHODS
  async verifyEmail(data: VerifyEmailRequestBody) {
    const { token } = data;

    const user = await User.findOne({
      verificationToken: token,
      verificationExpires: { $gt: new Date() },
    }).select("+verificationToken +verificationExpires");

    if (!user) {
      throw new Error("INVALID_TOKEN");
    }

    user.isEmailVerified = true;
    user.verificationToken = undefined;
    user.verificationExpires = undefined;
    await user.save();

    return user;
  }

  async resendVerification(data: ResendVerificationRequestBody) {
    const { email } = data;

    const user = await User.findOne({ email: email.toLowerCase() });

    // Return success even if user doesn't exist (security)
    if (!user) {
      return { success: true, sent: false };
    }

    if (user.isEmailVerified) {
      throw new Error("EMAIL_ALREADY_VERIFIED");
    }

    if (user.authProvider !== AuthProvider.CREDENTIALS) {
      throw new Error("OAUTH_NO_VERIFICATION");
    }

    // Generate new token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.verificationToken = verificationToken;
    user.verificationExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    // Send email
    try {
      await sendEmail({
        to: user.email,
        subject: "Verify Your Email Address",
        html: getVerificationEmailTemplate(user.name, verificationToken),
      });
      return { success: true, sent: true };
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      throw new Error("EMAIL_SEND_FAILED");
    }
  }

  // PASSWORD MANAGEMENT METHODS
  async forgotPassword(data: ResetPasswordRequestBody) {
    const { email } = data;

    const user = await User.findOne({ email: email.toLowerCase() });

    // Return success even if user doesn't exist (security)
    if (!user) {
      return { success: true, sent: false };
    }

    if (user.authProvider !== AuthProvider.CREDENTIALS) {
      throw new Error("OAUTH_NO_PASSWORD");
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    // Send email
    try {
      await sendEmail({
        to: user.email,
        subject: "Password Reset Request",
        html: getResetPasswordEmailTemplate(user.name, resetToken),
      });
      return { success: true, sent: true };
    } catch (emailError) {
      console.error("Failed to send reset email:", emailError);
      // Rollback token
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      throw new Error("EMAIL_SEND_FAILED");
    }
  }

  async resetPassword(data: UpdatePasswordRequestBody) {
    const { token, password } = data;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    }).select("+resetPasswordToken +resetPasswordExpires");

    if (!user) {
      throw new Error("INVALID_TOKEN");
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    updateUserSecurity(user, { passwordChangedAt: new Date() });
    await user.save();

    return user;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ) {
    const user = await User.findById(userId).select("+password");
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    if (user.authProvider !== AuthProvider.CREDENTIALS || !user.password) {
      throw new Error("OAUTH_NO_PASSWORD_CHANGE");
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      throw new Error("INVALID_CURRENT_PASSWORD");
    }

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    updateUserSecurity(user, { passwordChangedAt: new Date() });
    await user.save();

    return user;
  }

  // TOKEN MANAGEMENT
  async refreshToken(userId: string) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }
    return user;
  }

  // ACCOUNT MANAGEMENT
  async deleteAccount(userId: string) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    await user.softDelete();
    return user;
  }

  async restoreAccount(email: string) {
    const user = await User.findOne({ email: email.toLowerCase() }, null, {
      includeSoftDeleted: true,
    });

    if (!user || !user.isDeleted) {
      throw new Error("DELETED_ACCOUNT_NOT_FOUND");
    }

    await user.restore();
    return user;
  }

  async permanentlyDeleteAccount(userId: string) {
    const user = await User.findById(userId, null, {
      includeSoftDeleted: true,
    });

    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    await user.deleteOne();
    return user;
  }

  // ADMIN METHODS
  async getAllUsers(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    role?: string;
  }) {
    const { page = 1, limit = 10, search, status, role } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const dbQuery: any = {};

    if (search) {
      dbQuery.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (status) dbQuery.status = status;
    if (role) dbQuery.systemRole = role;

    const [users, total] = await Promise.all([
      User.find(dbQuery)
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 }),
      User.countDocuments(dbQuery),
    ]);

    return {
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    };
  }

  async updateUserRole(userId: string, systemRole: SystemRole) {
    if (!Object.values(SystemRole).includes(systemRole)) {
      throw new Error("INVALID_ROLE");
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    user.systemRole = systemRole;
    await user.save();

    return user;
  }

  async getUserById(userId: string) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }
    return user;
  }

  async deleteUser(userId: string, adminId?: string) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    await user.softDelete(adminId);
    return user;
  }

  async restoreUser(userId: string) {
    const user = await User.findById(userId, null, {
      includeSoftDeleted: true,
    });

    if (!user || !user.isDeleted) {
      throw new Error("DELETED_USER_NOT_FOUND");
    }

    await user.restore();
    return user;
  }
}

export const authService = new AuthService();
