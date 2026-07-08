import logger from '../../logger';
import auctionCronService from '../services/auction-cron.service';

export const closeAuctionsJob = async () => {
  const result = await auctionCronService.closeDueAuctions();

  logger.info(
    {
      closedCount: result.closed,
      executionTimeMs: result.executionTimeMs,
      results: result.results,
    },
    'Auction closing job completed',
  );

  return result;
};
