# 🔐 IAM Backend — Identity Access Management System

A production-ready **Role-Based Access Control (RBAC)** backend built with **Node.js**, **Express.js**, and **MongoDB (Mongoose)**. Users are assigned Roles, and Roles contain multiple Permissions — controlling exactly what each user can do.

---

## 🧱 Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | Runtime environment |
| Express.js | HTTP framework |
| MongoDB + Mongoose | Database + ODM |
| JWT (jsonwebtoken) | Stateless authentication |
| bcryptjs | Password hashing |
| dotenv | Environment variable management |
| CORS | Cross-Origin Resource Sharing |
| Nodemon | Auto-restart in development|

---

## 📁 Project Structure

```
Backend/
│
├── config/
│   └── db.js                  # MongoDB connection via Mongoose
│
├── models/
│   ├── Permission.js          # Permission schema (name, description)
│   ├── Role.js                # Role schema (name, permissions[])
│   └── User.js                # User schema (name, email, password, role, isActive)
│
├── controllers/
│   ├── authController.js      # register, login, logout, getMe
│   ├── userController.js      # CRUD for user management
│   ├── roleController.js      # CRUD for role management
│   └── permissionController.js# CRUD for permission management
│
├── middleware/
│   ├── authMiddleware.js      # JWT verification → sets req.user
│   └── permissionMiddleware.js# RBAC enforcement → checkPermission()
│
├── routes/
│   ├── authRoutes.js          # /auth/*
│   ├── userRoutes.js          # /users/*
│   ├── roleRoutes.js          # /roles/*
│   └── permissionRoutes.js    # /permissions/*
│
├── seed/
│   └── seedData.js            # Seeds default permissions, roles, admin user
│
├── server.js                  # App entry point
├── .env                       # Environment variables
└── package.json
```

---

## ⚙️ Environment Variables (`.env`)

```env
PORT=5001
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/iam_db
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=12
```

---

## 🚀 Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Start MongoDB
Make sure MongoDB is running locally on port `27017`.

### 3. Seed the database
```bash
npm run seed
```
This creates all permissions, roles, and the default admin user.

### 4. Start the development server
```bash
npm run dev
```
Server runs at: `http://localhost:5001`

---

## 🗄️ Database Design

### Permission Model
| Field | Type | Notes |
|---|---|---|
| `name` | String | Unique, lowercase (e.g. `manage_users`) |
| `description` | String | Human-readable description |
| `createdAt` | Date | Auto-generated |
| `updatedAt` | Date | Auto-generated |

### Role Model
| Field | Type | Notes |
|---|---|---|
| `name` | String | Unique (e.g. `Admin`, `Manager`) |
| `permissions` | ObjectId[] | Array of refs to Permission collection |
| `createdAt` | Date | Auto-generated |
| `updatedAt` | Date | Auto-generated |

### User Model
| Field | Type | Notes |
|---|---|---|
| `name` | String | Full name |
| `email` | String | Unique, lowercase |
| `password` | String | bcrypt hash, excluded from queries by default |
| `role` | ObjectId | Ref to Role collection |
| `isActive` | Boolean | Default `true` — soft disable users |
| `createdAt` | Date | Auto-generated |
| `updatedAt` | Date | Auto-generated |

---

## 🔐 Authentication Flow

```
Client                        Server
  │                              │
  │  POST /auth/login            │
  │  { email, password }  ──────►│
  │                              │  1. Find user by email
  │                              │  2. Compare password with bcrypt hash
  │                              │  3. Generate JWT { userId, role }
  │◄─────────────────────────────│
  │  { token, user }             │
  │                              │
  │  GET /users                  │
  │  Authorization: Bearer token │
  │  ──────────────────────────► │  4. Verify JWT signature
  │                              │  5. Attach req.user
  │                              │  6. Check role permissions (RBAC)
  │◄─────────────────────────────│
  │  { users[] }                 │
```

**JWT Payload:**
```json
{
  "userId": "64abc123...",
  "role": "64def456...",
  "iat": 1234567890,
  "exp": 1235172690
}
```

---

## 🔒 RBAC Permission Matrix

| Permission | Admin | Manager | User |
|---|:---:|:---:|:---:|
| `manage_users` | ✅ | ❌ | ❌ |
| `view_users` | ✅ | ✅ | ❌ |
| `create_users` | ✅ | ❌ | ❌ |
| `delete_users` | ✅ | ❌ | ❌ |
| `manage_roles` | ✅ | ❌ | ❌ |
| `view_roles` | ✅ | ❌ | ❌ |
| `manage_permissions` | ✅ | ❌ | ❌ |
| `view_dashboard` | ✅ | ✅ | ✅ |

---

## 🛡️ Middleware

### `authMiddleware.js` — `protect`
- Extracts Bearer token from `Authorization` header
- Verifies JWT signature using `JWT_SECRET`
- Fetches user from DB to confirm existence and active status
- Attaches `req.user = { userId, role, name, email }` for downstream use

### `permissionMiddleware.js` — `checkPermission(permissionName)`
- Fetches the user's role from DB and populates its permissions
- Checks if the required permission name exists in the role's permissions array
- Returns `403 Forbidden` if the permission is missing

**Usage in routes:**
```js
router.get("/users", protect, checkPermission("manage_users"), getAllUsers);
```

---

## 📡 API Reference

### Base URL: `http://localhost:5001`

---

### 🔑 Auth Routes — `/auth`

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register a new user |
| `POST` | `/auth/login` | Public | Login and receive JWT |
| `POST` | `/auth/logout` | Protected | Logout (client discards token) |
| `GET` | `/auth/me` | Protected | Get current user's profile + permissions |

#### POST `/auth/register`
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "roleName": "User"
}
```

#### POST `/auth/login`
```json
{
  "email": "admin@iam.com",
  "password": "admin123"
}
```

---

### 👥 User Routes — `/users`
> All routes require `Authorization: Bearer <token>` + `manage_users` permission

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/users` | Get all users |
| `GET` | `/users/:id` | Get user by ID |
| `POST` | `/users` | Create a new user |
| `PUT` | `/users/:id` | Update a user |
| `DELETE` | `/users/:id` | Delete a user |

#### POST `/users` — Create User
```json
{
  "name": "Jane Manager",
  "email": "jane@iam.com",
  "password": "jane1234",
  "roleName": "Manager"
}
```

#### PUT `/users/:id` — Update User
```json
{
  "name": "Jane Senior Manager",
  "isActive": true
}
```

---

### 🎭 Role Routes — `/roles`
> All routes require `Authorization: Bearer <token>` + `manage_roles` permission

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/roles` | Get all roles with populated permissions |
| `POST` | `/roles` | Create a new role |
| `PUT` | `/roles/name/:roleName` | Update role by name *(no ID needed)* |
| `PUT` | `/roles/:id` | Update role by ObjectId |
| `DELETE` | `/roles/:id` | Delete a role |

#### POST `/roles` — Create Role
```json
{
  "name": "Auditor",
  "permissionNames": ["view_users", "view_dashboard"]
}
```

#### PUT `/roles/name/Auditor` — Update Role by Name
```json
{
  "permissionNames": ["view_users", "view_dashboard", "manage_users"]
}
```

---

### 🔑 Permission Routes — `/permissions`
> All routes require `Authorization: Bearer <token>` + `manage_permissions` permission

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/permissions` | Get all permissions |
| `POST` | `/permissions` | Create a new permission |
| `DELETE` | `/permissions/:id` | Delete a permission |

#### POST `/permissions` — Create Permission
```json
{
  "name": "export_reports",
  "description": "Ability to export system reports"
}
```

---

## 🌱 Seed Data

Run `npm run seed` to bootstrap:

**Permissions (8):**
`manage_users`, `view_users`, `create_users`, `delete_users`, `manage_roles`, `view_roles`, `manage_permissions`, `view_dashboard`

**Roles (3):**
- **Admin** → All 8 permissions
- **Manager** → `view_users`, `view_dashboard`
- **User** → `view_dashboard`

**Default Admin User:**
| Field | Value |
|---|---|
| Email | `admin@iam.com` |
| Password | `admin123` |
| Role | Admin |

---

## 🔐 Security Features

| Feature | Implementation |
|---|---|
| Password hashing | bcrypt with 12 salt rounds via Mongoose pre-save hook |
| Password never returned | `select: false` on password field in User schema |
| JWT authentication | Signed with `JWT_SECRET`, expires in `JWT_EXPIRES_IN` |
| Route protection | `protect` middleware on all non-public routes |
| RBAC enforcement | `checkPermission()` middleware per route |
| Self-delete prevention | Users cannot delete their own account |
| Role delete safety | Roles assigned to users cannot be deleted |
| Permission delete safety | Permissions used by roles cannot be deleted |

---

## 🧪 Postman Quick Reference

### 1. Login → copy token
```
POST http://localhost:5001/auth/login
Body: { "email": "admin@iam.com", "password": "admin123" }
```

### 2. Use token in all subsequent requests
```
Header → Authorization: Bearer <token>
```

### 3. Auto-save token with Postman Test Script
Paste this in the **Tests** tab of your Login request:
```javascript
const res = pm.response.json();
if (res.token) {
    pm.collectionVariables.set("token", res.token);
}
```
Then use `{{token}}` in all Authorization headers.

---

## 📦 NPM Scripts

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `nodemon server.js` | Start with auto-restart |
| `npm start` | `node server.js` | Start in production mode |
| `npm run seed` | `node seed/seedData.js` | Seed database with defaults |

---

## 🐛 Common Issues

| Error | Cause | Fix |
|---|---|---|
| `EADDRINUSE :::5000` | Port 5000 taken by macOS AirPlay | Use port `5001` (already configured) or disable AirPlay Receiver |
| `Invalid email or password` | Seed not run yet | Run `npm run seed` first |
| `CastError: Cast to ObjectId failed` | Placeholder text used instead of real ID | Copy the actual `_id` from a GET response |
| `Token is invalid` | Expired or malformed token | Login again to get a fresh token |
| `Role not found` | Seed not run | Run `npm run seed` |
