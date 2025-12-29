// services/task-matching.service.ts

import { Types } from "mongoose";
import { ProviderModel } from "../../models/profiles/provider.model";
import { ServiceModel } from "../../models/service.model";
import { UserLocation } from "../../types/base.types";
import {
  TaskMatchingConfig,
  Task,
  ProviderMatchResult,
  TaskStatus,
} from "../../types/tasks.types";

/**
 * Service responsible for matching tasks to providers
 */
export class TaskMatchingService {
  private defaultConfig: TaskMatchingConfig = {
    maxDistanceKm: 20,
    prioritizeNearby: true,
    weights: {
      titleMatch: 30,
      descriptionMatch: 25,
      tagMatch: 25,
      categoryMatch: 15,
      locationProximity: 5,
    },
    minimumMatchScore: 40,
    maxProvidersToReturn: 20,
    fallbackToLocationOnly: true,
    fallbackThreshold: 3,
  };

  /**
   * Main matching orchestrator
   * Tries intelligent matching first, falls back to location-only if needed
   */
  async findMatchesForTask(
    task: Partial<Task>,
    strategy: "intelligent" | "location-only" = "intelligent",
    config?: Partial<TaskMatchingConfig>
  ): Promise<{
    matches: ProviderMatchResult[];
    strategy: "intelligent" | "location-only";
    metadata: {
      totalMatches: number;
      averageMatchScore: number;
      searchTermsUsed: string[];
      fallbackTriggered: boolean;
    };
  }> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    let matches: ProviderMatchResult[] = [];
    let searchTerms: string[] = [];
    let fallbackTriggered = false;

    // Try intelligent matching first
    if (strategy === "intelligent") {
      const intelligentResult = await this.intelligentMatching(
        task,
        mergedConfig
      );
      matches = intelligentResult.matches;
      searchTerms = intelligentResult.searchTerms;

      // Fallback to location-only if too few matches
      if (
        mergedConfig.fallbackToLocationOnly &&
        matches.length < mergedConfig.fallbackThreshold!
      ) {
        console.log(
          `Only ${matches.length} intelligent matches found. Falling back to location-only.`
        );
        const locationResult = await this.locationOnlyMatching(
          task,
          mergedConfig
        );
        matches = locationResult.matches;
        strategy = "location-only";
        fallbackTriggered = true;
      }
    } else {
      // Direct location-only matching
      const locationResult = await this.locationOnlyMatching(
        task,
        mergedConfig
      );
      matches = locationResult.matches;
    }

    // Calculate average match score
    const averageMatchScore =
      matches.length > 0
        ? matches.reduce((sum, m) => sum + m.matchScore, 0) / matches.length
        : 0;

    return {
      matches,
      strategy,
      metadata: {
        totalMatches: matches.length,
        averageMatchScore: Math.round(averageMatchScore),
        searchTermsUsed: searchTerms,
        fallbackTriggered,
      },
    };
  }

  /**
   * Intelligent matching - finds providers based on service relevance
   * ✅ FIXED: No text search dependency, handles providerId as array
   */
  private async intelligentMatching(
    task: Partial<Task>,
    config: TaskMatchingConfig
  ): Promise<{
    matches: ProviderMatchResult[];
    searchTerms: string[];
  }> {
    // Extract search terms from task
    const searchTerms = this.extractSearchTerms(task);

    if (searchTerms.length === 0) {
      console.log("No search terms extracted. Skipping intelligent matching.");
      return { matches: [], searchTerms: [] };
    }

    // Find relevant services
    const relevantServices = await this.findRelevantServices(task, searchTerms);

    if (relevantServices.length === 0) {
      console.log("No relevant services found.");
      return { matches: [], searchTerms };
    }

    // Group services by provider
    const servicesByProvider = this.groupServicesByProvider(relevantServices);

    if (servicesByProvider.size === 0) {
      console.log("No valid providers found in services.");
      return { matches: [], searchTerms };
    }

    // Get providers in customer's location
    const providers = await this.getProvidersInLocation(
      Array.from(servicesByProvider.keys()),
      task.customerLocation!
    );

    // Calculate match scores for each provider
    const matches = providers
      .map((provider) => {
        const providerServices =
          servicesByProvider.get(provider._id.toString()) || [];
        return this.calculateIntelligentMatchScore(
          task,
          provider,
          providerServices,
          config
        );
      })
      .filter((m) => m.matchScore >= config.minimumMatchScore!)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, config.maxProvidersToReturn);

    return { matches, searchTerms };
  }

  /**
   * Location-only matching - shows all providers in customer's area
   */
  private async locationOnlyMatching(
    task: Partial<Task>,
    config: TaskMatchingConfig
  ): Promise<{
    matches: ProviderMatchResult[];
  }> {
    // Get all providers in customer's location
    const providers = await ProviderModel.find({
      $or: [
        { "locationData.locality": task.customerLocation?.locality },
        { "locationData.city": task.customerLocation?.city },
        { "locationData.region": task.customerLocation?.region },
      ],
      isDeleted: { $ne: true },
    }).lean();

    // Calculate simple location-based scores
    const matches = providers
      .map((provider) =>
        this.calculateLocationMatchScore(task, provider, config)
      )
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, config.maxProvidersToReturn);

    return { matches };
  }

  /**
   * Extract meaningful search terms from task title and description
   */
  private extractSearchTerms(task: Partial<Task>): string[] {
    const text = `${task.title || ""} ${task.description || ""}`.toLowerCase();

    // Common stop words to filter out
    const stopWords = new Set([
      "the",
      "and",
      "for",
      "with",
      "need",
      "want",
      "looking",
      "find",
      "someone",
      "help",
      "can",
      "will",
      "would",
      "should",
      "could",
      "have",
      "has",
      "had",
      "this",
      "that",
      "these",
      "those",
      "who",
      "what",
      "where",
      "when",
      "why",
      "how",
    ]);

    // Extract words (minimum 3 characters)
    const words = text
      .split(/\s+/)
      .map((w) => w.replace(/[^\w]/g, ""))
      .filter((w) => w.length >= 3)
      .filter((w) => !stopWords.has(w));

    // Remove duplicates and return
    return Array.from(new Set(words));
  }

  /**
   * Find services that match the task
   * ✅ FIXED: Uses regex instead of text search, no populate on providerId
   */
  private async findRelevantServices(
    task: Partial<Task>,
    searchTerms: string[]
  ): Promise<any[]> {
    const searchQuery: any = {
      isActive: true,
      deletedAt: null, // ✅ Fixed: Use deletedAt instead of isDeleted
    };

    const orConditions: any[] = [];

    // ✅ FIXED: Regex-based keyword matching instead of text search
    if (searchTerms.length > 0) {
      const keywordRegex = searchTerms.map(k => new RegExp(k, 'i'));
      orConditions.push(
        { title: { $in: keywordRegex } },
        { description: { $in: keywordRegex } },
        { tags: { $in: searchTerms } }
      );
    }

    // Tag matching
    if (task.tags && task.tags.length > 0) {
      orConditions.push({
        tags: { $in: task.tags },
      });
    }

    // Category matching
    if (task.category) {
      orConditions.push({
        categoryId: task.category,
      });
    }

    // If no search criteria, return empty
    if (orConditions.length === 0) {
      console.log("No search criteria provided");
      return [];
    }

    searchQuery.$or = orConditions;

    // ✅ FIXED: Don't populate providerId - keep as ObjectIds
    const services = await ServiceModel.find(searchQuery).lean();

    // ✅ FIXED: Filter services with valid providerIds (handle array)
    return services.filter((s) => {
      if (!s.providerId || !Array.isArray(s.providerId)) {
        return false;
      }
      // Check if array has at least one valid ObjectId
      return s.providerId.some(
        pid => pid && typeof pid === 'object' && pid.toString().length === 24
      );
    });
  }

  /**
   * Group services by provider ID
   * ✅ FIXED: Handles providerId as array
   */
  private groupServicesByProvider(services: any[]): Map<string, any[]> {
    const grouped = new Map<string, any[]>();

    for (const service of services) {
      // ✅ FIXED: Handle providerId as array
      if (service.providerId && Array.isArray(service.providerId)) {
        for (const pid of service.providerId) {
          // Validate each provider ID
          if (pid && typeof pid === 'object' && pid.toString && pid.toString().length === 24) {
            const providerIdString = pid.toString();
            if (!grouped.has(providerIdString)) {
              grouped.set(providerIdString, []);
            }
            grouped.get(providerIdString)!.push(service);
          }
        }
      }
    }

    return grouped;
  }

  /**
   * Get providers in customer's location
   */
  private async getProvidersInLocation(
    providerIds: string[],
    customerLocation: UserLocation
  ): Promise<any[]> {
    // ✅ Added validation for provider IDs
    const validProviderIds = providerIds.filter(id => id && id.length === 24);

    if (validProviderIds.length === 0) {
      console.log("No valid provider IDs to query");
      return [];
    }

    return ProviderModel.find({
      _id: { $in: validProviderIds },
      $or: [
        { "locationData.locality": customerLocation.locality },
        { "locationData.city": customerLocation.city },
        { "locationData.region": customerLocation.region },
      ],
      isDeleted: { $ne: true },
    }).lean();
  }

  /**
   * Calculate intelligent match score for a provider
   */
  private calculateIntelligentMatchScore(
    task: Partial<Task>,
    provider: any,
    services: any[],
    config: TaskMatchingConfig
  ): ProviderMatchResult {
    const weights = config.weights!;
    const scores = {
      titleScore: 0,
      descriptionScore: 0,
      tagScore: 0,
      categoryScore: 0,
      locationScore: 0,
    };

    // Title matching (check if service titles contain task keywords)
    const taskTerms = this.extractSearchTerms(task);
    const serviceTitles = services.map((s) => s.title.toLowerCase()).join(" ");

    const titleMatches = taskTerms.filter((term) =>
      serviceTitles.includes(term)
    );
    scores.titleScore =
      (titleMatches.length / Math.max(taskTerms.length, 1)) *
      weights.titleMatch;

    // Description matching
    const serviceDescriptions = services
      .map((s) => s.description?.toLowerCase() || "")
      .join(" ");

    const descMatches = taskTerms.filter((term) =>
      serviceDescriptions.includes(term)
    );
    scores.descriptionScore =
      (descMatches.length / Math.max(taskTerms.length, 1)) *
      weights.descriptionMatch;

    // Tag matching
    if (task.tags && task.tags.length > 0) {
      const serviceTags = services.flatMap((s) => s.tags || []);
      const matchingTags = task.tags.filter((tag) =>
        serviceTags.some((st: string) => st.toLowerCase() === tag.toLowerCase())
      );
      scores.tagScore =
        (matchingTags.length / task.tags.length) * weights.tagMatch;
    }

    // Category matching
    if (task.category) {
      const categoryMatch = services.some(
        (s) => s.categoryId?.toString() === task.category?.toString()
      );
      if (categoryMatch) {
        scores.categoryScore = weights.categoryMatch;
      }
    }

    // Location proximity scoring
    scores.locationScore = this.calculateLocationScore(
      task.customerLocation!,
      provider.locationData,
      weights.locationProximity
    );

    // Calculate total score
    const totalScore = Math.round(
      scores.titleScore +
        scores.descriptionScore +
        scores.tagScore +
        scores.categoryScore +
        scores.locationScore
    );

    // Build match reasons
    const matchReasons = this.buildMatchReasons(
      provider,
      services,
      scores,
      task.customerLocation!
    );

    return {
      providerId: provider._id,
      matchScore: Math.min(totalScore, 100),
      matchedServices: services.map((s) => s._id),
      matchReasons,
      distance: undefined, // Can be calculated if GPS coordinates available
      scoreBreakdown: scores,
    };
  }

  /**
   * Calculate location-based match score
   */
  private calculateLocationMatchScore(
    task: Partial<Task>,
    provider: any,
    config: TaskMatchingConfig
  ): ProviderMatchResult {
    const scores = {
      titleScore: 0,
      descriptionScore: 0,
      tagScore: 0,
      categoryScore: 0,
      locationScore: 0,
    };

    // Location match (100% of score)
    if (provider.locationData?.locality === task.customerLocation?.locality) {
      scores.locationScore = 100;
    } else if (provider.locationData?.city === task.customerLocation?.city) {
      scores.locationScore = 70;
    } else if (
      provider.locationData?.region === task.customerLocation?.region
    ) {
      scores.locationScore = 50;
    }

    const matchReasons = ["Available in your area"];

    // Add bonus reasons
    if (provider.isCompanyTrained) {
      matchReasons.push("Company trained");
    }
    if (provider.isAlwaysAvailable) {
      matchReasons.push("Available anytime");
    }
    if (provider.locationData?.isAddressVerified) {
      matchReasons.push("Verified address");
    }

    return {
      providerId: provider._id,
      matchScore: Math.round(scores.locationScore),
      matchedServices: [],
      matchReasons,
      distance: undefined,
      scoreBreakdown: scores,
    };
  }

  /**
   * Calculate location proximity score
   */
  private calculateLocationScore(
    customerLocation: UserLocation,
    providerLocation: any,
    maxScore: number
  ): number {
    if (providerLocation?.locality === customerLocation.locality) {
      return maxScore; // Same locality = full points
    } else if (providerLocation?.city === customerLocation.city) {
      return maxScore * 0.7; // Same city = 70%
    } else if (providerLocation?.region === customerLocation.region) {
      return maxScore * 0.5; // Same region = 50%
    }
    return 0;
  }

  /**
   * Build human-readable match reasons
   */
  private buildMatchReasons(
    provider: any,
    services: any[],
    scores: any,
    customerLocation: UserLocation
  ): string[] {
    const reasons: string[] = [];

    // Service relevance
    if (services.length > 0) {
      reasons.push(`Offers ${services.length} relevant service(s)`);
    }

    // Score-based reasons
    if (scores.titleScore > 15) {
      reasons.push("Service titles match your needs");
    }

    if (scores.tagScore > 10) {
      reasons.push("Service tags match your requirements");
    }

    if (scores.categoryScore > 0) {
      reasons.push("Service category matches");
    }

    // Location reasons
    if (provider.locationData?.locality === customerLocation.locality) {
      reasons.push(`Located in ${customerLocation.locality}`);
    } else if (provider.locationData?.city === customerLocation.city) {
      reasons.push(`Located in ${customerLocation.city}`);
    } else if (provider.locationData?.region === customerLocation.region) {
      reasons.push(`Serves ${customerLocation.region}`);
    }

    // Provider attributes
    if (provider.isCompanyTrained) {
      reasons.push("Company trained");
    }

    if (provider.isAlwaysAvailable) {
      reasons.push("Available anytime");
    }

    if (provider.locationData?.isAddressVerified) {
      reasons.push("Verified address");
    }

    return reasons.length > 0 ? reasons : ["Available in your area"];
  }

  /**
   * Get floating tasks that a provider might be interested in
   */
  async getFloatingTasksForProvider(
    providerId: Types.ObjectId,
    providerLocation: UserLocation,
    limit: number = 20
  ): Promise<Partial<Task>[]> {
    const TaskModel = (await import("../../models/task.model")).default;

    // Get floating tasks in provider's location
    const floatingTasks = await TaskModel.find({
      status: TaskStatus.FLOATING,
      isDeleted: { $ne: true },
      $or: [
        { "customerLocation.locality": providerLocation.locality },
        { "customerLocation.city": providerLocation.city },
        { "customerLocation.region": providerLocation.region },
      ],
      $and: [
        {
          $or: [
            { expiresAt: { $gt: new Date() } },
            { expiresAt: null }
          ]
        }
      ],
      // Exclude tasks where provider already expressed interest
      "interestedProviders.providerId": { $ne: providerId },
    })
      .populate("customerId", "name email")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return floatingTasks;
  }

  /**
   * Check if a provider is suitable for a specific task
   */
  async isProviderSuitableForTask(
    providerId: Types.ObjectId,
    taskId: Types.ObjectId
  ): Promise<{
    suitable: boolean;
    matchScore?: number;
    reasons: string[];
  }> {
    const TaskModel = (await import("../../models/task.model")).default;
    const task = await TaskModel.findById(taskId).lean();

    if (!task) {
      return {
        suitable: false,
        reasons: ["Task not found"],
      };
    }

    const provider = await ProviderModel.findById(providerId).lean();

    if (!provider) {
      return {
        suitable: false,
        reasons: ["Provider not found"],
      };
    }

    // Check if already in matched or interested list
    const isMatched = task.matchedProviders?.some(
      (mp) => mp.providerId.toString() === providerId.toString()
    );

    const isInterested = task.interestedProviders?.some(
      (ip) => ip.providerId.toString() === providerId.toString()
    );

    if (isMatched) {
      return {
        suitable: true,
        reasons: ["Already matched to this task"],
      };
    }

    if (isInterested) {
      return {
        suitable: true,
        reasons: ["Already expressed interest"],
      };
    }

    // For floating tasks, check location proximity
    const locationMatch =
      provider.locationData?.locality === task.customerLocation.locality ||
      provider.locationData?.city === task.customerLocation.city ||
      provider.locationData?.region === task.customerLocation.region;

    if (!locationMatch) {
      return {
        suitable: false,
        reasons: ["Outside service area"],
      };
    }

    // Try to find matching services
    const searchTerms = this.extractSearchTerms(task);
    const services = await ServiceModel.find({
      providerId: providerId, // Note: This might need to be $in if providerId is array
      isActive: true,
      deletedAt: null,
    }).lean();

    if (services.length === 0) {
      return {
        suitable: true,
        matchScore: 50,
        reasons: ["In service area", "No specific service match"],
      };
    }

    // Calculate relevance score
    const matchResult = this.calculateIntelligentMatchScore(
      task,
      provider,
      services,
      this.defaultConfig
    );

    return {
      suitable: true,
      matchScore: matchResult.matchScore,
      reasons: matchResult.matchReasons,
    };
  }
}

// Export singleton instance
export const taskMatchingService = new TaskMatchingService();