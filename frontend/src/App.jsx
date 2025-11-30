import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  Building2, User, Lock, Activity, Users, FilePlus, LogOut, 
  LayoutDashboard, Stethoscope, Pill, ClipboardList, Menu, X, CheckCircle 
} from 'lucide-react';

// --- CONFIG ---
// CHANGED: Reverted to standard URL for universal compatibility in the editor.
// For production (Vite), you can uncomment: const API_URL = import.meta.env.VITE_API_URL;
const API_URL = ' https://multi-tenant-hospital-management-system.onrender.com';

// --- CONTEXT ---
const AuthContext = createContext(null);

// --- COMPONENT: LOGIN & ONBOARDING ---
const Landing = ({ onLogin }) => {
  const [view, setView] = useState('login'); // login | register
  const [formData, setFormData] = useState({ 
    tenantId: '', username: '', password: '', // Login
    hName: '', hAddr: '', hEmail: '', hLicense: '', hPhone: '' // Register
  });
  const [msg, setMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMsg('');
    try {
      const res = await fetch(`${API_URL}/onboarding/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.hName,
          address: formData.hAddr,
          email: formData.hEmail,
          license: formData.hLicense
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(`Success! Your Tenant ID is: ${data.tenantId}. Admin User: admin`);
        setView('login');
      } else {
        setMsg(`Error: ${data.error}`);
      }
    } catch (err) { setMsg('Network error. Is backend running?'); }
    setIsLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMsg('');
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': formData.tenantId
        },
        body: JSON.stringify({ username: formData.username, password: formData.password })
      });
      const data = await res.json();
      if (res.ok) {
        onLogin(data.token, data.user, formData.tenantId);
      } else {
        setMsg(data.error);
      }
    } catch (err) { setMsg('Login failed. Check connection.'); }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-blue-600 p-6 text-center">
          <Building2 className="w-12 h-12 text-white mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-white">Cloud HMS SaaS</h1>
          <p className="text-blue-100">Multi-Tenant Hospital Platform</p>
        </div>

        <div className="p-8">
          {msg && <div className="mb-4 p-3 bg-blue-50 text-blue-700 text-sm rounded break-all">{msg}</div>}
          
          <div className="flex mb-6 border-b">
            <button 
              className={`flex-1 pb-2 ${view === 'login' ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-gray-500'}`}
              onClick={() => setView('login')}
            >Login</button>
            <button 
              className={`flex-1 pb-2 ${view === 'register' ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-gray-500'}`}
              onClick={() => setView('register')}
            >Register Hospital</button>
          </div>

          {view === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Tenant ID</label>
                <input required className="w-full p-2 border rounded mt-1" placeholder="UUID from registration" 
                  value={formData.tenantId} onChange={e => setFormData({...formData, tenantId: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Username</label>
                <input required className="w-full p-2 border rounded mt-1" 
                  value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input type="password" required className="w-full p-2 border rounded mt-1" 
                  value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              </div>
              <button disabled={isLoading} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-blue-300">
                {isLoading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <input required className="w-full p-2 border rounded" placeholder="Hospital Name" 
                value={formData.hName} onChange={e => setFormData({...formData, hName: e.target.value})} />
              <input required className="w-full p-2 border rounded" placeholder="License Number" 
                value={formData.hLicense} onChange={e => setFormData({...formData, hLicense: e.target.value})} />
              <input required className="w-full p-2 border rounded" placeholder="Admin Email" type="email"
                value={formData.hEmail} onChange={e => setFormData({...formData, hEmail: e.target.value})} />
              <button disabled={isLoading} className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:bg-green-300">
                 {isLoading ? 'Registering...' : 'Register Hospital'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// --- COMPONENT: DASHBOARD ---
const Dashboard = ({ user, token, tenantId, logout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [patients, setPatients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  
  // New Patient Form State
  const [newPatient, setNewPatient] = useState({ name: '', gender: 'Male', contact: '', type: 'OPD' });

  const hasRole = (roles) => roles.some(r => user.roles.includes(r));

  useEffect(() => {
    if (activeTab === 'patients') fetchPatients();
  }, [activeTab]);

  const fetchPatients = async () => {
    const res = await fetch(`${API_URL}/patients`, {
      headers: { 'Authorization': `Bearer ${token}`, 'x-tenant-id': tenantId }
    });
    if (res.ok) setPatients(await res.json());
  };

  const handleAddPatient = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/patients`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`, 
        'x-tenant-id': tenantId,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(newPatient)
    });
    if (res.ok) {
      setShowModal(false);
      fetchPatients();
    }
  };

  const SidebarItem = ({ id, icon: Icon, label, roles }) => {
    if (roles && !hasRole(roles)) return null;
    return (
      <button 
        onClick={() => setActiveTab(id)}
        className={`w-full flex items-center space-x-3 px-4 py-3 ${activeTab === id ? 'bg-blue-100 text-blue-700 border-r-4 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
      >
        <Icon size={20} />
        <span className="font-medium">{label}</span>
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg z-10 hidden md:block">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-blue-800">HMS Pro</h2>
          <p className="text-xs text-gray-500 mt-1">Tenant: {tenantId.substring(0,8)}...</p>
        </div>
        <nav className="mt-6">
          <SidebarItem id="overview" icon={LayoutDashboard} label="Overview" />
          <SidebarItem id="patients" icon={Users} label="Patients" roles={['DOCTOR', 'RECEPTIONIST', 'NURSE', 'HOSPITAL_ADMIN']} />
          <SidebarItem id="prescriptions" icon={ClipboardList} label="Prescriptions" roles={['DOCTOR']} />
          <SidebarItem id="users" icon={User} label="User Mgmt" roles={['HOSPITAL_ADMIN']} />
        </nav>
        <div className="absolute bottom-0 w-64 p-4 border-t bg-gray-50">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
              {user.name[0]}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-700">{user.name}</p>
              <p className="text-xs text-gray-500">{user.roles[0]}</p>
            </div>
          </div>
          <button onClick={logout} className="flex items-center space-x-2 text-red-600 text-sm hover:underline">
            <LogOut size={16} /> <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <header className="bg-white shadow-sm p-4 flex justify-between items-center">
          <div className="flex items-center">
            {/* Mobile Menu Button - simplified */}
            <div className="md:hidden mr-4"><Menu/></div>
            <h1 className="text-2xl font-bold text-gray-800 capitalize">{activeTab}</h1>
          </div>
          <div className="text-sm text-gray-500">{new Date().toDateString()}</div>
        </header>
        
        <main className="p-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-500">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-gray-500">Total Patients</p>
                    <h3 className="text-3xl font-bold text-gray-800">124</h3>
                  </div>
                  <Users className="text-blue-500" />
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-gray-500">Active Doctors</p>
                    <h3 className="text-3xl font-bold text-gray-800">12</h3>
                  </div>
                  <Stethoscope className="text-green-500" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'patients' && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-bold text-gray-700">Patient Directory</h3>
                {(hasRole(['RECEPTIONIST', 'HOSPITAL_ADMIN'])) && 
                  <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm flex items-center space-x-2">
                    <FilePlus size={16} /> <span>New Patient</span>
                  </button>
                }
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-gray-600 text-sm uppercase">
                    <tr>
                      <th className="p-4">ID</th>
                      <th className="p-4">Name</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Gender</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {patients.map(p => (
                      <tr key={p._id} className="hover:bg-gray-50">
                        <td className="p-4 font-mono text-sm text-blue-600">{p.patientId}</td>
                        <td className="p-4 font-medium">{p.name}</td>
                        <td className="p-4"><span className={`px-2 py-1 rounded text-xs ${p.type === 'IPD' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>{p.type}</span></td>
                        <td className="p-4 text-gray-500">{p.gender}</td>
                        <td className="p-4"><span className="text-green-600 flex items-center text-xs"><CheckCircle size={12} className="mr-1"/> Active</span></td>
                      </tr>
                    ))}
                    {patients.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-gray-500">No patients found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 shadow-2xl">
            <h3 className="text-xl font-bold mb-4">Register Patient</h3>
            <form onSubmit={handleAddPatient} className="space-y-3">
              <input required placeholder="Full Name" className="w-full border p-2 rounded"
                value={newPatient.name} onChange={e => setNewPatient({...newPatient, name: e.target.value})} />
              <select className="w-full border p-2 rounded"
                value={newPatient.gender} onChange={e => setNewPatient({...newPatient, gender: e.target.value})}>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
              <select className="w-full border p-2 rounded"
                value={newPatient.type} onChange={e => setNewPatient({...newPatient, type: e.target.value})}>
                <option>OPD</option><option>IPD</option>
              </select>
              <div className="flex space-x-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-200 py-2 rounded">Cancel</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// --- MAIN APP ---
export default function App() {
  const [auth, setAuth] = useState(null);

  const login = (token, user, tenantId) => {
    setAuth({ token, user, tenantId });
  };

  const logout = () => setAuth(null);

  if (!auth) return <Landing onLogin={login} />;
  return <Dashboard user={auth.user} token={auth.token} tenantId={auth.tenantId} logout={logout} />;
}
