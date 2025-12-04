// services/task-matching.service.ts
import { Types } from "mongoose";
import { TaskModel } from "../models/task.model";
import { Service } from "../types/service.types";
import { ProviderModel } from "../models/profiles/provider.model";
import { ProviderProfile } from "../types/providerProfile.types";
import { Task, TaskMatchingResult, ProviderMatch } from "../types/tasks.types";

/**
 * Task Matching Service
 * Handles the core matching algorithm between tasks and providers
 */
export class TaskMatchingService {
  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate category match score
   */
  private static calculateCategoryMatch(
    task: Task,
    providerServices: Service[]
  ): { score: number; matchingServices: Service[] } {
    const matchingServices = providerServices.filter(
      (service) =>
        service.categoryId.toString() === task.categoryId.toString() &&
        service.isActive &&
        !service.deletedAt
    );

    const score = matchingServices.length > 0 ? 30 : 0;
    return { score, matchingServices };
  }

  /**
   * Calculate location match score
   */
  private static calculateLocationMatch(
    task: Task,
    provider: ProviderProfile
  ): { score: number; distance: number | undefined } {
    // Remote tasks get full score
    if (task.isRemoteTask) {
      return { score: 25, distance: undefined };
    }

    let score = 0;
    let distance: number | undefined = undefined;

    // Calculate GPS distance if both have coordinates
    if (
      task.taskLocation.gpsCoordinates &&
      provider.locationData.gpsCoordinates
    ) {
      distance = this.calculateDistance(
        task.taskLocation.gpsCoordinates.latitude,
        task.taskLocation.gpsCoordinates.longitude,
        provider.locationData.gpsCoordinates.latitude,
        provider.locationData.gpsCoordinates.longitude
      );

      // Score based on distance
      if (distance <= 5) score = 25; // Within 5km
      else if (distance <= 10) score = 20; // Within 10km
      else if (distance <= 20) score = 15; // Within 20km
      else if (distance <= 50) score = 10; // Within 50km
      else if (distance <= 100) score = 5; // Within 100km

      // Check if within max travel distance
      if (task.maxTravelDistance && distance > task.maxTravelDistance) {
        score = 0;
      }
    } else {
      // Fallback to region/city matching
      if (provider.locationData.region === task.taskLocation.region) {
        score += 15;
        if (provider.locationData.city === task.taskLocation.city) {
          score += 10;
        }
      }
    }

    return { score, distance };
  }

  /**
   * Calculate skills match score
   */
  private static calculateSkillsMatch(
    task: Task,
    providerServices: Service[]
  ): { score: number; matchingSkills: string[] } {
    if (task.requirements.skillsNeeded.length === 0) {
      return { score: 20, matchingSkills: [] };
    }

    // Extract all tags from provider's services
    const providerSkills = new Set(
      providerServices.flatMap((service) => service.tags)
    );

    // Find matching skills
    const matchingSkills = task.requirements.skillsNeeded.filter((skill) =>
      providerSkills.has(skill.toLowerCase())
    );

    // Calculate percentage match
    const matchPercentage =
      matchingSkills.length / task.requirements.skillsNeeded.length;
    const score = Math.round(matchPercentage * 20);

    return { score, matchingSkills };
  }

  /**
   * Calculate experience level match
   */
  private static calculateExperienceMatch(
    task: Task,
    provider: ProviderProfile
  ): number {
    // If no specific requirement, give full score
    if (
      !task.requirements.experienceLevel ||
      task.requirements.experienceLevel === "any"
    ) {
      return 10;
    }

    // Check if provider is company trained (indicates higher experience)
    if (task.requirements.experienceLevel === "expert") {
      return provider.isCompanyTrained ? 10 : 5;
    }

    // For intermediate and beginner, give full score
    return 10;
  }

  /**
   * Calculate availability match score
   */
  private static calculateAvailabilityMatch(
    task: Task,
    provider: ProviderProfile
  ): number {
    // Always available providers get full score
    if (provider.isAlwaysAvailable) {
      return 15;
    }

    // If task has specific time slots, check working hours
    if (task.schedule.specificTimeSlots && provider.workingHours) {
      // Basic check: if provider has working hours set, give partial score
      // This can be enhanced to check actual time slot overlaps
      return 10;
    }

    // Flexible schedule gets partial score
    if (task.schedule.isFlexible) {
      return 12;
    }

    return 8;
  }

  /**
   * Calculate budget compatibility score
   */
  private static calculateBudgetMatch(
    task: Task,
    providerServices: Service[]
  ): { score: number; estimatedCost: number | undefined } {
    if (task.budget.type === "negotiable") {
      return { score: 10, estimatedCost: undefined };
    }

    // Get average pricing from provider's services in same category
    const relevantServices = providerServices.filter(
      (service) =>
        service.categoryId.toString() === task.categoryId.toString() &&
        service.servicePricing
    );

    if (relevantServices.length === 0) {
      return { score: 5, estimatedCost: undefined };
    }

    const avgProviderPrice =
      relevantServices.reduce(
        (sum, service) =>
          sum + (service.servicePricing?.serviceBasePrice || 0),
        0
      ) / relevantServices.length;

    let taskBudget: number;
    if (task.budget.type === "fixed") {
      taskBudget = task.budget.amount || 0;
    } else if (task.budget.type === "range") {
      taskBudget = ((task.budget.minAmount || 0) + (task.budget.maxAmount || 0)) / 2;
    } else {
      return { score: 8, estimatedCost: avgProviderPrice };
    }

    // Score based on how well provider's pricing matches task budget
    const priceDiff = Math.abs(avgProviderPrice - taskBudget);
    const diffPercentage = priceDiff / taskBudget;

    let score: number;
    if (diffPercentage <= 0.1) score = 10; // Within 10%
    else if (diffPercentage <= 0.2) score = 8; // Within 20%
    else if (diffPercentage <= 0.3) score = 6; // Within 30%
    else if (diffPercentage <= 0.5) score = 4; // Within 50%
    else score = 2;

    return { score, estimatedCost: avgProviderPrice };
  }

  /**
   * Calculate certification match
   */
  private static calculateCertificationMatch(
    task: Task,
    provider: ProviderProfile
  ): number {
    if (!task.requirements.certificationRequired) {
      return 5;
    }

    // Check if provider has ID details (indicates verification)
    return provider.IdDetails ? 5 : 0;
  }

  /**
   * Calculate deposit preference match
   */
  private static calculateDepositMatch(task: Task, provider: ProviderProfile): number {
    // If both agree on deposit requirements, give bonus
    if (provider.requireInitialDeposit) {
      return 5;
    }
    return 3;
  }

  /**
   * Generate match reasons based on scores
   */
  private static generateMatchReasons(
    categoryScore: number,
    locationScore: number,
    skillsScore: number,
    availabilityScore: number,
    budgetScore: number,
    matchingSkills: string[],
    distance?: number
  ): string[] {
    const reasons: string[] = [];

    if (categoryScore >= 25) {
      reasons.push("Offers services in this category");
    }

    if (locationScore >= 20) {
      if (distance !== undefined) {
        reasons.push(`Located ${distance.toFixed(1)}km away`);
      } else {
        reasons.push("Available for remote work");
      }
    } else if (locationScore >= 15) {
      reasons.push("Located in same region");
    }

    if (skillsScore >= 15 && matchingSkills.length > 0) {
      reasons.push(`Has ${matchingSkills.length} matching skill(s): ${matchingSkills.slice(0, 3).join(", ")}`);
    }

    if (availabilityScore >= 13) {
      reasons.push("Always available");
    }

    if (budgetScore >= 8) {
      reasons.push("Pricing matches your budget");
    }

    return reasons;
  }

  /**
   * Main matching algorithm - Find providers for a task
   */
  static async findMatchingProviders(
    taskId: string | Types.ObjectId,
    options: {
      maxResults?: number;
      minMatchScore?: number;
      maxDistance?: number;
      sortBy?: "matchScore" | "distance" | "rating" | "price";
    } = {}
  ): Promise<TaskMatchingResult> {
    const {
      maxResults = 20,
      minMatchScore = 30,
      maxDistance,
      sortBy = "matchScore",
    } = options;

    // Fetch the task
    const task = await TaskModel.findById(taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    // Build provider query
    const providerQuery: any = { isDeleted: { $ne: true } };

    // Filter by location if not remote
    if (!task.isRemoteTask) {
      providerQuery["locationData.region"] = task.taskLocation.region;
      
      // If max distance is specified and task has coordinates
      if (maxDistance && task.taskLocation.gpsCoordinates) {
        providerQuery["locationData.gpsCoordinates"] = {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [
                task.taskLocation.gpsCoordinates.longitude,
                task.taskLocation.gpsCoordinates.latitude,
              ],
            },
            $maxDistance: maxDistance * 1000, // Convert km to meters
          },
        };
      }
    }

    // Fetch all potential providers
    const providers = await ProviderModel.find(providerQuery)
      .populate("serviceOfferings")
      .lean();

    // Calculate match scores for each provider
    const matches: ProviderMatch[] = [];

    for (const provider of providers) {
      const providerServices = (provider.serviceOfferings as any[] || []).filter(
        (service: any) => service && !service.deletedAt
      );

      // Calculate individual scores
      const categoryMatch = this.calculateCategoryMatch(task, providerServices);
      const locationMatch = this.calculateLocationMatch(task, provider as ProviderProfile);
      const skillsMatch = this.calculateSkillsMatch(task, providerServices);
      const experienceScore = this.calculateExperienceMatch(task, provider as ProviderProfile);
      const availabilityScore = this.calculateAvailabilityMatch(task, provider as ProviderProfile);
      const budgetMatch = this.calculateBudgetMatch(task, providerServices);
      const certificationScore = this.calculateCertificationMatch(task, provider as ProviderProfile);
      const depositScore = this.calculateDepositMatch(task, provider as ProviderProfile);

      // Calculate total score
      const totalScore =
        categoryMatch.score +
        locationMatch.score +
        skillsMatch.score +
        experienceScore +
        availabilityScore +
        budgetMatch.score +
        certificationScore +
        depositScore;

      // Only include if meets minimum score
      if (totalScore >= minMatchScore) {
        const matchReasons = this.generateMatchReasons(
          categoryMatch.score,
          locationMatch.score,
          skillsMatch.score,
          availabilityScore,
          budgetMatch.score,
          skillsMatch.matchingSkills,
          locationMatch.distance
        );

        matches.push({
          provider: provider._id,
          matchScore: Math.min(totalScore, 100),
          matchReasons,
          distance: locationMatch.distance,
          estimatedCost: budgetMatch.estimatedCost,
          availability: availabilityScore >= 13,
          relevantServices: categoryMatch.matchingServices,
          providerRating: undefined, // TODO: Implement rating system
          completedTasksCount: undefined, // TODO: Track completed tasks
          responseTime: undefined, // TODO: Track response times
        });
      }
    }

    // Sort matches
    matches.sort((a, b) => {
      switch (sortBy) {
        case "distance":
          if (a.distance === undefined) return 1;
          if (b.distance === undefined) return -1;
          return a.distance - b.distance;
        case "price":
          if (a.estimatedCost === undefined) return 1;
          if (b.estimatedCost === undefined) return -1;
          return a.estimatedCost - b.estimatedCost;
        case "rating":
          return (b.providerRating || 0) - (a.providerRating || 0);
        case "matchScore":
        default:
          return b.matchScore - a.matchScore;
      }
    });

    // Limit results
    const limitedMatches = matches.slice(0, maxResults);

    return {
      task,
      matches: limitedMatches,
      totalMatches: matches.length,
      searchRadius: maxDistance || (task.maxTravelDistance || 50),
      executedAt: new Date(),
    };
  }

  /**
   * Find matching tasks for a provider
   */
  static async findMatchingTasks(
    providerId: string | Types.ObjectId,
    options: {
      maxResults?: number;
      minMatchScore?: number;
      categoryId?: string;
    } = {}
  ): Promise<Task[]> {
    const { maxResults = 20, minMatchScore = 30, categoryId } = options;

    // Fetch provider with services
    const provider = await ProviderModel.findById(providerId)
      .populate("serviceOfferings")
      .lean();

    if (!provider) {
      throw new Error("Provider not found");
    }

    // Build task query
    const taskQuery: any = {
      status: "open",
      isPublic: true,
      isDeleted: { $ne: true },
      expiresAt: { $gt: new Date() },
    };

    // Filter by category if provider offers specific services
    if (categoryId) {
      taskQuery.categoryId = categoryId;
    } else if (provider.serviceOfferings && provider.serviceOfferings.length > 0) {
      const categoryIds = [
        ...new Set(
          (provider.serviceOfferings as any[])
            .map((s: any) => s.categoryId?.toString())
            .filter(Boolean)
        ),
      ];
      if (categoryIds.length > 0) {
        taskQuery.categoryId = { $in: categoryIds };
      }
    }

    // Location-based filtering
    if (provider.locationData.region) {
      taskQuery.$or = [
        { isRemoteTask: true },
        { "taskLocation.region": provider.locationData.region },
      ];
    }

    // Fetch potential tasks
    const tasks = await TaskModel.find(taskQuery).lean();

    // Calculate match scores
    const matchedTasks: Array<Task & { matchScore: number }> = [];
    const providerServices = (provider.serviceOfferings as any[] || []).filter(
      (s: any) => s && !s.deletedAt
    );

    for (const task of tasks) {
      const categoryMatch = this.calculateCategoryMatch(task as Task, providerServices);
      const locationMatch = this.calculateLocationMatch(task as Task, provider as ProviderProfile);
      const skillsMatch = this.calculateSkillsMatch(task as Task, providerServices);
      const experienceScore = this.calculateExperienceMatch(task as Task, provider as ProviderProfile);
      const availabilityScore = this.calculateAvailabilityMatch(task as Task, provider as ProviderProfile);
      const budgetMatch = this.calculateBudgetMatch(task as Task, providerServices);
      const certificationScore = this.calculateCertificationMatch(task as Task, provider as ProviderProfile);

      const totalScore =
        categoryMatch.score +
        locationMatch.score +
        skillsMatch.score +
        experienceScore +
        availabilityScore +
        budgetMatch.score +
        certificationScore;

      if (totalScore >= minMatchScore) {
        matchedTasks.push({
          ...(task as Task),
          matchScore: Math.min(totalScore, 100),
        });
      }
    }

    // Sort by match score
    matchedTasks.sort((a, b) => b.matchScore - a.matchScore);

    return matchedTasks.slice(0, maxResults);
  }

  /**
   * Get recommended providers for a task (quick match)
   */
  static async getQuickRecommendations(
    taskId: string | Types.ObjectId,
    limit: number = 5
  ): Promise<ProviderMatch[]> {
    const result = await this.findMatchingProviders(taskId, {
      maxResults: limit,
      minMatchScore: 50, // Higher threshold for recommendations
      sortBy: "matchScore",
    });

    return result.matches;
  }

  /**
   * Calculate match score between a specific task and provider
   */
  static async calculateTaskProviderMatch(
    taskId: string | Types.ObjectId,
    providerId: string | Types.ObjectId
  ): Promise<ProviderMatch | null> {
    const result = await this.findMatchingProviders(taskId, {
      maxResults: 1000, // Get all matches
      minMatchScore: 0, // Include all providers
    });

    const match = result.matches.find(
      (m) => m.provider.toString() === providerId.toString()
    );

    return match || null;
  }
}

export default TaskMatchingService;