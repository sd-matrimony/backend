# sdm-backend

A backend service built using **Hono.js** for routing, **MongoDB + Mongoose** for database interactions, **Cloudinary** for image uploads, **Phonepay** as the payment gateway and **Nodemailer** for sending emails.

## 🛠 Tech Stack

* [Hono.js](https://hono.dev/) – Lightweight web framework for building APIs
* [MongoDB](https://www.mongodb.com/) + [Mongoose](https://mongoosejs.com/) – NoSQL database with a flexible schema layer
* [Cloudinary](https://cloudinary.com/) – Image hosting and transformation
* [Phonepay](https://developer.phonepe.com/) – Payment gateway integration
* [Nodemailer](https://nodemailer.com/) – Email sending

---

## ✨ Current Features

- 🔐 **Authentication & Authorization** (JWT-based access & refresh tokens)  
- 👤 **Role based Access** restrict users based on role
- 📷 **Image Uploads** using Cloudinary (with transformations)  
- 💳 **Payment Integration** via Phonepay (subscription plans, profile unlocks, etc.)  
- 📧 **Email Notifications** (signup verification, password reset, etc.)  
- 🛡 **Security Support** (auth guards, request validation, rate limit)  
- 🕵️ **Advanced Search & Filters** for matchmaking with personal & partner preferences
- 📊 **Admin Dashboard APIs** (basic user/admin management, payments for super admin)  


## 🚀 Planned / Upcoming Features

- 🔔 **Real-time Notifications** (possibly via WebSockets or push notifications)  
- 💬 **In-app Messaging / Chat System** 
- 📈 **Activity Tracking & Analytics** (profile views, interests, etc.)  
- 🧪 **Testing Setup** vitest support
- 📖 **API Documentation** – Add Swagger / Postman collection for easy API exploration (currently VS code rest client support available)
- 🤖 **Extracting user images and info using Ollama AI server** 

---


## 📦 Getting Started

### Prerequisites

* Node.js (v18+ recommended)
* MongoDB URI
* Cloudinary credentials
* Phonepay API keys
* Email keys

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/glRajkumar/sdm-matrimony-backend.git
cd sdm-backend
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

Create a `.env` file in the root directory and add the following:

```env
MONGODB_URI=

ACCESS_TOKEN_SECRET=
REFRESH_TOKEN_SECRET=

CLOUDINARY_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_SECRET=

FRONTEND_URL=

EMAIL_ID=
EMAIL_PASS=
EMAIL_HOST=

PHONE_PAY_CLIENT_ID=
PHONE_PAY_SECRET=
```

### Running the server

Start the development server:

```bash
npm run dev
```

The API will be available at: `http://localhost:PORT` (default: `5000`)

---

## 📁 Project Structure

```
sdm-backend/
├── src/
│   ├── controllers/     # Request handlers
│   ├── middlewares/     # Middleware functions
│   ├── models/          # Mongoose models
│   ├── routes/          # API routes
│   ├── utils/           # Utility functions
│   └── index.ts         # Entry point
├── test/                # http test files for testing api routes using rest client
├── .env                 # Environment variables
├── package.json
└── README.md
```
