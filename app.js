const express = require('express');
const morgan = require('morgan');
const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const multer = require('multer');

const propertiesRouter = require('./routes/propertiesRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewsRoutes');
const locationRouter = require('./routes/locationRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const WishlistRouter = require('./routes/wishlistRoutes');
const AgentRouter = require('./routes/agentRoutes');
const NotificationRouter = require('./routes/notificationRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const agentApplicationRoutes = require('./routes/agentApplicationRoutes');

const app = express();

// ------------------- MIDDLEWARES -------------------
app.use(cookieParser());
app.set('trust proxy', 1);

// SECURITY HEADERS
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);

// ------------------- CORS -------------------
// Allowed frontend origins
// const allowedOrigins = [
//   'http://localhost:3001',
//   'http://192.168.0.146:3001',
//   // 'https://your-frontend-domain.com', // replace with your deployed frontend
// ];
app.use(
  cors({
    origin: ['http://localhost:3001', 'https://luxe-estates-app.vercel.app'],
    credentials: true,
    exposedHeaders: ['Set-Cookie'],
    // Add these options:
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  }),
);

// app.use(
//   cors({
//     origin: function (origin, callback) {
//       if (!origin) return callback(null, true); // allow Postman / curl
//       if (allowedOrigins.includes(origin)) return callback(null, true);
//       callback(new Error('Not allowed by CORS'));
//     },
//     credentials: true, // allow cookies
//     exposedHeaders: ['Content-Disposition'], // for file downloads
//   }),
// );

// Logger for requests
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ------------------- RATE LIMIT -------------------
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, try again later',
});

// Apply rate limiting to all API routes
app.use('/api', (req, res, next) => {
  // Skip rate-limit for file uploads
  if (
    req.method === 'POST' &&
    req.originalUrl.startsWith('/api/v1/properties')
  ) {
    return next();
  }
  limiter(req, res, next);
});

// ------------------- BODY PARSERS -------------------
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// DATA SANITIZATION
app.use(mongoSanitize());
app.use(xss());

// PREVENT PARAMETER POLLUTION
app.use(
  hpp({
    whitelist: [
      'price',
      'ratingAverage',
      'bedrooms',
      'bathrooms',
      'area',
      'yearBuilt',
      'ratingQuantity',
      'coordinates',
    ],
  }),
);

app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// ------------------- STATIC FILES & IMAGES -------------------
// Serve images with proper headers
app.use(
  '/api/v1/img',
  express.static(path.join(__dirname, 'public/img'), {
    setHeaders: (res, filePath) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      if (process.env.NODE_ENV !== 'production') {
        console.log(`📸 Serving image: ${filePath}`);
      }
    },
  }),
);

app.use(
  '/img',
  express.static(path.join(__dirname, 'public/img'), {
    setHeaders: (res, filePath) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      if (process.env.NODE_ENV !== 'production') {
        console.log(`📸 Serving image: ${filePath}`);
      }
    },
  }),
);

// ------------------- MULTER FOR FILE UPLOADS -------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/img'); // save to public/img
  },
  filename: (req, file, cb) => {
    const ext = file.mimetype.split('/')[1];
    cb(null, `property-${Date.now()}.${ext}`);
  },
});

const upload = multer({ storage });

// Example route to test image upload
app.post('/api/v1/upload', upload.single('image'), (req, res) => {
  res.status(201).json({ status: 'success', file: req.file });
});

// ------------------- ROUTES -------------------
app.use('/api/v1/properties', propertiesRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/location', locationRouter);
app.use('/api/v1/bookings', bookingRouter);
app.use('/api/v1/agents', AgentRouter);
app.use('/api/v1/wishlist', WishlistRouter);
app.use('/api/v1/notifications', NotificationRouter);
app.use('/api/v1/review', reviewRouter);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/agent-applications', agentApplicationRoutes);

// Test root route
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Real Estate API is running' });
});

// ------------------- UNHANDLED ROUTES -------------------
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});

// GLOBAL ERROR HANDLER
app.use(globalErrorHandler);

module.exports = app;
