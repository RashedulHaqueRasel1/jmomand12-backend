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
    { name: 'Categories', description: 'Product category CRUD APIs.' },
    { name: 'Auctions', description: 'Auction scheduling, listing, and detail APIs.' },
    { name: 'Auction Products', description: 'Products associated with a specific auction.' },
    { name: 'Bids', description: 'Bid placement APIs. Users must have a default saved payment method before placing bids.' },
    { name: 'Payments', description: 'Stripe saved-card setup, default payment method, test-card helper, webhook receiver, and automatic payment retry APIs. Supports 3 retry attempts with exponential backoff for failed payments.' },
    { name: 'Invoices', description: 'Customer invoice, admin invoice, and pickup QR/code verification APIs.' },
    { name: 'Pickups', description: 'Pickup slot, ready invoice, appointment scheduling, and completion APIs.' },
    { name: 'Reports', description: 'Admin revenue, auction, pickup, and inventory analytics APIs.' },
    { name: 'Settings', description: 'Platform pickup policy, storage fee, and public settings APIs.' },
    { name: 'Contacts', description: 'Public contact message APIs.' },
    { name: 'Notifications', description: 'Admin notification listing and read-state APIs.' },
    { name: 'Orders', description: 'Cart checkout, Stripe webhook processing, customer order history, and admin order management.' },
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
        summary: 'Resend forgot password OTP',
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
    '/users/register': {
      post: {
        tags: ['Users'],
        summary: 'Register a new customer account',
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
    },
    '/users/email-verifications': {
      post: {
        tags: ['Users'],
        security: bearer,
        summary: 'Verify account email with OTP',
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
    '/users': {
      get: {
        tags: ['Users'],
        security: bearer,
        summary: 'Admin: list all users',
        responses: { 200: success('Users retrieved successfully.') },
      },
    },
    '/users/me': {
      get: {
        tags: ['Users'],
        security: bearer,
        summary: 'Get own profile',
        responses: {
          200: success('Your profile has been retrieved successfully.', {}, { update: '/api/v1/users/me' }),
        },
      },
      patch: {
        tags: ['Users'],
        security: bearer,
        summary: 'Update own profile with optional image upload',
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
                  street: { type: 'string', example: '123 Main St' },
                  location: { type: 'string', example: 'Virginia' },
                  postalCode: { type: 'string', example: '22030' },
                  dateOfBirth: { type: 'string', format: 'date', example: '1990-01-01' },
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
        summary: 'Get primary admin user ID',
        responses: { 200: success('Admin ID fetched successfully') },
      },
    },
    '/users/{userId}': {
      get: {
        tags: ['Users'],
        security: bearer,
        summary: 'Admin: get user details by ID',
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: success('User details retrieved successfully.') },
      },
    },
    '/users/{id}/suspension': {
      patch: {
        tags: ['Users'],
        security: bearer,
        summary: 'Admin: toggle user suspension status',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: success('User suspension toggled successfully') },
      },
    },
    '/users/{id}/block': {
      patch: {
        tags: ['Users'],
        security: bearer,
        summary: 'Admin: toggle user block status',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: success('User block toggled successfully') },
      },
    },
    '/products': {
      post: {
        tags: ['Products'],
        security: bearer,
        summary: 'Admin: create a new product with Cloudinary images',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['title', 'description', 'category', 'condition', 'type', 'images'],
                properties: {
                  title: { type: 'string', example: 'Fender Guitar' },
                  description: { type: 'string', example: 'Used guitar in good condition' },
                  category: { type: 'string', example: 'Music' },
                  condition: {
                    type: 'string',
                    enum: ['new', 'open_box', 'like_new', 'used', 'damaged', 'for_parts', 'brand_new', 'like_new_open_box', 'scratch_and_dent', 'salvage'],
                    example: 'used',
                  },
                  type: {
                    type: 'string',
                    enum: ['for_sale', 'for_auction'],
                    example: 'for_auction',
                    description: 'Product type: for_auction requires day + reservePrice; for_sale requires price + quantity',
                  },
                  day: { type: 'string', example: 'Monday', description: 'Required when type is for_auction' },
                  reservePrice: { type: 'number', example: 150, description: 'Required when type is for_auction' },
                  price: { type: 'number', example: 499, description: 'Required when type is for_sale' },
                  quantity: { type: 'number', example: 10, description: 'Required when type is for_sale' },
                  color: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['Black', 'Blue'],
                    description: 'Optional array of colors',
                  },
                  manufacturer: { type: 'string', example: 'Fender', description: 'Optional manufacturer name' },
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
        summary: 'List products with search, filter, and pagination',
        parameters: [
          { name: 'searchTerm', in: 'query', schema: { type: 'string' }, description: 'Search by title, description, or category (case-insensitive)' },
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filter by exact category name' },
          { name: 'condition', in: 'query', schema: { type: 'string', enum: ['new', 'open_box', 'like_new', 'used', 'damaged', 'for_parts', 'brand_new', 'like_new_open_box', 'scratch_and_dent', 'salvage'] }, description: 'Filter by product condition' },
          { name: 'inventoryStatus', in: 'query', schema: { type: 'string' }, description: 'Filter by inventory status' },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['for_sale', 'for_auction'] }, description: 'Filter by product type' },
          { name: 'minPrice', in: 'query', schema: { type: 'number' }, description: 'Minimum price filter' },
          { name: 'maxPrice', in: 'query', schema: { type: 'number' }, description: 'Maximum price filter' },
          { name: 'priceRange', in: 'query', schema: { type: 'string', enum: ['under_100', '100_500', '500_1000', '1000_5000', '5000_plus'] }, description: 'Predefined price range bucket' },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['buy_now', 'live_auction', 'ending_soon', 'upcoming_auction'] }, description: 'Cross-collection auction status filter' },
          { name: 'fields', in: 'query', schema: { type: 'string' }, description: 'Comma-separated list of fields to include in response (e.g. title,category,price)' },
          { name: 'sortBy', in: 'query', schema: { type: 'string', default: 'createdAt' }, description: 'Field to sort by' },
          { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }, description: 'Sort direction' },
          { name: 'page', in: 'query', schema: { type: 'number', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'number', default: 10 } },
        ],
        responses: { 200: success('Products fetched successfully') },
      },
    },
    '/products/browse': {
      get: {
        tags: ['Products'],
        summary: 'Browse and filter products with multi-select and current bid support',
        description:
          'Public endpoint for browsing products with advanced filtering. Supports multi-select for condition and status, ' +
          'price range filtering, and current bid range filtering via AuctionProduct join. ' +
          'Status and condition accept comma-separated values for multi-select.',
        parameters: [
          { name: 'searchTerm', in: 'query', schema: { type: 'string' }, description: 'Search by title, description, or category (case-insensitive)' },
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filter by exact category name' },
          { name: 'condition', in: 'query', schema: { type: 'string' }, description: 'Filter by condition. Comma-separated for multi-select (e.g. brand_new,salvage)' },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['for_sale', 'for_auction'] }, description: 'Filter by product type' },
          { name: 'priceRange', in: 'query', schema: { type: 'string', enum: ['under_100', '100_500', '500_1000', '1000_5000', '5000_plus'] }, description: 'Predefined price range bucket' },
          { name: 'minPrice', in: 'query', schema: { type: 'number' }, description: 'Minimum retail price' },
          { name: 'maxPrice', in: 'query', schema: { type: 'number' }, description: 'Maximum retail price' },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['buy_now', 'live_auction', 'ending_soon', 'upcoming_auction'] }, description: 'Auction status filter. Comma-separated for multi-select (e.g. live_auction,ending_soon)' },
          { name: 'minBid', in: 'query', schema: { type: 'number' }, description: 'Minimum current bid amount' },
          { name: 'maxBid', in: 'query', schema: { type: 'number' }, description: 'Maximum current bid amount' },
          { name: 'sortBy', in: 'query', schema: { type: 'string', default: 'createdAt' }, description: 'Field to sort by' },
          { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }, description: 'Sort direction' },
          { name: 'page', in: 'query', schema: { type: 'number', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'number', default: 10 } },
        ],
        responses: {
          200: success(
            'Products browsed successfully',
            {
              meta: { page: 1, limit: 10, total: 50, totalPage: 5 },
              data: [
                {
                  inventoryId: 'PRD-000134-07-26',
                  title: 'Samsung Galaxy S24',
                  description: 'Unlocked Samsung Galaxy S24, 128GB, phantom black',
                  category: 'Mobile',
                  condition: 'like_new_open_box',
                  images: [{ public_id: 'products/galaxy-s24_abc', url: 'https://res.cloudinary.com/demo/image/upload/v1/products/galaxy-s24_abc.jpg' }],
                  color: ['Black', 'Green'],
                  type: 'for_sale',
                  quantity: 3,
                  price: 599,
                  manufacturer: 'Samsung',
                  inventoryStatus: 'available',
                },
              ],
            },
          ),
        },
      },
    },
    '/products/bulk': {
      post: {
        tags: ['Products'],
        security: bearer,
        summary: 'Admin: bulk upload products via ZIP file with CSV and images',
        description:
          'Upload a ZIP archive containing a `products.csv` file and an `imageFolder/` directory with product images. ' +
          'The CSV columns are: title, description, category, day, condition, reservePrice, color, imageFolder. ' +
          'Each row\'s imageFolder value must match a subdirectory name inside imageFolder/ in the ZIP. ' +
          'The `type` field determines whether all products in the batch are created as auction or sale items.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file', 'type'],
                properties: {
                  file: { type: 'string', format: 'binary', description: 'ZIP file containing products.csv and imageFolder/' },
                  type: {
                    type: 'string',
                    enum: ['for_sale', 'for_auction'],
                    description: 'Product type for all items in the bulk upload. for_auction supports optional day and reservePrice; for_sale requires price and quantity.',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: success(
            'Bulk product upload processed',
            {
              totalProcessed: 10,
              totalSucceeded: 8,
              totalFailed: 2,
              success: [
                { row: 1, title: 'Apple iPhone 15 Pro', inventoryId: 'PRD-000001-07-26', productId: '64f1...' },
              ],
              failed: [
                { row: 5, title: 'Sony WH-1000XM5', error: 'Image folder "sony-wh1000xm5" not found' },
              ],
            },
          ),
        },
      },
    },
    '/products/inventory': {
      get: {
        tags: ['Products'],
        security: bearer,
        summary: 'Admin: list all inventory products (for_sale and for_auction)',
        description:
          'Returns a paginated list of all products with full details including price, images, manufacturer, and inventory status. ' +
          'Use the type query parameter to filter by for_sale or for_auction.',
        parameters: [
          { name: 'searchTerm', in: 'query', schema: { type: 'string' }, description: 'Search by title or category (case-insensitive)' },
          { name: 'productType', in: 'query', schema: { type: 'string', enum: ['for_sale', 'for_auction'] }, description: 'Filter by product type' },
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filter by exact category name' },
          { name: 'condition', in: 'query', schema: { type: 'string', enum: ['new', 'open_box', 'like_new', 'used', 'damaged', 'for_parts', 'brand_new', 'like_new_open_box', 'scratch_and_dent', 'salvage'] }, description: 'Filter by product condition' },
          { name: 'inventoryStatus', in: 'query', schema: { type: 'string' }, description: 'Filter by inventory status (e.g. available, auction_active)' },
          { name: 'sortBy', in: 'query', schema: { type: 'string', default: 'createdAt' }, description: 'Field to sort by' },
          { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }, description: 'Sort direction' },
          { name: 'page', in: 'query', schema: { type: 'number', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'number', default: 10 } },
        ],
        responses: {
          200: success(
            'Inventory products fetched successfully',
            [
              {
                inventoryId: 'PRD-000134-07-26',
                title: 'Samsung Galaxy S24',
                description: 'Unlocked Samsung Galaxy S24, 128GB, phantom black',
                category: 'Mobile',
                condition: 'like_new',
                images: [{ public_id: 'products/galaxy-s24_abc', url: 'https://res.cloudinary.com/demo/image/upload/v1/products/galaxy-s24_abc.jpg' }],
                color: ['Black', 'Green'],
                type: 'for_sale',
                quantity: 3,
                price: 599,
                manufacturer: 'Samsung',
                inventoryStatus: 'available',
              },
            ],
            { auctions: '/api/v1/products/auctions', allProducts: '/api/v1/products' },
          ),
        },
      },
    },
    '/products/auctions': {
      get: {
        tags: ['Products'],
        security: bearer,
        summary: 'Admin: list auction products with retail view pricing',
        description:
          'Returns a paginated list of products with type "for_auction". By default, only available or unsold products are returned so admins can safely publish selected items to auction. ' +
          'Each item includes inventoryId, title, category, condition, and price (retail view). ' +
          'Use inventoryStatus to intentionally inspect products in another state.',
        parameters: [
          { name: 'searchTerm', in: 'query', schema: { type: 'string' }, description: 'Search by title or category (case-insensitive)' },
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filter by exact category name' },
          { name: 'condition', in: 'query', schema: { type: 'string', enum: ['new', 'open_box', 'like_new', 'used', 'damaged', 'for_parts', 'brand_new', 'like_new_open_box', 'scratch_and_dent', 'salvage'] }, description: 'Filter by product condition' },
          { name: 'inventoryStatus', in: 'query', schema: { type: 'string' }, description: 'Filter by inventory status (e.g. available, auction_active)' },
          { name: 'sortBy', in: 'query', schema: { type: 'string', default: 'createdAt' }, description: 'Field to sort by' },
          { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }, description: 'Sort direction' },
          { name: 'page', in: 'query', schema: { type: 'number', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'number', default: 10 } },
        ],
        responses: {
          200: success(
            'Auction products fetched successfully',
            [
              {
                inventoryId: 'PRD-000138-07-26',
                title: 'Canon EOS R10',
                category: 'Camera',
                condition: 'open_box',
                price: 499,
              },
            ],
            { inventory: '/api/v1/products/inventory', allProducts: '/api/v1/products' },
          ),
        },
      },
    },
    '/products/inventory-monitoring': {
      get: {
        tags: ['Products'],
        security: bearer,
        summary: 'Admin: get inventory monitoring with auction, payment, winner, and pickup state',
        parameters: [
          { name: 'inventoryStatus', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'searchTerm', in: 'query', schema: { type: 'string' }, description: 'Search by title, inventoryId, or category (case-insensitive)' },
        ],
        responses: { 200: success('Inventory monitoring fetched successfully') },
      },
    },
    '/products/{id}': {
      get: {
        tags: ['Products'],
        summary: 'Get product details by ID',
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
                  title: { type: 'string', example: 'Fender Guitar' },
                  description: { type: 'string', example: 'Updated description' },
                  category: { type: 'string', example: 'Music' },
                  condition: {
                    type: 'string',
                    enum: ['new', 'open_box', 'like_new', 'used', 'damaged', 'for_parts', 'brand_new', 'like_new_open_box', 'scratch_and_dent', 'salvage'],
                  },
                  type: {
                    type: 'string',
                    enum: ['for_sale', 'for_auction'],
                    description: 'Product type: for_auction requires day + reservePrice; for_sale requires price + quantity',
                  },
                  day: { type: 'string', example: 'Monday' },
                  reservePrice: { type: 'number', example: 150 },
                  price: { type: 'number', example: 499 },
                  quantity: { type: 'number', example: 10 },
                  color: { type: 'array', items: { type: 'string' }, example: ['Black'] },
                  manufacturer: { type: 'string', example: 'Fender' },
                  inventoryStatus: {
                    type: 'string',
                    enum: ['available', 'auction_active', 'auction_ended', 'winner_assigned', 'payment_pending', 'payment_completed', 'ready_for_pickup', 'pickup_scheduled', 'picked_up', 'completed', 'unsold', 'unavailable'],
                  },
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
        summary: 'Admin: soft-delete an inactive product and remove Cloudinary images',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: success('Product deleted successfully') },
      },
    },
    '/category': {
      post: {
        tags: ['Categories'],
        summary: 'Create a new category with optional image',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Electronics' },
                  image: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
        responses: { 200: success('Category created successfully') },
      },
    },
    '/category/all': {
      get: {
        tags: ['Categories'],
        summary: 'List all categories with pagination',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'number', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'number', default: 10 } },
        ],
        responses: { 200: success('Categories fetched successfully') },
      },
    },
    '/category/{id}': {
      get: {
        tags: ['Categories'],
        summary: 'Get a single category by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: success('Category fetched successfully') },
      },
    },
    '/category/update/{id}': {
      put: {
        tags: ['Categories'],
        summary: 'Update category name and/or image',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: false,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Electronics' },
                  image: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
        responses: { 200: success('Category updated successfully') },
      },
    },
    '/category/toggle/{id}': {
      put: {
        tags: ['Categories'],
        summary: 'Soft-delete or restore a category',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: success('Category status toggled successfully') },
      },
    },
    '/auctions': {
      post: {
        tags: ['Auctions'],
        security: bearer,
        summary: 'Admin: create a new auction',
        description:
          'Create a new auction with one or more products. Each product gets an AuctionProduct entry. ' +
          'The `reservePrice` is optional per-product pricing floor for bidding. ' +
          'Products must have inventoryStatus "available" or "unsold" to be included.',
        requestBody: {
          required: true,
          content: json({
            products: ['productObjectId'],
            title: 'Electronics Auction',
            description: 'Auction for electronic items',
            auctionSchedule: {
              startDate: '2026-08-10',
              startTime: '13:00',
              durationInDays: 1,
            },
            startingBid: 1,
            bidIncrement: 5,
            reservePrice: 150,
            pickupSchedule: {
              startDate: '2026-08-12',
              endDate: '2026-08-15',
              dailyStartTime: '09:00',
              dailyEndTime: '17:00',
              durationInDays: 3,
            },
          }),
        },
        responses: {
          200: success('Auction created successfully', {}, { listAuctions: '/api/v1/auctions' }),
        },
      },
      get: {
        tags: ['Auctions'],
        summary: 'List all auctions with optional status filter and pagination',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'searchTerm', in: 'query', schema: { type: 'string' }, description: 'Search by auctionId or title (case-insensitive)' },
          { name: 'sortBy', in: 'query', schema: { type: 'string', default: 'startsAt' }, description: 'Field to sort by' },
          { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }, description: 'Sort direction' },
          { name: 'page', in: 'query', schema: { type: 'number', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'number', default: 10 } },
        ],
        responses: { 200: success('Auctions fetched successfully') },
      },
    },
    '/auctions/active': {
      get: {
        tags: ['Auctions'],
        summary: 'Get currently active auctions',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'number', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'number', default: 10 } },
        ],
        responses: { 200: success('Active auctions fetched successfully') },
      },
    },
    '/auctions/upcoming': {
      get: {
        tags: ['Auctions'],
        summary: 'Get upcoming auctions',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'number', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'number', default: 10 } },
        ],
        responses: { 200: success('Upcoming auctions fetched successfully') },
      },
    },
    '/auctions/closing-soon': {
      get: {
        tags: ['Auctions'],
        summary: 'Get active auctions ending within 3 days',
        description:
          'Returns currently active auctions that will close within the next 3 days. Each auction includes a computed timeRemaining field (seconds until endsAt) for accurate countdowns.',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'number', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'number', default: 10 } },
        ],
        responses: {
          200: success('Closing soon auctions fetched successfully', {
            meta: { page: 1, limit: 10, total: 3, totalPage: 1 },
            data: [
              {
                auctionId: 'AUC-000042-07-26',
                title: 'Electronics Flash Auction',
                status: 'active',
                startsAt: '2026-07-11T09:00:00.000Z',
                endsAt: '2026-07-14T09:00:00.000Z',
                timeRemaining: 86399,
              },
            ],
          }),
        },
      },
    },
    '/auctions/closed': {
      get: {
        tags: ['Auctions'],
        summary: 'Get ended auctions',
        description:
          'Returns auctions with status ended, sorted by most recently closed first.',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'number', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'number', default: 10 } },
        ],
        responses: {
          200: success('Closed auctions fetched successfully', {
            meta: { page: 1, limit: 10, total: 15, totalPage: 2 },
            data: [
              {
                auctionId: 'AUC-000038-07-26',
                title: 'Furniture Auction',
                status: 'ended',
                startsAt: '2026-07-01T09:00:00.000Z',
                endsAt: '2026-07-08T09:00:00.000Z',
              },
            ],
          }),
        },
      },
    },
    '/auctions/by-day': {
      get: {
        tags: ['Auctions'],
        summary: 'Get available auction days or auction products for a specific day',
        description:
          'Unified endpoint for day-based auction browsing. ' +
          'Without parameters, returns which weekdays have active auctions with counts (for rendering day buttons). ' +
          'With the day query parameter, also returns the auction products with bid details for that day.',
        parameters: [
          {
            name: 'day',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
            },
            description: 'Day name to fetch auctions for. Case-insensitive. When provided, the response includes auction products with bid details.',
          },
        ],
        responses: {
          200: success(
            'Available days fetched successfully',
            {
              availableDays: [
                { day: 'Monday', date: '2026-07-20', auctionCount: 3 },
                { day: 'Tuesday', date: '2026-07-21', auctionCount: 1 },
                { day: 'Thursday', date: '2026-07-23', auctionCount: 5 },
              ],
              selectedDay: null,
              auctions: null,
            },
          ),
        },
      },
    },
    '/auctions/{id}': {
      get: {
        tags: ['Auctions'],
        summary: 'Get auction details by ID with populated products',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: success('Auction details fetched successfully', {}, { products: '/api/v1/auction-products/{id}' }),
        },
      },
    },
    '/auction-products/{auctionId}': {
      get: {
        tags: ['Auction Products'],
        summary: 'Get all products associated with an auction',
        parameters: [{ name: 'auctionId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: success('Auction products fetched successfully') },
      },
    },
    '/bid': {
      post: {
        tags: ['Bids'],
        security: bearer,
        summary: 'Place a bid on an auction product',
        description:
          'User must have a saved default payment method before placing any bid. If no payment method exists, save one using /payments/setup-intents and /payments/default-payment-method first. Minimum bid is either the starting bid or current highest bid + bid increment.',
        requestBody: {
          required: true,
          content: json({
            auctionProductId: 'auctionProductObjectId',
            amount: 205,
          }),
        },
        responses: {
          200: success('Bid placed successfully', {}, { savePaymentMethod: '/api/v1/payments/setup-intents' }),
          400: {
            description: 'User has no default payment method or bid validation failed',
            content: json({
              success: false,
              message: 'You must have a saved payment method before placing a bid.',
            }),
          },
        },
      },
    },
    '/payments/setup-intents': {
      post: {
        tags: ['Payments'],
        security: bearer,
        summary: 'Create a Stripe SetupIntent for saved-card registration',
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
              testHelper: '/api/v1/payments/test-default-payment-method',
            },
          ),
        },
      },
    },
    '/payments/setup-intents/{setupIntentId}': {
      get: {
        tags: ['Payments'],
        security: bearer,
        summary: 'Check SetupIntent status to see if it can be saved as default',
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
        summary: 'Save a confirmed Stripe SetupIntent payment method as the user default card',
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
        summary: 'Dev/test: save a Stripe test card for bidding tests',
        description:
          'Only works outside production with a Stripe test secret key. Uses Stripe test payment method IDs (default: pm_card_visa).',
        requestBody: { required: false, content: json({ testPaymentMethodId: 'pm_card_visa' }) },
        responses: {
          200: success(
            'Test default payment method saved successfully',
            {},
            { placeBid: '/api/v1/bid' },
          ),
        },
      },
    },
    '/payments/webhook': {
      post: {
        tags: ['Payments'],
        summary: 'Stripe webhook receiver for payment events',
        description:
          'Handles asynchronous Stripe events. Requires Stripe webhook signature verification via X-Stripe-Signature header. Configured events: payment_intent.succeeded, payment_intent.payment_failed, charge.refunded, customer.deleted.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object' },
              example: {
                id: 'evt_123',
                type: 'payment_intent.succeeded',
                data: {
                  object: {
                    id: 'pi_123',
                    amount: 5000,
                    currency: 'usd',
                    status: 'succeeded',
                  },
                },
              },
            },
          },
        },
        parameters: [
          {
            name: 'X-Stripe-Signature',
            in: 'header',
            required: true,
            description: 'Stripe webhook signature for verification',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: success('Webhook received and processed', { received: true, eventType: 'payment_intent.succeeded' }),
          400: {
            description: 'Invalid signature or missing webhook secret',
            content: json({ success: false, message: 'Webhook Error: signature verification failed' }),
          },
        },
      },
    },
    '/invoices/me': {
      get: {
        tags: ['Invoices'],
        security: bearer,
        summary: 'Customer: list own invoices',
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
        summary: 'Admin: verify a pickup QR token or pickup code',
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
        summary: 'Admin: create a pickup capacity slot',
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
        summary: 'List available pickup slots for scheduling',
        responses: { 200: success('Available pickup slots fetched successfully') },
      },
    },
    '/pickups/slots/all': {
      get: {
        tags: ['Pickups'],
        summary: 'List all pickup slots including inactive or full ones',
        responses: { 200: success('All pickup slots fetched successfully') },
      },
    },
    '/pickups/ready-invoices': {
      get: {
        tags: ['Pickups'],
        security: bearer,
        summary: 'Customer: list paid invoices that are ready for pickup',
        responses: { 200: success('Ready pickup invoices fetched successfully') },
      },
    },
    '/pickups': {
      post: {
        tags: ['Pickups'],
        security: bearer,
        summary: 'Customer: schedule a pickup appointment for paid invoices',
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
        summary: 'Customer: list own pickup appointments',
        responses: { 200: success('Your pickup appointments fetched successfully') },
      },
    },
    '/pickups/complete': {
      post: {
        tags: ['Pickups'],
        security: bearer,
        summary: 'Admin: complete warehouse handover by pickup code',
        requestBody: {
          required: true,
          content: json({ appointmentId: 'pickupAppointmentObjectId', pickupCode: 'A1B2C3D4', notes: 'Customer picked up all items.' }),
        },
        responses: { 200: success('Pickup completed successfully') },
      },
    },
    '/contacts': {
      post: {
        tags: ['Contacts'],
        summary: 'Send a contact form message',
        requestBody: {
          required: true,
          content: json({
            firstName: 'John',
            lastName: 'Doe',
            email: 'customer@example.com',
            phone: '+15555555555',
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
        summary: 'Admin: get revenue summary from paid invoices',
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
        summary: 'Admin: get auction outcome summary',
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
        summary: 'Admin: get pickup workload summary',
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
        summary: 'Admin: get inventory status summary',
        responses: { 200: success('Inventory report fetched successfully') },
      },
    },
    '/settings': {
      get: {
        tags: ['Settings'],
        security: bearer,
        summary: 'Admin: get platform pickup and storage settings',
        responses: { 200: success('Platform settings fetched successfully') },
      },
      patch: {
        tags: ['Settings'],
        security: bearer,
        summary: 'Admin: update platform pickup deadline and storage fee rules',
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
        summary: 'Get customer-visible pickup policy',
        responses: { 200: success('Platform public settings fetched successfully') },
      },
    },
    '/notifications': {
      get: {
        tags: ['Notifications'],
        security: bearer,
        summary: 'Admin: list notifications with pagination',
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
        summary: 'Admin: mark all notifications as read',
        responses: { 200: success('All notifications marked as read successfully') },
      },
    },
    '/orders/checkout': {
      post: {
        tags: ['Orders'],
        security: bearer,
        summary: 'Start cart checkout session',
        description: 'Validates cart products and stock, creates a pending order, and returns a Stripe Checkout Session URL.',
        responses: {
          200: success('Stripe checkout session created successfully', {
            checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_...'
          }),
          400: errorResponse,
        },
      },
    },
    '/orders/webhook': {
      post: {
        tags: ['Orders'],
        summary: 'Stripe webhook receiver for orders',
        description: 'Processes checkout.session.completed webhook events to mark orders as paid, deduct stock, and clear customer carts.',
        responses: {
          200: success('Webhook processed successfully', {
            success: true
          }),
          400: errorResponse,
        },
      },
    },
    '/orders/me': {
      get: {
        tags: ['Orders'],
        security: bearer,
        summary: 'Retrieve logged-in user\'s orders',
        responses: {
          200: success('Your orders retrieved successfully', [
            {
              orderNumber: 'ORD-2026-1001',
              totalAmount: 150.00,
              status: 'paid',
              items: [
                {
                  product: { title: 'Sample Product' },
                  quantity: 1,
                  price: 150.00
                }
              ]
            }
          ]),
        },
      },
    },
    '/orders': {
      get: {
        tags: ['Orders'],
        security: bearer,
        summary: 'Admin: Retrieve all orders',
        responses: {
          200: success('All orders retrieved successfully', [
            {
              orderNumber: 'ORD-2026-1001',
              customer: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
              totalAmount: 150.00,
              status: 'paid',
              items: [
                {
                  product: { title: 'Sample Product' },
                  quantity: 1,
                  price: 150.00
                }
              ]
            }
          ]),
        },
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
