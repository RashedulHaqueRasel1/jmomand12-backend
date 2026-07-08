import cron from 'node-cron';
import logger from '../logger';
import { activateAuctionsJob } from './jobs/activate-auctions.job';
import { closeAuctionsJob } from './jobs/close-auctions.job';

export const startAuctionCronJobs = (): void => {
  logger.info('Registering auction cron jobs');

  cron.schedule(
    '* * * * *',
    async () => {
      try {
        await activateAuctionsJob();
      } catch (error: any) {
        logger.error({ error }, 'Auction activation cron job failed');
      }
    },
    {
      scheduled: true,
      timezone: 'UTC',
    },
  );

  cron.schedule(
    '* * * * *',
    async () => {
      try {
        await closeAuctionsJob();
      } catch (error: any) {
        logger.error({ error }, 'Auction close cron job failed');
      }
    },
    {
      scheduled: true,
      timezone: 'UTC',
    },
  );

  logger.info('Auction cron jobs scheduled to run every minute');
};
