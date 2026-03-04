# 🖥️ IAM Frontend Development Guide

Complete guide to building a frontend for the IAM (Identity Access Management) backend.

> **Backend base URL:** `http://localhost:5001`
> **Stack recommended:** React + Vite + Tailwind CSS + Axios

---

## 📁 Recommended Project Structure

```
Frontend/
│
├── public/
│
├── src/
│   ├── api/                    # All Axios API call functions
│   │   ├── axiosInstance.js    # Base axios setup with interceptors
│   │   ├── authApi.js          # login, register, logout, getMe
│   │   ├── userApi.js          # CRUD + disable/enable
│   │   ├── roleApi.js          # CRUD for roles
│   │   ├── permissionApi.js    # CRUD for permissions
│   │   └── sessionApi.js       # Session management + audit logs
│   │
│   ├── context/
│   │   └── AuthContext.jsx     # Global auth state (user, token, role)
│   │
│   ├── hooks/
│   │   ├── useAuth.js          # useContext(AuthContext) shorthand
│   │   └── usePermission.js    # hasPermission("manage_users") helper
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Navbar.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── ui/
│   │   │   ├── Table.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── Badge.jsx
│   │   │   └── ConfirmDialog.jsx
│   │   └── shared/
│   │       └── LoadingSpinner.jsx
│   │
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── DashboardPage.jsx
│   │   ├── UsersPage.jsx
│   │   ├── RolesPage.jsx
│   │   ├── PermissionsPage.jsx
│   │   ├── SessionsPage.jsx
│   │   └── AuditLogsPage.jsx
│   │
│   ├── utils/
│   │   └── tokenStorage.js     # localStorage helpers
│   │
│   ├── App.jsx
│   └── main.jsx
│
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

---

## 🚀 Project Setup

```bash
# 1. Scaffold Vite + React project
npm create vite@latest Frontend -- --template react
cd Frontend

# 2. Install dependencies
npm install axios react-router-dom

# 3. Install Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 4. Install optional but recommended
npm install react-hot-toast         # toast notifications
npm install @tanstack/react-query   # data fetching & caching
npm install react-hook-form         # form handling
```

**`tailwind.config.js`**
```js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

**`src/index.css`** — add at top:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## 🔌 Step 1 — Axios Instance & Interceptors

**`src/api/axiosInstance.js`**
```js
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5001",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("iam_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global response error handler
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear storage and redirect to login
      localStorage.removeItem("iam_token");
      localStorage.removeItem("iam_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

## 🔑 Step 2 — API Functions

### `src/api/authApi.js`
```js
import api from "./axiosInstance";

export const loginApi = (email, password) =>
  api.post("/auth/login", { email, password });

export const registerApi = (data) =>
  api.post("/auth/register", data);
// data = { name, email, password, roleName }

export const logoutApi = () =>
  api.post("/auth/logout");

export const getMeApi = () =>
  api.get("/auth/me");
```

### `src/api/userApi.js`
```js
import api from "./axiosInstance";

export const getAllUsersApi    = ()         => api.get("/users");
export const getUserByIdApi   = (id)       => api.get(`/users/${id}`);
export const createUserApi    = (data)     => api.post("/users", data);
// data = { name, email, password, roleName }
export const updateUserApi    = (id, data) => api.put(`/users/${id}`, data);
export const deleteUserApi    = (id)       => api.delete(`/users/${id}`);
export const disableUserApi   = (id)       => api.put(`/users/${id}/disable`);
export const enableUserApi    = (id)       => api.put(`/users/${id}/enable`);
```

### `src/api/roleApi.js`
```js
import api from "./axiosInstance";

export const getAllRolesApi      = ()           => api.get("/roles");
export const createRoleApi      = (data)       => api.post("/roles", data);
// data = { name, permissionNames: ["view_users", "view_dashboard"] }
export const updateRoleByNameApi = (name, data) => api.put(`/roles/name/${name}`, data);
export const deleteRoleApi      = (id)         => api.delete(`/roles/${id}`);
```

### `src/api/permissionApi.js`
```js
import api from "./axiosInstance";

export const getAllPermissionsApi = ()     => api.get("/permissions");
export const createPermissionApi = (data) => api.post("/permissions", data);
// data = { name, description }
export const deletePermissionApi = (id)   => api.delete(`/permissions/${id}`);
```

### `src/api/sessionApi.js`
```js
import api from "./axiosInstance";

// Own sessions
export const getMySessionsApi     = ()   => api.get("/sessions");
export const revokeSessionApi     = (id) => api.delete(`/sessions/${id}`);
export const revokeAllSessionsApi = ()   => api.delete("/sessions/revoke-all");

// Admin only
export const getAllActiveSessionsApi = () => api.get("/admin/sessions");
export const getAuditLogsApi = (params) =>
  api.get("/admin/audit-logs", { params });
// params = { userId, action, resource, startDate, endDate, page, limit }
```

---

## 🔐 Step 3 — Auth Context

**`src/context/AuthContext.jsx`**
```jsx
import { createContext, useState, useEffect } from "react";
import { getMeApi, logoutApi } from "../api/authApi";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);    // { _id, name, email, role, permissions[] }
  const [token, setToken]     = useState(null);
  const [loading, setLoading] = useState(true);

  // On first load, restore session from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem("iam_token");
    if (savedToken) {
      setToken(savedToken);
      getMeApi()
        .then((res) => setUser(res.data.user))
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token, userData) => {
    localStorage.setItem("iam_token", token);
    localStorage.setItem("iam_user", JSON.stringify(userData));
    setToken(token);
    setUser(userData);
  };

  const logout = async () => {
    try { await logoutApi(); } catch (_) {}
    localStorage.removeItem("iam_token");
    localStorage.removeItem("iam_user");
    setToken(null);
    setUser(null);
  };

  // Check if the logged-in user has a specific permission
  const hasPermission = (permissionName) => {
    if (!user?.permissions) return false;
    return user.permissions.some((p) => p.name === permissionName);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}
```

**`src/hooks/useAuth.js`**
```js
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export const useAuth = () => useContext(AuthContext);
```

---

## 🛡️ Step 4 — Protected Route

**`src/components/layout/ProtectedRoute.jsx`**
```jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

// Wrap any page that needs authentication
export default function ProtectedRoute({ children, requiredPermission }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  if (requiredPermission) {
    const hasIt = user.permissions?.some((p) => p.name === requiredPermission);
    if (!hasIt) return <Navigate to="/dashboard" replace />;
  }

  return children;
}
```

---

## 🗺️ Step 5 — Router Setup

**`src/App.jsx`**
```jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/layout/ProtectedRoute";

import LoginPage       from "./pages/LoginPage";
import DashboardPage   from "./pages/DashboardPage";
import UsersPage       from "./pages/UsersPage";
import RolesPage       from "./pages/RolesPage";
import PermissionsPage from "./pages/PermissionsPage";
import SessionsPage    from "./pages/SessionsPage";
import AuditLogsPage   from "./pages/AuditLogsPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected — any logged-in user */}
          <Route path="/dashboard" element={
            <ProtectedRoute><DashboardPage /></ProtectedRoute>
          } />
          <Route path="/sessions" element={
            <ProtectedRoute><SessionsPage /></ProtectedRoute>
          } />

          {/* Admin-only pages */}
          <Route path="/users" element={
            <ProtectedRoute requiredPermission="manage_users"><UsersPage /></ProtectedRoute>
          } />
          <Route path="/roles" element={
            <ProtectedRoute requiredPermission="manage_roles"><RolesPage /></ProtectedRoute>
          } />
          <Route path="/permissions" element={
            <ProtectedRoute requiredPermission="manage_permissions"><PermissionsPage /></ProtectedRoute>
          } />
          <Route path="/audit-logs" element={
            <ProtectedRoute requiredPermission="manage_users"><AuditLogsPage /></ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

---

## 📄 Step 6 — Pages

### Login Page — `src/pages/LoginPage.jsx`
```jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginApi } from "../api/authApi";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]     = useState({ email: "", password: "" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await loginApi(form.email, form.password);
      login(res.data.token, res.data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center">IAM Login</h1>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <input
          type="email" placeholder="Email" required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full border rounded px-3 py-2 mb-3"
        />
        <input
          type="password" placeholder="Password" required
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="w-full border rounded px-3 py-2 mb-5"
        />
        <button
          type="submit" disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}
```

---

### Dashboard Page — `src/pages/DashboardPage.jsx`
```jsx
import { useAuth } from "../hooks/useAuth";

export default function DashboardPage() {
  const { user, hasPermission, logout } = useAuth();

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Welcome, {user?.name} 👋</h1>
        <button onClick={logout} className="text-sm text-red-500 hover:underline">Logout</button>
      </div>

      <p className="text-gray-500 mb-4">Role: <strong>{user?.role?.name}</strong></p>

      <h2 className="font-semibold mb-2">Your Permissions:</h2>
      <div className="flex flex-wrap gap-2">
        {user?.permissions?.map((p) => (
          <span key={p._id} className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full">
            {p.name}
          </span>
        ))}
      </div>

      {/* Navigation — only show links based on permission */}
      <div className="mt-8 grid grid-cols-2 gap-4 max-w-md">
        {hasPermission("manage_users") && (
          <a href="/users" className="bg-white border rounded-lg p-4 hover:shadow text-center">
            👥 Users
          </a>
        )}
        {hasPermission("manage_roles") && (
          <a href="/roles" className="bg-white border rounded-lg p-4 hover:shadow text-center">
            🎭 Roles
          </a>
        )}
        {hasPermission("manage_permissions") && (
          <a href="/permissions" className="bg-white border rounded-lg p-4 hover:shadow text-center">
            🔑 Permissions
          </a>
        )}
        <a href="/sessions" className="bg-white border rounded-lg p-4 hover:shadow text-center">
          📋 My Sessions
        </a>
        {hasPermission("manage_users") && (
          <a href="/audit-logs" className="bg-white border rounded-lg p-4 hover:shadow text-center">
            📜 Audit Logs
          </a>
        )}
      </div>
    </div>
  );
}
```

---

### Users Page — `src/pages/UsersPage.jsx`
```jsx
import { useState, useEffect } from "react";
import {
  getAllUsersApi, createUserApi, updateUserApi,
  deleteUserApi, disableUserApi, enableUserApi
} from "../api/userApi";

export default function UsersPage() {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  const fetchUsers = async () => {
    try {
      const res = await getAllUsersApi();
      setUsers(res.data.users);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleDisable = async (id) => {
    await disableUserApi(id);
    fetchUsers();
  };

  const handleEnable = async (id) => {
    await enableUserApi(id);
    fetchUsers();
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this user?")) return;
    await deleteUserApi(id);
    fetchUsers();
  };

  if (loading) return <p className="p-8">Loading users...</p>;
  if (error)   return <p className="p-8 text-red-500">{error}</p>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Users</h1>
      <table className="w-full border-collapse bg-white shadow rounded-lg overflow-hidden">
        <thead className="bg-gray-50 text-left text-sm text-gray-500">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u._id} className="border-t text-sm">
              <td className="px-4 py-3">{u.name}</td>
              <td className="px-4 py-3">{u.email}</td>
              <td className="px-4 py-3">{u.role?.name}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  u.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                }`}>
                  {u.isActive ? "Active" : "Disabled"}
                </span>
              </td>
              <td className="px-4 py-3 flex gap-2">
                {u.isActive ? (
                  <button onClick={() => handleDisable(u._id)}
                    className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded hover:bg-yellow-200">
                    Disable
                  </button>
                ) : (
                  <button onClick={() => handleEnable(u._id)}
                    className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200">
                    Enable
                  </button>
                )}
                <button onClick={() => handleDelete(u._id)}
                  className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200">
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

### Sessions Page — `src/pages/SessionsPage.jsx`
```jsx
import { useState, useEffect } from "react";
import { getMySessionsApi, revokeSessionApi, revokeAllSessionsApi } from "../api/sessionApi";

export default function SessionsPage() {
  const [sessions, setSessions] = useState([]);

  const fetchSessions = async () => {
    const res = await getMySessionsApi();
    setSessions(res.data.sessions);
  };

  useEffect(() => { fetchSessions(); }, []);

  const handleRevoke = async (id) => {
    await revokeSessionApi(id);
    fetchSessions();
  };

  const handleRevokeAll = async () => {
    if (!confirm("Revoke all other sessions?")) return;
    await revokeAllSessionsApi();
    fetchSessions();
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Active Sessions</h1>
        <button onClick={handleRevokeAll}
          className="text-sm bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
          Revoke All Other Sessions
        </button>
      </div>

      <div className="space-y-3">
        {sessions.map((s) => (
          <div key={s._id} className={`bg-white border rounded-lg p-4 flex justify-between items-center ${
            s.isCurrent ? "border-blue-400" : ""
          }`}>
            <div>
              <p className="text-sm font-medium">
                {s.userAgent?.substring(0, 60)}...
                {s.isCurrent && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                    Current
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                IP: {s.ipAddress} · Last active: {new Date(s.lastActivity).toLocaleString()}
              </p>
            </div>
            {!s.isCurrent && (
              <button onClick={() => handleRevoke(s._id)}
                className="text-xs text-red-500 hover:underline">
                Revoke
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### Audit Logs Page — `src/pages/AuditLogsPage.jsx`
```jsx
import { useState, useEffect } from "react";
import { getAuditLogsApi } from "../api/sessionApi";

export default function AuditLogsPage() {
  const [logs, setLogs]     = useState([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [filters, setFilters] = useState({ action: "", resource: "" });

  const fetchLogs = async () => {
    const res = await getAuditLogsApi({ page, limit: 20, ...filters });
    setLogs(res.data.logs);
    setTotal(res.data.total);
  };

  useEffect(() => { fetchLogs(); }, [page, filters]);

  const actionColors = {
    LOGIN_SUCCESS: "text-green-600",
    LOGIN_FAILED:  "text-red-500",
    LOGOUT:        "text-gray-500",
    USER_CREATED:  "text-blue-600",
    USER_DELETED:  "text-red-600",
    USER_DISABLED: "text-orange-500",
    USER_ENABLED:  "text-green-600",
    ROLE_UPDATED:  "text-purple-600",
    SESSION_REVOKED: "text-yellow-600",
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Audit Logs</h1>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          placeholder="Filter by action (e.g. LOGIN_SUCCESS)"
          value={filters.action}
          onChange={(e) => setFilters({ ...filters, action: e.target.value })}
          className="border rounded px-3 py-1.5 text-sm w-64"
        />
        <input
          placeholder="Filter by resource (e.g. User)"
          value={filters.resource}
          onChange={(e) => setFilters({ ...filters, resource: e.target.value })}
          className="border rounded px-3 py-1.5 text-sm w-48"
        />
        <button onClick={() => setFilters({ action: "", resource: "" })}
          className="text-sm text-gray-500 hover:underline">
          Clear
        </button>
      </div>

      <p className="text-sm text-gray-400 mb-3">{total} total records</p>

      <table className="w-full text-sm bg-white shadow rounded-lg overflow-hidden">
        <thead className="bg-gray-50 text-gray-500 text-left">
          <tr>
            <th className="px-4 py-3">Timestamp</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Resource</th>
            <th className="px-4 py-3">IP</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log._id} className="border-t">
              <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                {new Date(log.timestamp).toLocaleString()}
              </td>
              <td className={`px-4 py-3 font-mono font-semibold ${actionColors[log.action] || "text-gray-700"}`}>
                {log.action}
              </td>
              <td className="px-4 py-3">{log.user?.email || "—"}</td>
              <td className="px-4 py-3">{log.resource || "—"}</td>
              <td className="px-4 py-3 text-gray-400">{log.ipAddress}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="flex gap-2 mt-4">
        <button onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-3 py-1 border rounded disabled:opacity-40">
          ← Prev
        </button>
        <span className="px-3 py-1 text-sm">Page {page}</span>
        <button onClick={() => setPage((p) => p + 1)}
          disabled={logs.length < 20}
          className="px-3 py-1 border rounded disabled:opacity-40">
          Next →
        </button>
      </div>
    </div>
  );
}
```

---

## 🔑 Token & Storage Utilities

**`src/utils/tokenStorage.js`**
```js
const TOKEN_KEY = "iam_token";
const USER_KEY  = "iam_user";

export const getToken  = ()      => localStorage.getItem(TOKEN_KEY);
export const setToken  = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = ()     => localStorage.removeItem(TOKEN_KEY);

export const getUser  = ()     => JSON.parse(localStorage.getItem(USER_KEY) || "null");
export const setUser  = (user) => localStorage.setItem(USER_KEY, JSON.stringify(user));
export const clearUser = ()    => localStorage.removeItem(USER_KEY);
```

---

## 📡 Complete API Reference

### Auth

| Method | URL | Body | Auth |
|---|---|---|---|
| `POST` | `/auth/login` | `{ email, password }` | ❌ |
| `POST` | `/auth/register` | `{ name, email, password, roleName }` | ❌ |
| `POST` | `/auth/logout` | — | ✅ Bearer |
| `GET` | `/auth/me` | — | ✅ Bearer |

**Login Response:**
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "user": {
    "_id": "...",
    "name": "Admin",
    "email": "admin@iam.com",
    "role": { "_id": "...", "name": "Admin" },
    "permissions": [
      { "_id": "...", "name": "manage_users" },
      { "_id": "...", "name": "manage_roles" }
    ]
  }
}
```

---

### Users — require `manage_users` permission

| Method | URL | Body |
|---|---|---|
| `GET` | `/users` | — |
| `GET` | `/users/:id` | — |
| `POST` | `/users` | `{ name, email, password, roleName }` |
| `PUT` | `/users/:id` | `{ name?, isActive? }` |
| `PUT` | `/users/:id/disable` | — |
| `PUT` | `/users/:id/enable` | — |
| `DELETE` | `/users/:id` | — |

---

### Roles — require `manage_roles` permission

| Method | URL | Body |
|---|---|---|
| `GET` | `/roles` | — |
| `POST` | `/roles` | `{ name, permissionNames: [] }` |
| `PUT` | `/roles/name/:roleName` | `{ permissionNames: [] }` |
| `PUT` | `/roles/:id` | `{ name?, permissionNames?: [] }` |
| `DELETE` | `/roles/:id` | — |

---

### Permissions — require `manage_permissions` permission

| Method | URL | Body |
|---|---|---|
| `GET` | `/permissions` | — |
| `POST` | `/permissions` | `{ name, description }` |
| `DELETE` | `/permissions/:id` | — |

---

### Sessions — require valid session

| Method | URL | Description |
|---|---|---|
| `GET` | `/sessions` | Get own active sessions |
| `DELETE` | `/sessions/:id` | Revoke a specific session |
| `DELETE` | `/sessions/revoke-all` | Revoke all sessions except current |

---

### Admin — require `manage_users` permission

| Method | URL | Query Params |
|---|---|---|
| `GET` | `/admin/sessions` | — |
| `GET` | `/admin/audit-logs` | `userId, action, resource, startDate, endDate, page, limit` |

**Audit log query example:**
```
GET /admin/audit-logs?action=LOGIN_FAILED&page=1&limit=20
```

---

## 🎨 Permission-Based UI Rendering

Show/hide UI elements based on what the logged-in user can do:

```jsx
import { useAuth } from "../hooks/useAuth";

export default function Sidebar() {
  const { hasPermission } = useAuth();

  return (
    <nav>
      <a href="/dashboard">Dashboard</a>
      <a href="/sessions">My Sessions</a>

      {hasPermission("manage_users") && <a href="/users">Users</a>}
      {hasPermission("manage_roles") && <a href="/roles">Roles</a>}
      {hasPermission("manage_permissions") && <a href="/permissions">Permissions</a>}
      {hasPermission("manage_users") && <a href="/audit-logs">Audit Logs</a>}
    </nav>
  );
}
```

---

## ⚠️ Error Handling Pattern

All API errors follow this shape from the backend:
```json
{
  "success": false,
  "message": "Unauthorized: You do not have permission to perform this action."
}
```

Standard try/catch pattern for every API call:
```js
try {
  const res = await someApi();
  // handle success
} catch (err) {
  const message = err.response?.data?.message || "Something went wrong";
  // show message in UI (toast, error state, etc.)
  console.error(message);
}
```

**HTTP Status codes returned by backend:**

| Status | Meaning |
|---|---|
| `200` | Success |
| `201` | Created |
| `400` | Bad request / validation error |
| `401` | Not authenticated (no/bad/expired token) |
| `403` | Authenticated but missing permission |
| `404` | Resource not found |
| `409` | Conflict (duplicate email/name) |
| `500` | Internal server error |

---

## 🔒 Security Best Practices

| Practice | Implementation |
|---|---|
| Never store token in `sessionStorage` for SPA | Use `localStorage` + clear on logout |
| Token auto-attach | Axios request interceptor |
| Token expiry handling | 401 response interceptor → redirect to `/login` |
| Permission-gated routes | `ProtectedRoute` with `requiredPermission` prop |
| Permission-gated UI | `hasPermission()` from `AuthContext` |
| Never expose password fields | Backend uses `select: false` — you'll never receive it |
| CORS | Backend allows `*` in dev — restrict `CLIENT_ORIGIN` in prod |

---

## 🧪 Testing the Integration

### Quick checklist with browser DevTools:

1. **Login** → `POST /auth/login` → check `token` in response  
2. **Check localStorage** → DevTools → Application → Local Storage → `iam_token`  
3. **Fetch /auth/me** → should return user + permissions  
4. **Try a protected route without token** → should get `401`  
5. **Login as Manager** (create one via `/users`) → `/users` page should redirect to `/dashboard` (no `manage_users`)  
6. **Disable a user** → try logging in as that user → should get `403` / disabled message  
7. **Check sessions** → `/sessions` → should show current session  
8. **Check audit logs** → `/admin/audit-logs` → should show all login/logout events  

---

## 📦 `package.json` Reference

```json
{
  "name": "iam-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0",
    "react-hot-toast": "^2.4.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "vite": "^5.1.0"
  }
}
```

---

## ✅ Build Order Summary

| Step | What to build |
|---|---|
| 1 | `axiosInstance.js` — base Axios with interceptors |
| 2 | `authApi.js`, `userApi.js`, `roleApi.js`, `permissionApi.js`, `sessionApi.js` |
| 3 | `AuthContext.jsx` — global login/logout/permission state |
| 4 | `ProtectedRoute.jsx` — route guard |
| 5 | `App.jsx` — router with all routes |
| 6 | `LoginPage.jsx` |
| 7 | `DashboardPage.jsx` |
| 8 | `UsersPage.jsx`, `RolesPage.jsx`, `PermissionsPage.jsx` |
| 9 | `SessionsPage.jsx`, `AuditLogsPage.jsx` |
| 10 | `Sidebar.jsx` + permission-gated nav links |
