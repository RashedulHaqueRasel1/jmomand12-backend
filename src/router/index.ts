import { Router } from 'express';
import userRouter from '../modules/user/user.router';
import authRouter from '../modules/auth/auth.router';
import contactRouter from '../modules/contact/contact.router';
import productRouter from '../modules/product/product.router';
import auctionRouter from '../modules/auction/auction.router';
import paymentRouter from '../modules/payment/payment.router';
import invoiceRouter from '../modules/invoice/invoice.router';
import pickupRouter from '../modules/pickup/pickup.router';
import notificationRouter from '../modules/notification/notification.router';
import settingsRouter from '../modules/settings/settings.router';
import reportRouter from '../modules/report/report.router';
import categoryRouter from '../modules/category/category.router';

const router = Router();

const moduleRoutes = [
  { path: '/users', route: userRouter },
  { path: '/auth', route: authRouter },
  { path: '/contacts', route: contactRouter },
  { path: '/products', route: productRouter },
  { path: '/category', route: categoryRouter },
  { path: '/auctions', route: auctionRouter },
  { path: '/payments', route: paymentRouter },
  { path: '/invoices', route: invoiceRouter },
  { path: '/pickups', route: pickupRouter },
  { path: '/notifications', route: notificationRouter },
  { path: '/settings', route: settingsRouter },
  { path: '/reports', route: reportRouter },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
