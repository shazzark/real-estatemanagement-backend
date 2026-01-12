---

## **Backend README.md**

````markdown
# Luxe Estates - Backend API

![API Architecture](https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200)

RESTful API backend for Luxe Estates real estate platform. Built with Node.js, Express, and MongoDB. Provides authentication, property management, booking system, and payment processing.

## 🚀 API Base URL

**Production:** `https://real-estatemanagement-backend-api.onrender.com/api/v1`

**Local:** `http://localhost:3000/api/v1`

## 📋 Features

### 🔐 Authentication & Authorization

- JWT-based authentication with HttpOnly cookies
- Role-based access control (user, agent, admin)
- Secure password hashing with bcrypt
- Password reset with email tokens

### 🏠 Property Management

- CRUD operations for properties
- Advanced filtering and searching
- Image upload with Multer
- Property categorization and tagging

### 👤 User Management

- User registration and profile management
- Agent application system
- Admin user management
- Activity logging

### 📅 Booking System

- Property booking with date validation
- Booking status management
- Cancellation and modification
- Email notifications

### 💰 Payment Processing

- Paystack integration for payments
- Payment verification webhooks
- Transaction history
- Refund processing

### 📊 Data Management

- MongoDB with Mongoose schemas
- Data validation and sanitization
- Aggregation pipelines for analytics
- Pagination and sorting

## 🛠️ Tech Stack

- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **MongoDB** - NoSQL database
- **Mongoose** - ODM for MongoDB
- **JWT** - JSON Web Tokens
- **bcryptjs** - Password hashing
- **multer** - File upload handling
- **nodemailer** - Email sending
- **cors** - Cross-origin resource sharing
- **helmet** - Security headers
- **express-rate-limit** - Rate limiting
- **validator** - Input validation

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/luxe-estates-backend.git
cd luxe-estates-backend
```
````
