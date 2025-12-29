// utils/generateTokenAndSetCookie.ts
import jwt from "jsonwebtoken";
import { Response } from "express";

interface TokenOptions {
  isEmailVerified?: boolean;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}

export const generateTokenAndSetCookie = (
  res: Response,
  userId: string,
  options?: TokenOptions
): string => {
  // Create JWT payload with all necessary fields
  const payload = {
    userId,
    isEmailVerified: options?.isEmailVerified || false,
    isAdmin: options?.isAdmin || false,
    isSuperAdmin: options?.isSuperAdmin || false,
  };

  console.log('🔐 Generating JWT token with payload:', payload);

  const token = jwt.sign(
    payload,
    process.env.JWT_SECRET as string,
    {
      expiresIn: "7d",
    }
  );

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return token;
};

