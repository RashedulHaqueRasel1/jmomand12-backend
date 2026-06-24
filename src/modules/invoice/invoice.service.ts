import crypto from 'crypto';
import QRCode from 'qrcode';
import { StatusCodes } from 'http-status-codes';
import config from '../../config';
import AppError from '../../errors/AppError';
import sendEmail from '../../utils/sendEmail';
import { User } from '../user/user.model';
import Invoice from './invoice.model';

const generateInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  const count = await Invoice.countDocuments({
    invoiceNumber: { $regex: `^INV-${year}-` },
  });

  return `INV-${year}-${String(count + 1001).padStart(4, '0')}`;
};

const generatePickupCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();

const hashPickupToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

const createPickupQrDataUrl = async (pickupToken: string) => {
  const qrPayload = `${config.app.frontendUrl}/pickup/verify?token=${pickupToken}`;
  return QRCode.toDataURL(qrPayload, {
    margin: 1,
    width: 240,
  });
};

const sendWinnerInvoiceEmail = async (params: {
  to: string;
  customerName: string;
  productTitle: string;
  inventoryId: string;
  invoiceNumber: string;
  amount: number;
  pickupCode: string;
  pickupQrDataUrl?: string;
}) => {
  await sendEmail({
    to: params.to,
    subject: `Invoice ${params.invoiceNumber} - Pickup Ready`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
        <h2>Your auction invoice is ready</h2>
        <p>Hello ${params.customerName},</p>
        <p>Your payment was successful and your winning item is ready for pickup scheduling.</p>
        <p><strong>Invoice:</strong> ${params.invoiceNumber}</p>
        <p><strong>Item:</strong> ${params.productTitle}</p>
        <p><strong>Inventory ID:</strong> ${params.inventoryId}</p>
        <p><strong>Paid Amount:</strong> $${params.amount.toFixed(2)}</p>
        <p><strong>Pickup Code:</strong> ${params.pickupCode}</p>
        ${
          params.pickupQrDataUrl
            ? `<p><img alt="Pickup QR Code" src="${params.pickupQrDataUrl}" width="180" height="180" /></p>`
            : ''
        }
        <p>Please schedule your pickup from your customer dashboard before visiting the warehouse.</p>
      </div>
    `,
  });
};

const createPaidInvoice = async (params: {
  auctionId: string;
  productId: string;
  customerId: string;
  inventoryId: string;
  amount: number;
  stripePaymentIntentId?: string;
  productTitle: string;
}) => {
  const customer = await User.findById(params.customerId);
  if (!customer) {
    throw new AppError('Customer not found', StatusCodes.NOT_FOUND);
  }

  const pickupToken = crypto.randomBytes(32).toString('hex');
  const pickupCode = generatePickupCode();
  const pickupQrDataUrl = await createPickupQrDataUrl(pickupToken);

  const invoice = await Invoice.create({
    invoiceNumber: await generateInvoiceNumber(),
    auction: params.auctionId,
    product: params.productId,
    customer: params.customerId,
    inventoryId: params.inventoryId,
    amount: params.amount,
    status: 'paid',
    stripePaymentIntentId: params.stripePaymentIntentId,
    pickupCode,
    pickupTokenHash: hashPickupToken(pickupToken),
    pickupQrDataUrl,
    paidAt: new Date(),
  });

  await sendWinnerInvoiceEmail({
    to: customer.email,
    customerName: `${customer.firstName} ${customer.lastName}`,
    productTitle: params.productTitle,
    inventoryId: params.inventoryId,
    invoiceNumber: invoice.invoiceNumber,
    amount: params.amount,
    pickupCode,
    pickupQrDataUrl,
  });

  return invoice;
};

const createFailedPaymentInvoice = async (params: {
  auctionId: string;
  productId: string;
  customerId: string;
  inventoryId: string;
  amount: number;
  failureReason: string;
}) => {
  const pickupToken = crypto.randomBytes(32).toString('hex');

  return Invoice.create({
    invoiceNumber: await generateInvoiceNumber(),
    auction: params.auctionId,
    product: params.productId,
    customer: params.customerId,
    inventoryId: params.inventoryId,
    amount: params.amount,
    status: 'payment_failed',
    pickupCode: generatePickupCode(),
    pickupTokenHash: hashPickupToken(pickupToken),
    paymentFailureReason: params.failureReason,
  });
};

const getMyInvoices = async (email: string) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError('User not found', StatusCodes.NOT_FOUND);
  }

  return Invoice.find({ customer: user._id })
    .populate('product')
    .populate('auction')
    .sort({ createdAt: -1 });
};

const getAllInvoices = async () => {
  return Invoice.find()
    .populate('customer', 'firstName lastName email phone')
    .populate('product')
    .populate('auction')
    .sort({ createdAt: -1 });
};

const verifyPickupToken = async (tokenOrCode: string) => {
  const tokenHash = hashPickupToken(tokenOrCode);
  const invoice = await Invoice.findOne({
    $or: [{ pickupTokenHash: tokenHash }, { pickupCode: tokenOrCode.toUpperCase() }],
  })
    .populate('customer', 'firstName lastName email phone')
    .populate('product')
    .populate('auction');

  if (!invoice) {
    throw new AppError('Invalid pickup QR or pickup code', StatusCodes.NOT_FOUND);
  }

  return invoice;
};

const invoiceService = {
  createPaidInvoice,
  createFailedPaymentInvoice,
  getMyInvoices,
  getAllInvoices,
  verifyPickupToken,
};

export default invoiceService;
