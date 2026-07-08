import logger from '../../logger';
import auctionCronService from '../services/auction-cron.service';

export const activateAuctionsJob = async () => {
  const result = await auctionCronService.activateDueAuctions();

  logger.info(
    {
      activatedCount: result.activatedCount,
      executionTimeMs: result.executionTimeMs,
      logs: result.logs,
    },
    'Auction activation job completed',
  );

  return result;
};
