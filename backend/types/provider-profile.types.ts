// types/provider-profile.types.ts
import { Types } from "mongoose";
import { BaseEntity, SoftDeletable } from "./base.types";

export interface ProviderProfile extends BaseEntity, SoftDeletable {
  profileId: Types.ObjectId;
  serviceOfferings: Types.ObjectId;
  workingHours?: Record<
    string,
    {
      start: string;
      end: string;
    }
  >;

  isAlwaysAvailable: boolean;
  businessName?: string;
}
