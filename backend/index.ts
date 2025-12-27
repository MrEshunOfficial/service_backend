// index.ts
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectDB } from "./database/connectDB";
import oauthRoutes from "./routes/oauth.routes";
import authRoutes from "./routes/auth.routes";
import profileRoutes from "./routes/profiles/userProfile.routes";
import serviceRoutes from "./routes/service.routes";

import {
  initCloudinaryService,
  CloudinaryConfigService,
} from "./config/cloudinary.config";
import fileRoutes from "./routes/files.routes";
import categoryRoutes from "./routes/category.routes";
import providerProfileRoutes from "./routes/profiles/provider.profile.routes";

// import taskRoutes from "./routes/task.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const isDevelopment = process.env.NODE_ENV !== "production";
const PAYLOAD_LIMIT = "5mb";

// CORS configuration
app.use(
  cors({
    origin: isDevelopment ? "http://localhost:3000" : process.env.CLIENT_URL,
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json({ limit: PAYLOAD_LIMIT }));
app.use(express.urlencoded({ limit: PAYLOAD_LIMIT, parameterLimit: 50000 }));

// Cookie parser middleware
app.use(cookieParser());

// Public read-only access (GET only) - no auth needed
app.use("/uploads/public", express.static("uploads/public"));

// Initialize Cloudinary service and start server
let cloudinaryService: CloudinaryConfigService;

async function startServer() {
  try {
    // Connect to database
    await connectDB();
    console.log("✓ Database connected");

    // Initialize Cloudinary service
    cloudinaryService = initCloudinaryService();
    console.log("✓ Cloudinary service initialized");

    // Mount routes
    app.use("/api/oauth", oauthRoutes);
    app.use("/api/auth", authRoutes);
    app.use("/api/files", fileRoutes);
    app.use("/api/profiles", profileRoutes);
    app.use("/api/categories", categoryRoutes);
    app.use("/api/services", serviceRoutes);
    app.use("/api/providers", providerProfileRoutes);

    // Error handling middleware
    app.use(
      (
        err: any,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ) => {
        console.error(err.stack);

        // Handle Multer file size errors
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            success: false,
            message: "File too large. Maximum file size is 100MB.",
            error: "FILE_TOO_LARGE",
          });
        }

        // Handle Multer file type errors
        if (err.message && err.message.includes("File type")) {
          return res.status(400).json({
            success: false,
            message: err.message,
            error: "INVALID_FILE_TYPE",
          });
        }

        // Handle payload/file size errors
        if (err.type === "entity.too.large") {
          return res.status(413).json({
            success: false,
            message:
              "Request payload too large. Please use a smaller image (max 5MB).",
            error: "PAYLOAD_TOO_LARGE",
          });
        }

        // Handle JSON parsing errors
        if (err.type === "entity.parse.failed") {
          return res.status(400).json({
            success: false,
            message: "Invalid JSON data",
            error: "INVALID_JSON",
          });
        }

        // Generic error
        res.status(500).json({
          success: false,
          message: "Something went wrong!",
          error: isDevelopment ? err.message : undefined,
        });
      }
    );

    // Start server
    app.listen(PORT, () => {
      console.log(`✓ Server is running on port: ${PORT}`);
      console.log(
        `Environment: ${isDevelopment ? "Development" : "Production"}`
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the application
startServer();

// Export for testing or other uses
export { app, cloudinaryService };
