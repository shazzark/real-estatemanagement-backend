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
// const dotenv = require('dotenv');

// dotenv.config({ path: './config.env' });

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

// const authRouter = require('./routes/authRoutes');

const app = express();

/* =========================================================
   ✅ REQUIRED FIX FOR RENDER + EXPRESS-RATE-LIMIT
   ========================================================= */
app.set('trust proxy', 1);

// ==================== FIX 1: Update CORS ====================
app.use(
  cors({
    origin: [
      'http://localhost:3001',
      'http://172.23.192.1:3001',
      'https://real-estate-frontend.onrender.com',
      'http://localhost:3000',
      'https://real-estate-frontend.vercel.app',
    ],
    credentials: true,
  }),
);

app.use(cookieParser());

// SET SECURITY HTTP HEADERS
app.use(helmet());

// ==================== FIX CORS for Images ====================
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://172.23.192.1:3001',
  'https://real-estate-frontend.onrender.com',
  'https://real-estate-frontend.vercel.app',
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  }),
);

// ==================== FIX Image Static Serving ====================
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

// ==================== FIX 3: Update Image Serving ====================
app.use(
  '/img',
  express.static(path.join(__dirname, 'public/img'), {
    setHeaders: (res, filePath) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cache-Control', 'public, max-age=31536000');

      if (process.env.NODE_ENV !== 'production') {
        console.log(`Serving image: ${filePath}`);
      }
    },
  }),
);

// for development logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ==================== RATE LIMITER ====================
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'too many request from this IP, try again later',
});

// app.use('/api', limiter);

app.use('/api', (req, res, next) => {
  // Skip rate-limit for file uploads
  if (
    req.method === 'POST' &&
    req.originalUrl.startsWith('/api/v1/properties')
  ) {
    return next();
  }

  return limiter(req, res, next);
});

// ==================== BODY PARSERS ====================
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// data sanitization against NoSQL injection
app.use(mongoSanitize());

// data sanitization against XSS
app.use(xss());

// prevent parameter pollution
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

// ==================== ROUTES ====================
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

app.all('*', (req, res, next) => {
  next(new AppError(`cant find ${req.originalUrl} on this server`));
});

app.use(globalErrorHandler);

module.exports = app;
