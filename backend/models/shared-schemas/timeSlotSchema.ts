import { Schema } from "mongoose";

/**
 * Time Slot Sub-Schema
 * Shared across: Booking, Task, Provider models
 */
export const timeSlotSchema = new Schema(
  {
    start: {
      type: String,
      required: true,
      validate: {
        validator: function (v: string) {
          // Basic HH:MM format validation
          return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
        },
        message: "Start time must be in HH:MM format (24-hour)",
      },
    },
    end: {
      type: String,
      required: true,
      validate: {
        validator: function (v: string) {
          return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
        },
        message: "End time must be in HH:MM format (24-hour)",
      },
    },
  },
  { _id: false }
);
