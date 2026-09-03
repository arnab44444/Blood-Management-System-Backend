# 💉 Blood Management System – REST API Backend

A scalable, secure, and production-ready RESTful backend service powering the Blood Management & Donation platform. Built with **Node.js**, **Express 5**, **MongoDB Native Driver**, **JSON Web Tokens (JWT)**, and deployed serverless on **Vercel**.

---

## 🚀 Core Features

- **🔐 Authentication & Role-Based Access Control (RBAC):** Supports `donor`, `patient`, and `admin` roles with encrypted password hashing (`bcryptjs`) and secure JWT token verification.
- **🩸 Donor Directory & Search:** Filter donors dynamically by blood group, district, and verified standing.
- **⏱️ Automated Cooldown Logic:** Enforces medical donation cooldown periods (90 days) between blood donations.
- **🚨 Emergency Blood Request Pipeline:** Manages the full request lifecycle (`pending` ➔ `approved` ➔ `donated` / `rejected`).
- **🤝 Contact & Response Coordination:** Facilitates matching between willing donors and patients in need.
- **🛡️ Admin Oversight & Verification:** Audit logs, donor authorization, request moderation, and platform statistics.
- **⚡ Serverless Deployment Ready:** Optimized for zero-downtime serverless execution on Vercel with automatic MongoDB connection caching.

---

## 🛠️ Technology Stack

- **Runtime:** [Node.js](https://nodejs.org/) (v18+)
- **Web Framework:** [Express 5](https://expressjs.com/)
- **Database:** [MongoDB Atlas](https://www.mongodb.com/atlas) (Native Driver `mongodb` v7)
- **Security & Encryption:** [bcryptjs](https://www.npmjs.com/package/bcryptjs) & [jsonwebtoken (JWT)](https://www.npmjs.com/package/jsonwebtoken)
- **CORS Management:** [cors](https://www.npmjs.com/package/cors)
- **Deployment:** [Vercel Serverless Functions](https://vercel.com/)

---

## 📂 Project Structure

```text
Blood-Management-System-Backend/
├── routes/
│   ├── auth.js             # User login, registration & token issue
│   ├── donors.js           # Donor profile, availability, and cooldowns
│   ├── bloodRequests.js    # Patient blood request CRUD
│   ├── requestContact.js   # Donor matching & response intents
│   ├── admin.js            # Admin moderation, verifications & history
│   └── public.js           # Public metrics & search endpoints
├── middleware/
│   ├── auth.js             # JWT bearer verification middleware
│   └── adminOnly.js        # Admin authorization guard
├── db.js                   # Cached MongoDB client connection handler
├── index.js                # Express app initialization & route mounting
├── seed-admin.js           # Initial admin creation script
├── vercel.json             # Vercel serverless routing configuration
└── package.json            # Scripts & project dependencies
```

---

## 📡 API Endpoints Reference

### 1. Authentication (`/api/auth`)
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register a new user (Donor or Patient) | Public |
| `POST` | `/api/auth/login` | Authenticate user & receive JWT token | Public |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Private |

### 2. Donors (`/api/donors`)
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/donors/search` | Search verified donors by blood group & district | Public / User |
| `GET` | `/api/donors/profile` | Get current donor profile & cooldown status | Donor |
| `PATCH` | `/api/donors/profile` | Update profile information | Donor |
| `PATCH` | `/api/donors/availability` | Toggle availability status | Donor |
| `GET` | `/api/donors/notifications`| Get urgent requests matching donor's blood type | Donor |
| `GET` | `/api/donors/donation-history`| View past completed donations | Donor |

### 3. Blood Requests (`/api/blood-requests`)
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/blood-requests` | Create an emergency blood request | Patient / User |
| `GET` | `/api/blood-requests` | List all active approved blood requests | Public / User |
| `GET` | `/api/blood-requests/my` | List requests created by current user | Patient / User |
| `GET` | `/api/blood-requests/:id` | Fetch specific request details | Private |
| `PATCH` | `/api/blood-requests/:id`| Update request status or details | Owner / Admin |

### 4. Admin Management (`/api/admin`)
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/stats` | System statistics (Counts, Pending, Active) | Admin |
| `GET` | `/api/admin/donors` | List all registered donors for review | Admin |
| `PATCH` | `/api/admin/donors/:id/verify` | Verify donor identity | Admin |
| `PATCH` | `/api/admin/requests/:id/status` | Approve or Reject blood requests | Admin |
| `GET` | `/api/admin/donation-history` | Global audit log of fulfilled donations | Admin |

---

## ⚙️ Local Development Setup

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **MongoDB Connection URI** (MongoDB Atlas or local instance)

### 2. Installation

Clone the repository and install dependencies:

```bash
cd Blood-Management-System-Backend
npm install
```

### 3. Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000
NODE_ENV=development

# MongoDB Connection String
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/blood_management?retryWrites=true&w=majority

# JWT Secret for token signing
JWT_SECRET=your_super_secret_jwt_key_here
```

### 4. Seed Initial Super Admin (Optional)

Run the admin seeding script to create default administrative credentials:

```bash
npm run seed-admin
```

### 5. Running Locally

Start the server in development mode with nodemon:

```bash
npm run dev
```

The server will be running at `http://localhost:5000`.

---

## ☁️ Deployment (Vercel)

This backend is configured for deployment with Vercel Serverless Functions using `vercel.json`:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "index.js"
    }
  ]
}
```

### Environment Variables on Vercel:
Ensure you add the following Environment Variables in your Vercel Project Settings:
- `MONGODB_URI`
- `JWT_SECRET`
- `NODE_ENV=production`

---

## 📄 License
This project is licensed under the [ISC License](LICENSE).
