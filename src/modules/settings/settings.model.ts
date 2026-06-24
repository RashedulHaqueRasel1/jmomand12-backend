import { Schema, model } from 'mongoose';
import { ISettings } from './settings.interface';

const settingsSchema = new Schema<ISettings>(
  {
    key: {
      type: String,
      enum: ['platform'],
      default: 'platform',
      unique: true,
    },
    pickupGraceDays: {
      type: Number,
      default: 7,
      min: 0,
    },
    storageFeePerDay: {
      type: Number,
      default: 0,
      min: 0,
    },
    forfeitureDays: {
      type: Number,
      default: 30,
      min: 1,
    },
    pickupInstructions: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const Settings = model<ISettings>('Settings', settingsSchema);
export default Settings;
