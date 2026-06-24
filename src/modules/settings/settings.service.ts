import Settings from './settings.model';
import { ISettings } from './settings.interface';

const getSettings = async () => {
  return Settings.findOneAndUpdate(
    { key: 'platform' },
    { $setOnInsert: { key: 'platform' } },
    { new: true, upsert: true },
  );
};

const updateSettings = async (payload: Partial<ISettings>) => {
  return Settings.findOneAndUpdate(
    { key: 'platform' },
    {
      $set: {
        pickupGraceDays: payload.pickupGraceDays,
        storageFeePerDay: payload.storageFeePerDay,
        forfeitureDays: payload.forfeitureDays,
        pickupInstructions: payload.pickupInstructions,
      },
    },
    { new: true, upsert: true, runValidators: true },
  );
};

const settingsService = {
  getSettings,
  updateSettings,
};

export default settingsService;
