import Auction from '../auction/auction.model';
import Invoice from '../invoice/invoice.model';
import { PickupAppointment } from '../pickup/pickup.model';
import Product from '../product/product.model';

const dateFilter = (query: Record<string, unknown>) => {
  const filter: Record<string, unknown> = {};
  const createdAt: Record<string, Date> = {};

  if (query.startDate) {
    createdAt.$gte = new Date(query.startDate as string);
  }

  if (query.endDate) {
    createdAt.$lte = new Date(query.endDate as string);
  }

  if (Object.keys(createdAt).length) {
    filter.createdAt = createdAt;
  }

  return filter;
};

const getRevenueSummary = async (query: Record<string, unknown>) => {
  const filter = {
    ...dateFilter(query),
    status: 'paid',
  };

  const [summary] = await Invoice.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' },
        paidInvoices: { $sum: 1 },
        averageOrderValue: { $avg: '$amount' },
      },
    },
  ]);

  return {
    totalRevenue: summary?.totalRevenue || 0,
    paidInvoices: summary?.paidInvoices || 0,
    averageOrderValue: summary?.averageOrderValue || 0,
  };
};

const getAuctionSummary = async (query: Record<string, unknown>) => {
  const filter = dateFilter(query);

  const [summary] = await Auction.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalWinningBids: { $sum: '$highestBid.amount' },
      },
    },
  ]);

  const byStatus = await Auction.aggregate([
    { $match: filter },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  return {
    totalWinningBids: summary?.totalWinningBids || 0,
    byStatus,
  };
};

const getPickupSummary = async (query: Record<string, unknown>) => {
  const filter = dateFilter(query);

  const byStatus = await PickupAppointment.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$status',
        appointments: { $sum: 1 },
        items: { $sum: { $size: '$products' } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return { byStatus };
};

const getInventorySummary = async () => {
  return Product.aggregate([
    {
      $group: {
        _id: '$inventoryStatus',
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

const reportService = {
  getRevenueSummary,
  getAuctionSummary,
  getPickupSummary,
  getInventorySummary,
};

export default reportService;
