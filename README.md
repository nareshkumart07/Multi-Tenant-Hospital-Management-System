🏥 Multi-Tenant Hospital Management System (SaaS)

A cloud-native, multi-tenant SaaS platform for hospital management with strict data isolation (Schema-Per-Tenant), Role-Based Access Control (RBAC), and a unified React frontend.

📖 Executive Summary

This project is a Level 3 Multi-Tenant SaaS built for the Healthcare domain. It allows hospitals to self-register and instantly provision a dedicated workspace.

Tenancy Model: Database-per-tenant (Logical isolation via MongoDB dynamic switching).

Security: JWT Authentication with Context Awareness.

Frontend: Single Page Application (SPA) serving different dashboards based on User Roles.

🚀 Key Features

1. Multi-Tenancy Engine

Self-Onboarding: Hospitals register via a public portal and get a unique TenantID.

Data Isolation: Middleware intercepts x-tenant-id header and switches MongoDB database context (hms_tenant_{id}) on the fly.

Tenant Validation: Caching mechanism to validate active tenants before DB switching.

2. Security & Access Control

RBAC (Role-Based Access Control): Granular permissions for SUPER_ADMIN, HOSPITAL_ADMIN, DOCTOR, NURSE, PHARMACIST, RECEPTIONIST.

ABAC (Attribute-Based Access Control): Doctors can only see patients assigned to them or their department.

JWT Auth: Stateless authentication with tenant context embedded in tokens.

3. Patient Lifecycle

OPD/IPD Management: Track patient status and type.

Prescription System: Digital prescription writing linked to specific doctors.

Vitals Monitoring: Historical tracking of patient health data.

🛠 Tech Stack

Backend: Node.js, Express.js

Database: MongoDB (Mongoose with Dynamic Schema Switching)

Frontend: React 18, Tailwind CSS, Lucide Icons

DevOps: Docker, Docker Compose, Nginx

Tools: Postman (API Testing)

⚙️ Installation & Setup

Option A: Quick Start (Docker)

Run the entire stack (Backend + Database + Frontend Proxy) with one command.

# 1. Clone the repository
git clone [https://github.com/your-username/hms-saas.git](https://github.com/your-username/hms-saas.git)
cd hms-saas

# 2. Start services
docker-compose up --build


The application will be available at:

Frontend/API: http://localhost

MongoDB: mongodb://localhost:27017

Option B: Manual Setup

1. Backend

cd backend
npm install
# Set Env Variables
export MONGO_URI=mongodb://localhost:27017/hms_core
export JWT_SECRET=your_super_secret_key
# Run Server
node server.js


2. Frontend

cd frontend
npm install
npm run dev


🔌 API Documentation

You can import the postman_collection.json file included in this repo to test the API.

Method

Endpoint

Description

Headers Required

POST

/api/onboarding/register

Register a new hospital

None

POST

/api/auth/login

Login user

x-tenant-id

GET

/api/patients

List patients

Authorization, x-tenant-id

POST

/api/patients

Create patient

Authorization, x-tenant-id

📂 Project Structure

hms-saas/
├── backend/
│   ├── server.js           # Main Entry Point & Multi-tenant Middleware
│   ├── package.json
│   └── ...
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Main React Component
│   │   └── ...
│   └── package.json
├── nginx.conf              # Reverse Proxy Config
├── docker-compose.yml      # Container Orchestration
├── Dockerfile              # Backend Image
└── README.md


🛡 Architecture

graph TD
    Client[React Client] -->|x-tenant-id| LB[Nginx / Load Balancer]
    LB --> API[Node.js API Server]
    
    subgraph "Backend Core"
        API --> M_Tenant[Tenant Resolver MW]
        M_Tenant --> M_Auth[Auth MW]
        M_Auth --> M_RBAC[RBAC MW]
        M_RBAC --> Ctrl[Controllers]
    end
    
    subgraph "Data Layer (MongoDB)"
        Ctrl -->|Switch DB| DB_Master[(Master DB)]
        Ctrl -->|Switch DB| DB_T1[(Tenant A DB)]
        Ctrl -->|Switch DB| DB_T2[(Tenant B DB)]
    end


🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

📄 License

MIT
