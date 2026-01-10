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

app.use(
  cors({
    origin: ['http://localhost:3001', 'http://172.23.192.1:3001'],
    credentials: true,
  }),
);

app.use(cookieParser());

// SET SECURITY HTTP HEADERS
app.use(helmet());

app.use(
  '/img',
  (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3001');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // key for images
    next();
  },
  express.static(path.join(__dirname, 'img')),
);

// app.use('/img', express.static(path.join(__dirname, 'public/img')));
// GLOBAL MIDDLEWARE

// if (process.env.NODE_ENV === "development") {
//   app.use(morgan("dev"));
// }

// for development logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}
// listen to request from api
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'too many request from this IP, try again later',
});

app.use('/api', limiter);

// body parser , reading data from body into req.body
// app.use(express.json({ limit: '10mb' }));
app.use(express.json({ limit: '10kb' })); // This line must be present
app.use(express.urlencoded({ limit: '10mb', extended: true }));
// app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// data sanitization against  nosql query injection
app.use(mongoSanitize());

// data sanitisation against xss
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

      // GEOGRAPHIC FIELDS
      'coordinates',
    ],
  }),
);

app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

app.use('/img', express.static(path.join(__dirname, 'public/img')));

// ROUTES

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

// app.use('/api/v1/auth', authRouter);

app.all('*', (req, res, next) => {
  next(new AppError(`cant find ${req.originalUrl} on this server`));
});

// app.use((err, req, res, next) => {
//   console.log('>>> SIMPLE ERROR HANDLER CALLED');
//   console.log('>>> Error message:', err.message);
//   console.log('>>> Error status:', err.statusCode);

//   res.status(err.statusCode || 500).json({
//     status: err.status || 'error',
//     message: err.message,
//   });
// });
// error handling middleware
app.use(globalErrorHandler);
module.exports = app;
