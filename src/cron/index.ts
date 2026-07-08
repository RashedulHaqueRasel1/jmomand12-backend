import { startAuctionCronJobs } from './auction.cron';

export const initializeCronJobs = (): void => {
  startAuctionCronJobs();
};
