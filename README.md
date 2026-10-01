# MINEXA (NEONOVA) — Intelligent Mine Safety & Operations Platform

[![Vite](https://img.shields.io/badge/Frontend-Vite%20%2B%20React%20%2B%20TypeScript-646CFF?logo=vite)](https://vitejs.dev/)
[![Express.js](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-000000?logo=express)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%2F%20Supabase-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/UI-Tailwind%20CSS%20%2B%20shadcn%2Fui-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Email Service](https://img.shields.io/badge/Email-Resend%20API-000000?logo=resend)](https://resend.com/)

**MINEXA** (powered by **NEONOVA Mine Intelligence**) is an enterprise-grade digital safety, workforce, and operations management platform designed for modern surface and underground mining operations. It bridges real-time field data with operational decision-making, offering comprehensive role-based workflows for Field Workers, Safety Officers, Mine Managers, and Platform Administrators.

---

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph Client Layer
        A[React + Vite + TypeScript SPA]
        A1[Worker Dashboard]
        A2[Manager Command Center]
        A3[Safety Hub & Approvals]
        A4[Admin Portal]
    end

    subgraph API & Services Layer - Render
        B[Express.js REST API Server]
        B1[JWT & RBAC Middleware]
        B2[Incident & Safety Engines]
        B3[Attendance & Leave Modules]
        B4[Equipment & Geofence Trackers]
    end

    subgraph Data & Storage Layer - Supabase / PostgreSQL
        C[(PostgreSQL Relational DB)]
        C1[Mines & Organizations]
        C2[Users & Role Credentials]
        C3[Worker Health & PPE Records]
        C4[Incidents & Audit Logs]
    end

    subgraph Third-Party Integrations
        D1[Resend HTTPS Email API]
        D2[SMS / WhatsApp Gateways]
    end

    A -->|HTTPS / JSON REST API| B
    B -->|Connection Pool / SSL| C
    B -->|Notifications & Alerts| D1
    B -->|Critical Safety Broadcasts| D2
```

---

## 👥 Role-Based Capabilities

### 1. 👷 Field Worker
- **Health & Fitness Profile:** Real-time medical status, periodic examination tracking, blood group, restrictions, and fitness certificates.
- **Leave Management:** Submit leave requests across annual, sick, personal, and emergency quotas with live balance tracking.
- **PPE & Safety Equipment:** View assigned personal protective equipment and inspection histories.
- **Incident Reporting:** Report hazards, accidents, and near-misses with location tagging and descriptions.
- **Application Status:** Track real-time registration, onboarding, and safety approval statuses.

### 2. 🛡️ Safety Officer
- **Worker Verification & Approval:** Verify pending worker registrations, generate secure temporary passwords, and initialize health records.
- **Incident Investigation Lifecycle:** Trigger investigations, log root-cause analysis, record corrective actions, and resolve safety issues.
- **Safety Checklists & Audits:** Perform periodic equipment and site safety compliance audits.
- **PPE Inventory & Inspection:** Track PPE issuance, condition ratings, and expiry alerts.

### 3. 🏢 Mine Manager
- **Command Center:** Live overview of operational status, active personnel, equipment health, and safety metrics.
- **Live Site & Geofencing:** Monitor geofenced hazardous zones, worker locations, and geofence breach alerts.
- **Equipment Maintenance:** Manage heavy machinery, schedule maintenance cycles, and log downtime.
- **Workforce & Shift Planning:** Real-time attendance monitoring, shift assignments, and leave approvals.

### 4. ⚙️ Platform Administrator
- **Mine & Tenant Management:** Register new mining sites, geological details, and operational parameters.
- **System Audit Logs:** Immutable security audit logs tracking every approval, credential change, and privileged action.

---

## 📁 Codebase Structure

```
MINEXA/
├── backend/
│   ├── middleware/
│   │   ├── auth.js               # JWT verification & token parsing
│   │   └── roles.js              # Role-Based Access Control (RBAC) guard
│   ├── routes/
│   │   ├── admin.js              # Platform administration & mine setup
│   │   ├── analytics.js          # Operations & safety analytics
│   │   ├── application.js        # Worker onboarding & registration status
│   │   ├── attendance.js         # Shift attendance & check-ins
│   │   ├── audit.js              # Audit log inspection
│   │   ├── auth.js               # Authentication, login, password resets
│   │   ├── dashboard.js          # Role-specific dashboard aggregations
│   │   ├── emergency.js          # SOS broadcasts & emergency alerts
│   │   ├── equipment.js          # Machinery tracking & inspections
│   │   ├── health.js             # Worker health profiles & medical fitness
│   │   ├── incidents.js          # Safety incidents & investigation lifecycle
│   │   ├── location.js           # Geofences & spatial worker locations
│   │   ├── manager.js            # Manager-specific workflows & approvals
│   │   ├── ppe.js                # PPE catalog, assignments & inspections
│   │   ├── risk.js               # Risk assessments & matrix calculations
│   │   ├── safety.js             # Safety officer verification & checklists
│   │   ├── shifts.js             # Shift scheduling & assignments
│   │   └── workers.js            # Worker registry & directory
│   ├── services/
│   │   ├── emailService.js       # Resend HTTPS API & Nodemailer fallback
│   │   └── notificationService.js# Multi-channel notification dispatcher
│   ├── db.js                     # PostgreSQL connection pool with SSL
│   ├── init_db.js                # Automated idempotent schema migrations
│   └── server.js                 # Express app configuration & middleware
├── src/
│   ├── components/
│   │   ├── ui/                   # shadcn/ui modular component library
│   │   ├── AdminApprovalCenter.tsx
│   │   ├── ApplicationStatus.tsx # Worker onboarding status tracker
│   │   ├── ChangePassword.tsx    # Password reset & rotation modal
│   │   ├── LeaveApprovalCenter.tsx
│   │   ├── LeaveManagementForm.tsx # Worker leave request & balance UI
│   │   ├── NeonovaPlatform.tsx   # Core platform dashboard & views
│   │   ├── RegistrationForm.tsx  # Multi-step worker/staff registration
│   │   └── WorkerHealth.tsx      # Medical fitness & wellness profile
│   ├── lib/
│   │   ├── api.ts                # Type-safe API client & HTTP helpers
│   │   └── utils.ts              # UI formatting & utility functions
│   ├── App.tsx                   # Main React routing & layout container
│   ├── main.tsx                  # Vite entrypoint
│   └── index.css                 # Custom Tailwind theme & design tokens
├── public/                       # Static public assets & favicons
├── package.json                  # NPM dependencies & scripts
├── tailwind.config.ts            # Tailwind CSS styling configuration
├── tsconfig.json                 # TypeScript compiler configuration
├── vercel.json                   # Vercel SPA routing rewrite rules
└── vite.config.ts                # Vite build configuration
```

---

## 🗄️ Database Schema Overview

The relational schema is configured in PostgreSQL with foreign keys and cascade rules:

| Table | Purpose |
|---|---|
| `mines` | Mining operations sites, locations, and status |
| `users` | Auth accounts, roles (`FIELD_WORKER`, `SAFETY_OFFICER`, `MINE_MANAGER`, `PLATFORM_ADMIN`), hashed credentials |
| `workers` | Physical workforce records, employee codes, assigned mine |
| `registration_requests` | Onboarding requests submitted by new workers/staff |
| `approval_actions` | Review audit trail for registration requests |
| `worker_health` | Medical fitness status, certificate validity dates, blood groups, work restrictions |
| `worker_leave_balances` | Annual, sick, personal, and emergency leave allocations |
| `leave_requests` | Worker leave submissions with approval workflow |
| `incidents` | Reported accidents, hazards, near-misses with severity and investigation state |
| `equipment` & `equipment_inspections` | Machinery registry, operational health, periodic inspections |
| `ppe_types` & `worker_ppe_assignments` | PPE inventory catalog and worker issuance logs |
| `mine_geofences` & `worker_locations` | Danger zones, coordinates, and spatial telemetry |
| `emergency_alerts` | Site-wide SOS alerts and evacuation statuses |
| `audit_logs` | Security and compliance activity trail |

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: Local instance or cloud database (e.g. Supabase)
- **Git**

### 1. Clone & Install
```bash
git clone https://github.com/animeshmanna1976/MINEXA.git
cd MINEXA
npm install
```

### 2. Environment Variables Configuration

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
JWT_SECRET=your_jwt_secret_key_here

# PostgreSQL Database (Supabase / Local)
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-region.pooler.supabase.com:6543/postgres

# Email Service (Resend API)
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=MINEXA <noreply@yourdomain.com>

# Frontend API URL (for local development)
VITE_API_URL=http://localhost:3000/api/v1
```

### 3. Initialize Database Tables
```bash
npm run db:init
```

### 4. Start Development Servers
Start both backend and frontend concurrently:
```bash
# Terminal 1: Backend API
npm run dev:backend

# Terminal 2: Frontend Client
npm run dev
```

The frontend will be available at `http://localhost:5173` and backend at `http://localhost:3000`.

---

## 🌐 Production Deployment

### Frontend (Vercel)
1. Import repository into [Vercel](https://vercel.com).
2. Framework Preset: **Vite**.
3. Add Environment Variable:
   - `VITE_API_URL`: `https://minexa-backend.onrender.com/api/v1`
4. Client-side routing is handled by [`vercel.json`](./vercel.json).

### Backend (Render)
1. Create a **Web Service** on [Render](https://render.com) connected to the repository.
2. Build Command: `npm install`
3. Start Command: `npm run start:backend`
4. Add Environment Variables:
   - `DATABASE_URL`: Your Supabase connection string.
   - `JWT_SECRET`: Secure random string.
   - `RESEND_API_KEY`: Your Resend API key.
   - `EMAIL_FROM`: `MINEXA <noreply@animeshmanna.me>`

---

## 🔒 Security & Compliance
- **Zero Raw Passwords:** All credentials hashed using `bcrypt` with salt rounds = 12.
- **Stateless Authentication:** JSON Web Tokens (JWT) with role claims.
- **CORS Restricted:** Cross-Origin Resource Sharing secured for production frontends.
- **Audit Logging:** Every administrative and safety status modification is captured in `audit_logs`.

---

## 👨‍💻 Author & Maintainer
- **Developer:** [Animesh Manna](https://github.com/animeshmanna1976)
- **Domain:** [animeshmanna.me](https://animeshmanna.me)

---

## 📄 License
This project is licensed under the MIT License.
