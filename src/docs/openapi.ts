const json = (example: Record<string, unknown>) => ({
  'application/json': {
    schema: {
      type: 'object',
    },
    example,
  },
});

const success = (message: string, data: unknown = {}, links: Record<string, string> = {}) => ({
  description: message,
  content: json({
    success: true,
    message,
    statusCode: 200,
    data,
    _links: links,
  }),
});

const errorResponse = {
  description: 'Error response',
  content: json({
    success: false,
    message: 'Validation or authorization error',
    statusCode: 400,
  }),
};

const bearer = [{ bearerAuth: [] }];

const openApiDocumentBase = {
  openapi: '3.0.3',
  info: {
    title: 'Javed Momand Liquidation Auction Platform API',
    version: '1.0.0',
    description:
      'Backend API for liquidation auctions, Cloudinary inventory media, Stripe saved-card billing, invoices, secure pickup QR verification, pickup scheduling, and admin warehouse monitoring. Responses support HATEOAS-style `_links` where follow-up actions are useful.',
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Current server',
    },
    {
      url: 'http://localhost:5000/api/v1',
      description: 'Local development',
    },
  ],
  tags: [
    { name: 'Auth', description: 'Authentication, token refresh, OTP, and password management APIs.' },
    { name: 'Users', description: 'Customer registration, profile, email verification, and admin user management APIs.' },
    { name: 'Products', description: 'Inventory product, media upload, detail, update, delete, and monitoring APIs.' },
    { name: 'Auctions', description: 'Auction scheduling, listing, bidding, closing, and bid history APIs.' },
    { name: 'Payments', description: 'Stripe saved-card setup, default payment method, and test-card helper APIs.' },
    { name: 'Invoices', description: 'Customer invoice, admin invoice, and pickup QR/code verification APIs.' },
    { name: 'Pickups', description: 'Pickup slot, ready invoice, appointment scheduling, and completion APIs.' },
    { name: 'Reports', description: 'Admin revenue, auction, pickup, and inventory analytics APIs.' },
    { name: 'Settings', description: 'Platform pickup policy, storage fee, and public settings APIs.' },
    { name: 'Contacts', description: 'Public contact message APIs.' },
    { name: 'Notifications', description: 'Admin notification listing and read-state APIs.' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          statusCode: { type: 'number' },
          data: {},
          meta: {
            type: 'object',
            properties: {
              page: { type: 'number' },
              limit: { type: 'number' },
              total: { type: 'number' },
              totalPage: { type: 'number' },
            },
          },
          _links: {
            type: 'object',
            additionalProperties: { type: 'string' },
          },
        },
      },
    },
  },
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login and receive JWT tokens',
        requestBody: {
          required: true,
          content: json({ email: 'customer@example.com', password: 'secret123' }),
        },
        responses: {
          200: success('Login successful', {
            accessToken: 'jwt-access-token',
            user: { email: 'customer@example.com', role: 'user' },
          }),
          400: errorResponse,
        },
      },
    },
    '/auth/refresh-token': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh access token using refresh cookie',
        responses: { 200: success('Access token refreshed successfully') },
      },
    },
    '/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Send password reset OTP',
        requestBody: { required: true, content: json({ email: 'customer@example.com' }) },
        responses: { 200: success('Password reset OTP sent successfully') },
      },
    },
    '/auth/resend-forgot-otp': {
      post: {
        tags: ['Auth'],
        security: bearer,
        summary: 'Resend password reset OTP',
        responses: { 200: success('Password reset OTP resent successfully') },
      },
    },
    '/auth/verify-otp': {
      post: {
        tags: ['Auth'],
        security: bearer,
        summary: 'Verify password reset OTP',
        requestBody: { required: true, content: json({ otp: '123456' }) },
        responses: { 200: success('OTP verified successfully') },
      },
    },
    '/auth/reset-password': {
      post: {
        tags: ['Auth'],
        security: bearer,
        summary: 'Reset password after OTP verification',
        requestBody: { required: true, content: json({ newPassword: 'newSecret123' }) },
        responses: { 200: success('Password reset successfully') },
      },
    },
    '/auth/change-password': {
      post: {
        tags: ['Auth'],
        security: bearer,
        summary: 'Change logged-in user password',
        requestBody: {
          required: true,
          content: json({ currentPassword: 'secret123', newPassword: 'newSecret123' }),
        },
        responses: { 200: success('Password changed successfully') },
      },
    },
    '/users': {
      post: {
        tags: ['Users'],
        summary: 'Register a customer account',
        requestBody: {
          required: true,
          content: json({
            firstName: 'Javed',
            lastName: 'Momand',
            email: 'customer@example.com',
            phone: '+15555555555',
            password: 'secret123',
            street: '123 Main St',
            location: 'Virginia',
            postalCode: '22030',
          }),
        },
        responses: {
          200: success(
            'Account created successfully. Please verify your email.',
            { accessToken: 'jwt-access-token', user: { email: 'customer@example.com' } },
            { verifyEmail: '/api/v1/users/email-verifications' },
          ),
        },
      },
      get: {
        tags: ['Users'],
        security: bearer,
        summary: 'Admin: list users',
        responses: { 200: success('Users retrieved successfully.') },
      },
    },
    '/users/email-verifications': {
      post: {
        tags: ['Users'],
        security: bearer,
        summary: 'Verify account email OTP',
        requestBody: { required: true, content: json({ otp: '123456' }) },
        responses: { 200: success('Email verified successfully. You can now log in.') },
      },
    },
    '/users/email-verifications/resend': {
      post: {
        tags: ['Users'],
        security: bearer,
        summary: 'Resend account verification OTP',
        responses: { 200: success('OTP code sent successfully') },
      },
    },
    '/users/me': {
      get: {
        tags: ['Users'],
        security: bearer,
        summary: 'Get my profile',
        responses: {
          200: success('Your profile has been retrieved successfully.', {}, { update: '/api/v1/users/me' }),
        },
      },
      patch: {
        tags: ['Users'],
        security: bearer,
        summary: 'Update my profile with optional image upload',
        requestBody: {
          required: false,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  firstName: { type: 'string', example: 'Javed' },
                  lastName: { type: 'string', example: 'Momand' },
                  phone: { type: 'string', example: '+15555555555' },
                  image: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
        responses: { 200: success('Your profile has been updated successfully.') },
      },
    },
    '/users/admin-id': {
      get: {
        tags: ['Users'],
        security: bearer,
        summary: 'Get primary admin ID',
        responses: { 200: success('Admin ID fetched successfully') },
      },
    },
    '/users/{userId}': {
      get: {
        tags: ['Users'],
        security: bearer,
        summary: 'Admin: get user details',
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: success('User details retrieved successfully.') },
      },
    },
    '/users/{id}/suspension': {
      patch: {
        tags: ['Users'],
        security: bearer,
        summary: 'Admin: toggle user suspension',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: success('User suspended successfully') },
      },
    },
    '/users/{id}/block': {
      patch: {
        tags: ['Users'],
        security: bearer,
        summary: 'Admin: toggle user block',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: success('User blocked successfully') },
      },
    },
    '/products': {
      post: {
        tags: ['Products'],
        security: bearer,
        summary: 'Admin: create inventory product with Cloudinary images',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['title', 'description', 'category', 'condition', 'reservePrice', 'images'],
                properties: {
                  title: { type: 'string', example: 'Fender Guitar' },
                  description: { type: 'string', example: 'Used guitar in good condition' },
                  category: { type: 'string', example: 'Music' },
                  condition: {
                    type: 'string',
                    enum: ['new', 'open_box', 'like_new', 'used', 'damaged', 'for_parts'],
                    example: 'used',
                  },
                  reservePrice: { type: 'number', example: 150 },
                  retailPrice: { type: 'number', example: 499 },
                  images: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: success('New product created successfully', {}, { products: '/api/v1/products' }),
        },
      },
      get: {
        tags: ['Products'],
        summary: 'List products with search/filter/pagination',
        parameters: [
          { name: 'searchTerm', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'condition', in: 'query', schema: { type: 'string' } },
          { name: 'inventoryStatus', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'number', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'number', default: 10 } },
        ],
        responses: { 200: success('Products fetched successfully') },
      },
    },
    '/products/inventory-monitoring': {
      get: {
        tags: ['Products'],
        security: bearer,
        summary: 'Admin: inventory monitoring with auction, payment, winner, and pickup state',
        parameters: [
          { name: 'inventoryStatus', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'searchTerm', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: success('Inventory monitoring fetched successfully') },
      },
    },
    '/products/{id}': {
      get: {
        tags: ['Products'],
        summary: 'Get product details',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: success('Product details fetched successfully', {}, { auctions: '/api/v1/auctions' }),
        },
      },
      patch: {
        tags: ['Products'],
        security: bearer,
        summary: 'Admin: update product and optionally replace images',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: false,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  category: { type: 'string' },
                  reservePrice: { type: 'number' },
                  retailPrice: { type: 'number' },
                  images: { type: 'array', items: { type: 'string', format: 'binary' } },
                },
              },
            },
          },
        },
        responses: { 200: success('Product updated successfully') },
      },
      delete: {
        tags: ['Products'],
        security: bearer,
        summary: 'Admin: delete inactive product and Cloudinary images',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: success('Product deleted successfully') },
      },
    },
    '/auctions': {
      post: {
        tags: ['Auctions'],
        security: bearer,
        summary: 'Admin: schedule auction for a product',
        requestBody: {
          required: true,
          content: json({
            product: 'productObjectId',
            title: 'Fender Guitar Auction',
            startsAt: '2026-08-10T13:00:00.000Z',
            endsAt: '2026-08-11T13:00:00.000Z',
            startingBid: 1,
            bidIncrement: 5,
            reservePrice: 150,
          }),
        },
        responses: {
          200: success('Auction created successfully', {}, { bid: '/api/v1/auctions/{id}/bids' }),
        },
      },
      get: {
        tags: ['Auctions'],
        summary: 'List auctions',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'number', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'number', default: 10 } },
        ],
        responses: { 200: success('Auctions fetched successfully') },
      },
    },
    '/auctions/process-due': {
      post: {
        tags: ['Auctions'],
        security: bearer,
        summary: 'Admin: manually process due auction activations/closures',
        responses: { 200: success('Due auctions processed successfully') },
      },
    },
    '/auctions/{id}': {
      get: {
        tags: ['Auctions'],
        summary: 'Get auction details',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: success('Auction details fetched successfully', {}, { bids: '/api/v1/auctions/{id}/bids' }),
        },
      },
    },
    '/auctions/{id}/bids': {
      get: {
        tags: ['Auctions'],
        security: bearer,
        summary: 'Admin: list bid history for an auction',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: success('Auction bids fetched successfully') },
      },
      post: {
        tags: ['Auctions'],
        security: bearer,
        summary: 'Place bid; user must have saved Stripe card',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: json({ amount: 205 }) },
        responses: { 200: success('Bid placed successfully') },
      },
    },
    '/auctions/{id}/close': {
      post: {
        tags: ['Auctions'],
        security: bearer,
        summary: 'Admin: force close auction, validate reserve, and auto-charge winner',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: false, content: json({ reason: 'manual_admin_close' }) },
        responses: { 200: success('Auction closed successfully') },
      },
    },
    '/payments/setup-intents': {
      post: {
        tags: ['Payments'],
        security: bearer,
        summary: 'Create Stripe SetupIntent for saved-card registration',
        responses: {
          200: success(
            'Stripe setup intent created successfully',
            {
              customerId: 'cus_123',
              setupIntentId: 'seti_123',
              clientSecret: 'seti_secret',
              publishableKey: 'pk_test_...',
            },
            {
              checkStatus: '/api/v1/payments/setup-intents/{setupIntentId}',
              saveDefaultPaymentMethod: '/api/v1/payments/default-payment-method',
              swaggerTestHelper: '/api/v1/payments/test-default-payment-method',
            },
          ),
        },
      },
    },
    '/payments/setup-intents/{setupIntentId}': {
      get: {
        tags: ['Payments'],
        security: bearer,
        summary: 'Check whether a SetupIntent has been confirmed and can be saved',
        parameters: [
          { name: 'setupIntentId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: success('Stripe setup intent status fetched successfully', {
            id: 'seti_123',
            status: 'requires_payment_method',
            canSaveAsDefault: false,
            nextStep: 'Confirm the clientSecret with Stripe.js/Elements before saving this card.',
          }),
        },
      },
    },
    '/payments/default-payment-method': {
      post: {
        tags: ['Payments'],
        security: bearer,
        summary: 'Save confirmed Stripe SetupIntent payment method as user default card',
        description:
          'PCI-safe flow: do not send raw card numbers to this API. Use Stripe.js/Elements on the frontend to confirm the SetupIntent clientSecret, then send the succeeded setupIntentId here.',
        requestBody: { required: true, content: json({ setupIntentId: 'seti_123' }) },
        responses: { 200: success('Default payment method saved successfully') },
      },
    },
    '/payments/test-default-payment-method': {
      post: {
        tags: ['Payments'],
        security: bearer,
        summary: 'Development/test-only: save a Stripe test card so Swagger bidding can be tested',
        description:
          'Only works outside production with a Stripe test secret key. It uses Stripe test payment method IDs, never raw card details. Default is pm_card_visa.',
        requestBody: { required: false, content: json({ testPaymentMethodId: 'pm_card_visa' }) },
        responses: {
          200: success(
            'Test default payment method saved successfully',
            {},
            { placeBid: '/api/v1/auctions/{id}/bids' },
          ),
        },
      },
    },
    '/invoices/me': {
      get: {
        tags: ['Invoices'],
        security: bearer,
        summary: 'Customer: list my invoices',
        responses: {
          200: success('Invoices fetched successfully', {}, { schedulePickup: '/api/v1/pickups' }),
        },
      },
    },
    '/invoices': {
      get: {
        tags: ['Invoices'],
        security: bearer,
        summary: 'Admin: list all invoices',
        responses: { 200: success('Invoices fetched successfully') },
      },
    },
    '/invoices/verify-pickup': {
      post: {
        tags: ['Invoices'],
        security: bearer,
        summary: 'Admin: verify invoice pickup QR token or pickup code',
        requestBody: { required: true, content: json({ tokenOrCode: 'A1B2C3D4' }) },
        responses: {
          200: success('Pickup token verified successfully', {}, { completePickup: '/api/v1/pickups/complete' }),
        },
      },
    },
    '/pickups/slots': {
      post: {
        tags: ['Pickups'],
        security: bearer,
        summary: 'Admin: create pickup capacity slot',
        requestBody: {
          required: true,
          content: json({
            startsAt: '2026-08-12T14:00:00.000Z',
            endsAt: '2026-08-12T15:00:00.000Z',
            maxCustomers: 5,
            maxItems: 20,
          }),
        },
        responses: { 200: success('Pickup slot created successfully') },
      },
      get: {
        tags: ['Pickups'],
        security: bearer,
        summary: 'List available pickup slots',
        responses: { 200: success('Available pickup slots fetched successfully') },
      },
    },
    '/pickups/slots/all': {
      get: {
        tags: ['Pickups'],
        security: bearer,
        summary: 'Admin: list all pickup slots including inactive/full',
        responses: { 200: success('Pickup slots fetched successfully') },
      },
    },
    '/pickups/ready-invoices': {
      get: {
        tags: ['Pickups'],
        security: bearer,
        summary: 'Customer: paid invoices ready for pickup scheduling',
        responses: { 200: success('Ready pickup invoices fetched successfully') },
      },
    },
    '/pickups': {
      post: {
        tags: ['Pickups'],
        security: bearer,
        summary: 'Customer: schedule one or many paid invoices in one appointment',
        requestBody: {
          required: true,
          content: json({ slotId: 'pickupSlotObjectId', invoiceIds: ['invoiceObjectId1', 'invoiceObjectId2'] }),
        },
        responses: { 200: success('Pickup scheduled successfully') },
      },
      get: {
        tags: ['Pickups'],
        security: bearer,
        summary: 'Admin: list all pickup appointments',
        responses: { 200: success('Pickup appointments fetched successfully') },
      },
    },
    '/pickups/me': {
      get: {
        tags: ['Pickups'],
        security: bearer,
        summary: 'Customer: list my pickup appointments',
        responses: { 200: success('Pickup appointments fetched successfully') },
      },
    },
    '/pickups/complete': {
      post: {
        tags: ['Pickups'],
        security: bearer,
        summary: 'Admin: complete warehouse handover by appointment ID or pickup code',
        requestBody: {
          required: true,
          content: json({ pickupCode: 'A1B2C3D4', notes: 'Customer picked up all items.' }),
        },
        responses: { 200: success('Pickup completed successfully') },
      },
    },
    '/contacts': {
      post: {
        tags: ['Contacts'],
        summary: 'Send contact message',
        requestBody: {
          required: true,
          content: json({
            name: 'Customer Name',
            email: 'customer@example.com',
            message: 'I have a question about pickup.',
          }),
        },
        responses: { 200: success('Contact message sent successfully') },
      },
    },
    '/reports/revenue': {
      get: {
        tags: ['Reports'],
        security: bearer,
        summary: 'Admin: revenue summary from paid invoices',
        parameters: [
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: success('Revenue report fetched successfully') },
      },
    },
    '/reports/auctions': {
      get: {
        tags: ['Reports'],
        security: bearer,
        summary: 'Admin: auction outcome summary',
        parameters: [
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: success('Auction report fetched successfully') },
      },
    },
    '/reports/pickups': {
      get: {
        tags: ['Reports'],
        security: bearer,
        summary: 'Admin: pickup workload summary',
        parameters: [
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: success('Pickup report fetched successfully') },
      },
    },
    '/reports/inventory': {
      get: {
        tags: ['Reports'],
        security: bearer,
        summary: 'Admin: inventory status summary',
        responses: { 200: success('Inventory report fetched successfully') },
      },
    },
    '/settings': {
      get: {
        tags: ['Settings'],
        security: bearer,
        summary: 'Admin: get platform pickup/storage settings',
        responses: { 200: success('Platform settings fetched successfully') },
      },
      patch: {
        tags: ['Settings'],
        security: bearer,
        summary: 'Admin: update pickup deadline and storage fee rules',
        requestBody: {
          required: true,
          content: json({
            pickupGraceDays: 7,
            storageFeePerDay: 5,
            forfeitureDays: 30,
            pickupInstructions: 'Bring invoice QR code and photo ID.',
          }),
        },
        responses: {
          200: success(
            'Platform settings updated successfully',
            {},
            {
              pickupSlots: '/api/v1/pickups/slots',
              inventoryMonitoring: '/api/v1/products/inventory-monitoring',
            },
          ),
        },
      },
    },
    '/settings/public': {
      get: {
        tags: ['Settings'],
        summary: 'Public/customer-visible pickup policy',
        responses: { 200: success('Platform settings fetched successfully') },
      },
    },
    '/notifications': {
      get: {
        tags: ['Notifications'],
        security: bearer,
        summary: 'Admin: list notifications',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'number', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'number', default: 10 } },
        ],
        responses: { 200: success('Notifications fetched successfully') },
      },
    },
    '/notifications/read-all': {
      patch: {
        tags: ['Notifications'],
        security: bearer,
        summary: 'Mark all notifications as read',
        responses: { 200: success('All notifications marked as read successfully') },
      },
    },
  },
};

const detailOpenApiOperations = (document: typeof openApiDocumentBase) => {
  Object.entries(document.paths).forEach(([path, methods]) => {
    Object.entries(methods).forEach(([method, operation]) => {
      const operationDetails = operation as {
        tags?: string[];
        summary?: string;
        description?: string;
        operationId?: string;
        'x-api-name'?: string;
      };
      const tag = operationDetails.tags?.[0] || 'API';
      const summary = operationDetails.summary || `${method.toUpperCase()} ${path}`;
      const fullPath = `/api/v1${path}`;
      const operationId =
        method +
        path
          .replace(/[{}]/g, '')
          .split('/')
          .filter(Boolean)
          .map((part) => part.replace(/[^a-zA-Z0-9]/g, ' '))
          .flatMap((part) => part.split(' ').filter(Boolean))
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join('');

      operationDetails.operationId = operationDetails.operationId || operationId;
      operationDetails['x-api-name'] = `${tag} API - ${summary}`;
      operationDetails.description =
        operationDetails.description || `${tag} API - ${summary}. Endpoint: ${method.toUpperCase()} ${fullPath}.`;
    });
  });

  return document;
};

export const openApiDocument = detailOpenApiOperations(openApiDocumentBase);
