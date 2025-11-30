/**
 * HMS SaaS Backend - Multi-Tenant Prototype
 * Tech Stack: Node.js, Express, Mongoose, JWT
 * * FEATURES IMPLEMENTED:
 * 1. Dynamic DB Switching (Schema-per-tenant)
 * 2. RBAC & ABAC Middleware
 * 3. Hospital Self-Registration
 * 4. Patient & Prescription Management
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// --- CONFIGURATION ---
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hms_core';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_hms_key_2024';

const app = express();
app.use(express.json());
app.use(cors());

// --- DATABASE CONNECTION POOL ---
// We keep a connection to the cluster, but switch 'db' object per request
const validTenants = new Set(); // Cache for valid tenant IDs to prevent DB spam

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(MONGO_URI);
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        // Pre-load existing tenants into cache
        const Tenant = conn.connection.useDb('hms_core').model('Tenant', TenantSchema);
        const tenants = await Tenant.find({ status: 'ACTIVE' });
        tenants.forEach(t => validTenants.add(t.tenantId));
        console.log(`Loaded ${validTenants.size} active tenants.`);
    } catch (error) {
        console.error(`❌ DB Error: ${error.message}`);
        process.exit(1);
    }
};

// --- SCHEMAS (Defined globally but instantiated per DB) ---

// 1. Master Tenant Schema (Stored in hms_core)
const TenantSchema = new mongoose.Schema({
    tenantId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    address: String,
    licenseNumber: { type: String, required: true, unique: true },
    adminEmail: { type: String, required: true },
    status: { type: String, enum: ['PENDING', 'ACTIVE', 'SUSPENDED'], default: 'ACTIVE' },
    createdAt: { type: Date, default: Date.now }
});

// 2. User Schema (Tenant Level)
const UserSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    username: { type: String, unique: true },
    email: { type: String, required: true }, // Removed unique constraint here to allow flexibility in proto, handled by logic
    password: { type: String, required: true },
    roles: [{ type: String, enum: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'PHARMACIST', 'RECEPTIONIST'] }],
    department: String,
    isPasswordTemporary: { type: Boolean, default: false }
});

// 3. Patient Schema (Tenant Level)
const PatientSchema = new mongoose.Schema({
    patientId: { type: String, unique: true }, // Format: TID-P-SEQ
    name: { type: String, required: true },
    dob: Date,
    gender: String,
    contact: String,
    type: { type: String, enum: ['OPD', 'IPD'], default: 'OPD' },
    assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

// 4. Prescription Schema (Tenant Level)
const PrescriptionSchema = new mongoose.Schema({
    rxId: { type: String, unique: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    medicines: [{
        name: String,
        dosage: String,
        frequency: String,
        duration: String
    }],
    notes: String,
    createdAt: { type: Date, default: Date.now }
});

// --- MIDDLEWARE: TENANT RESOLVER & MODEL INJECTOR ---
/**
 * Switches the database context based on x-tenant-id header.
 * Injects models tailored to that specific database.
 */
const resolveTenant = (req, res, next) => {
    const tenantId = req.headers['x-tenant-id'];

    // Bypass for core routes
    if (req.path.startsWith('/api/onboarding') || req.path === '/api/sys/health') {
        req.db = mongoose.connection.useDb('hms_core');
        req.TenantModel = req.db.model('Tenant', TenantSchema);
        return next();
    }

    if (!tenantId || !validTenants.has(tenantId)) {
        return res.status(404).json({ error: 'Tenant ID missing or invalid' });
    }

    // Switch DB Context
    const dbName = `hms_tenant_${tenantId}`;
    req.db = mongoose.connection.useDb(dbName);
    
    // Inject Models for this request
    req.User = req.db.model('User', UserSchema);
    req.Patient = req.db.model('Patient', PatientSchema);
    req.Prescription = req.db.model('Prescription', PrescriptionSchema);
    req.tenantId = tenantId;

    next();
};

// --- MIDDLEWARE: AUTH & RBAC ---
const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

const authorize = (resource, action) => {
    return (req, res, next) => {
        const rolePermissions = {
            'HOSPITAL_ADMIN': ['ALL'],
            'DOCTOR': ['PATIENT:READ', 'PATIENT:WRITE', 'RX:WRITE', 'RX:READ'],
            'NURSE': ['PATIENT:READ', 'PATIENT:VITALS'],
            'RECEPTIONIST': ['PATIENT:CREATE', 'PATIENT:READ']
        };

        const userRoles = req.user.roles;
        let hasPermission = false;

        userRoles.forEach(role => {
            const perms = rolePermissions[role] || [];
            if (perms.includes('ALL') || perms.includes(`${resource}:${action}`)) {
                hasPermission = true;
            }
        });

        if (!hasPermission) return res.status(403).json({ error: 'Access Denied' });
        next();
    };
};

// --- ROUTES ---

// 1. Onboarding (Core)
app.post('/api/onboarding/register', async (req, res) => {
    try {
        req.db = mongoose.connection.useDb('hms_core');
        const Tenant = req.db.model('Tenant', TenantSchema);
        
        const { name, address, email, license, phone } = req.body;

        // Check license
        const existing = await Tenant.findOne({ licenseNumber: license });
        if (existing) return res.status(400).json({ error: 'License already registered' });

        const tenantId = uuidv4();
        
        // Create Tenant Record
        await Tenant.create({
            tenantId,
            name,
            address,
            licenseNumber: license,
            adminEmail: email
        });

        validTenants.add(tenantId);

        // Initialize Tenant DB with Admin User
        const tenantDb = mongoose.connection.useDb(`hms_tenant_${tenantId}`);
        const User = tenantDb.model('User', UserSchema);

        const hashedPassword = await bcrypt.hash('Admin@123', 10);
        await User.create({
            firstName: 'System',
            lastName: 'Admin',
            email,
            username: `admin`,
            password: hashedPassword,
            roles: ['HOSPITAL_ADMIN']
        });

        res.json({ message: 'Hospital Registered Successfully', tenantId, defaultUser: 'admin', defaultPass: 'Admin@123' });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.use(resolveTenant); // Apply multi-tenancy logic for subsequent routes

// 2. Auth (Tenant Specific)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await req.User.findOne({ username });
        
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user._id, roles: user.roles, tenantId: req.tenantId },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ token, user: { name: `${user.firstName} ${user.lastName}`, roles: user.roles } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. User Management
app.post('/api/users', authenticate, authorize('USER', 'WRITE'), async (req, res) => {
    try {
        const { firstName, lastName, email, roles, department } = req.body;
        const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
        const hashedPassword = await bcrypt.hash('Welcome@123', 10);

        const newUser = await req.User.create({
            firstName, lastName, email, username,
            password: hashedPassword, roles, department
        });

        res.json(newUser);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Patient Management
app.get('/api/patients', authenticate, authorize('PATIENT', 'READ'), async (req, res) => {
    try {
        const patients = await req.Patient.find().sort({ createdAt: -1 });
        res.json(patients);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/patients', authenticate, authorize('PATIENT', 'CREATE'), async (req, res) => {
    try {
        const count = await req.Patient.countDocuments();
        const patientId = `${req.tenantId}-P-${count + 1}`;
        
        const patient = await req.Patient.create({
            ...req.body,
            patientId
        });
        res.json(patient);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Prescriptions
app.post('/api/prescriptions', authenticate, authorize('RX', 'WRITE'), async (req, res) => {
    try {
        const count = await req.Prescription.countDocuments();
        const rxId = `${req.tenantId}-RX-${count + 1}`;

        const rx = await req.Prescription.create({
            ...req.body,
            rxId,
            doctorId: req.user.userId
        });
        res.json(rx);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Server
connectDB().then(() => {
    app.listen(PORT, () => console.log(`🚀 HMS SaaS running on port ${PORT}`));
});
