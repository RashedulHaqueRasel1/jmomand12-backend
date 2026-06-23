export interface ISettings {
  key: 'platform';
  pickupGraceDays: number;
  storageFeePerDay: number;
  forfeitureDays: number;
  pickupInstructions?: string;
}
