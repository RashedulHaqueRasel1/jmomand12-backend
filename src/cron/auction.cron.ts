import cron from 'node-cron';
import logger from '../logger';
import { activateAuctionsJob } from './jobs/activate-auctions.job';
import { closeAuctionsJob } from './jobs/close-auctions.job';
import { processPaymentRetriesJob } from './jobs/process-payment-retries.job';

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

  // Process payment retries every 5 minutes
  cron.schedule(
    '*/5 * * * *',
    async () => {
      try {
        await processPaymentRetriesJob();
      } catch (error: any) {
        logger.error({ error }, 'Payment retry cron job failed');
      }
    },
    {
      scheduled: true,
      timezone: 'UTC',
    },
  );

  logger.info('Auction cron jobs scheduled');
};

