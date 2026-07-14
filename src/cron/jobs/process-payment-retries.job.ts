import logger from '../../logger';
import auctionCronService from '../services/auction-cron.service';

export const processPaymentRetriesJob = async () => {
  const result = await auctionCronService.processPendingPaymentRetries();

  logger.info(
    {
      processedCount: result.processedCount,
      successCount: result.successCount,
      failureCount: result.failureCount,
      executionTimeMs: result.executionTimeMs,
    },
    'Payment retry processing job completed',
  );

  return result;
};
