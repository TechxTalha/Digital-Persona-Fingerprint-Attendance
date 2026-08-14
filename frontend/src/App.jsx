import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  DollarSign,
  Activity,
  Plus,
  Trash2,
  Calendar,
  CheckCircle,
  AlertCircle,
  Search,
  Filter,
  UserPlus,
  RefreshCw,
  Fingerprint,
  Moon,
  Sun,
  MapPin,
  ClipboardList,
  Lock,
  LogOut,
  User,
  ZapOff,
  Download,
  Menu,
  X,
} from 'lucide-react';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

import AttendanceKiosk from './components/AttendanceKiosk';
import FingerprintEnrollmentModal from './components/FingerprintEnrollmentModal';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const LOCAL_AGENT_KEY = 'alkaram_secret_agent_key_2026';

export default function App() {
  // Authentication States
  const [admin, setAdmin] = useState(() => {
    const token = localStorage.getItem('adminToken');
    const username = localStorage.getItem('adminUsername');
    return token ? { username, token } : null;
  });
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Main App States
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [logs, setLogs] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  
  // Loading & Alert States
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null); // { type: 'success' | 'error', message: '' }

  // Registration Form States
  const [empName, setEmpName] = useState('');
  const [empCnic, setEmpCnic] = useState('');
  const [empRole, setEmpRole] = useState('Nurse');
  const [empRate, setEmpRate] = useState('500');
  const [empPhone, setEmpPhone] = useState('');
  const [empShift, setEmpShift] = useState('Morning');
  const [editingEmployee, setEditingEmployee] = useState(null);
  // Biometric Enrollment State
  const [enrollEmployee, setEnrollEmployee] = useState(null);

  const handleEnrollComplete = () => {
    setEnrollEmployee(null);
    fetchEmployeesSilent();
    triggerAlert('success', 'Fingerprint enrolled successfully!');
  };

  // Filters
  const [logFilterEmployee, setLogFilterEmployee] = useState('');
  const [logFilterShift, setLogFilterShift] = useState('');
  const [logFilterStartDate, setLogFilterStartDate] = useState('');
  const [logFilterEndDate, setLogFilterEndDate] = useState('');

  // Payroll Calculation Form States
  const [payrollEmployeeId, setPayrollEmployeeId] = useState('');
  const [payrollMonth, setPayrollMonth] = useState(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  });

  // Simulator Widget States
  const [simEmployeeId, setSimEmployeeId] = useState('');
  const [simMessage, setSimMessage] = useState(null);

  // Helper to fetch request headers with JWT Token
  const getAuthHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${admin?.token || ''}`,
    };
  };

  // Silent background fetch to support real-time updating without loading flashing
  const fetchEmployeesSilent = async () => {
    if (!admin) return;
    try {
      const res = await fetch(`${API_BASE}/employees`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setEmployees(data.data);
      }
    } catch (err) {
      console.error('Silent employees sync failed:', err);
    }
  };

  const fetchLogsSilent = async () => {
    if (!admin) return;
    try {
      const res = await fetch(`${API_BASE}/attendance/logs`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
      }
    } catch (err) {
      console.error('Silent logs sync failed:', err);
    }
  };

  // Fetch initial data if logged in
  useEffect(() => {
    if (admin) {
      fetchEmployees();
      fetchLogs();
      fetchPayrolls();
    }
  }, [admin]);

  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  // --- Auth API calls ---
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('adminUsername', data.admin.username);
        setAdmin({ username: data.admin.username, token: data.token });
        setLoginUsername('');
        setLoginPassword('');
      } else {
        setAuthError(data.message || 'Invalid username or password');
      }
    } catch (err) {
      setAuthError('Connection to authentication server failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUsername');
    setAdmin(null);
    setEmployees([]);
    setLogs([]);
    setPayrolls([]);
  };

  // --- Core API Integrations ---

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/employees`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setEmployees(data.data);
      } else if (res.status === 401) {
        handleLogout();
      } else {
        triggerAlert('error', data.message || 'Failed to fetch employees');
      }
    } catch (err) {
      triggerAlert('error', 'Server offline or database disconnected');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (filters = {}) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filters.employeeId) queryParams.append('employeeId', filters.employeeId);
      if (filters.shift) queryParams.append('shift', filters.shift);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);

      const res = await fetch(`${API_BASE}/attendance/logs?${queryParams.toString()}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayrolls = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/payroll/history`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setPayrolls(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterEmployee = async (e) => {
    e.preventDefault();
    if (!/^\d{5}-\d{7}-\d{1}$/.test(empCnic)) {
      triggerAlert('error', 'CNIC must match Pakistan national ID format (XXXXX-XXXXXXX-X)');
      return;
    }

    try {
      const url = editingEmployee ? `${API_BASE}/employees/${editingEmployee._id}` : `${API_BASE}/employees`;
      const method = editingEmployee ? 'PUT' : 'POST';
      const body = {
        name: empName,
        cnic: empCnic,
        role: empRole,
        hourlyRate: Number(empRate),
        phone: empPhone,
        shift: empShift,
      };

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        triggerAlert('success', editingEmployee ? 'Staff profile updated' : 'Staff registered successfully');
        resetEmpForm();
        fetchEmployees();
        setActiveTab('employees');
      } else {
        triggerAlert('error', data.message);
      }
    } catch (err) {
      triggerAlert('error', 'API Request failed');
    }
  };

  const resetEmpForm = () => {
    setEmpName('');
    setEmpCnic('');
    setEmpRole('Nurse');
    setEmpRate('500');
    setEmpPhone('');
    setEmpShift('Morning');
    setEditingEmployee(null);
  };

  const handleEditEmployee = (emp) => {
    setEditingEmployee(emp);
    setEmpName(emp.name);
    setEmpCnic(emp.cnic);
    setEmpRole(emp.role);
    setEmpRate(emp.hourlyRate);
    setEmpPhone(emp.phone);
    setEmpShift(emp.shift);
    setActiveTab('employees');
  };

  const handleDeleteEmployee = async (id) => {
    if (!window.confirm('Are you sure? This will delete all attendance logs and payroll sheets associated with this employee.')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/employees/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        triggerAlert('success', data.message);
        fetchEmployees();
        fetchLogs();
        fetchPayrolls();
      } else {
        triggerAlert('error', data.message);
      }
    } catch (err) {
      triggerAlert('error', 'API Request failed');
    }
  };

  const handleApplyLogFilters = (e) => {
    e.preventDefault();
    fetchLogs({
      employeeId: logFilterEmployee,
      shift: logFilterShift,
      startDate: logFilterStartDate,
      endDate: logFilterEndDate,
    });
  };

  const handleClearLogFilters = () => {
    setLogFilterEmployee('');
    setLogFilterShift('');
    setLogFilterStartDate('');
    setLogFilterEndDate('');
    fetchLogs();
  };

  const handleExportExcel = () => {
    if (logs.length === 0) {
      triggerAlert('error', 'No logs available to export.');
      return;
    }
    const exportData = logs.map(log => ({
      'Employee Name': log.employeeId?.name || 'Unknown',
      'CNIC': log.employeeId?.cnic || 'N/A',
      'Shift': log.shift,
      'Check-In': log.checkIn ? new Date(log.checkIn).toLocaleString() : 'N/A',
      'Check-Out': log.checkOut ? new Date(log.checkOut).toLocaleString() : 'Active Now',
      'Hours Worked': log.duration ? log.duration.toString() : (log.checkOut ? '0.00' : 'Calculating...'),
      'Warnings': log.autoCheckedOut ? 'Auto Check-Out' : ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Logs');
    XLSX.writeFile(workbook, 'Attendance_Logs.xlsx');
  };

  const handleExportPDF = () => {
    if (logs.length === 0) {
      triggerAlert('error', 'No logs available to export.');
      return;
    }
    const doc = new jsPDF('landscape');
    
    // Title
    doc.setFontSize(16);
    doc.text('Biometric Attendance Logs', 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    const tableColumn = ["Employee", "CNIC", "Shift", "Check-In", "Check-Out", "Hours Worked", "Warnings"];
    const tableRows = [];

    logs.forEach(log => {
      const rowData = [
        log.employeeId?.name || 'Unknown',
        log.employeeId?.cnic || 'N/A',
        log.shift,
        log.checkIn ? new Date(log.checkIn).toLocaleString() : 'N/A',
        log.checkOut ? new Date(log.checkOut).toLocaleString() : 'Active Now',
        log.duration ? log.duration.toString() : (log.checkOut ? '0.00' : 'Calculating...'),
        log.autoCheckedOut ? 'Auto Check-Out' : ''
      ];
      tableRows.push(rowData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 28,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [20, 184, 166] } // teal-500
    });

    doc.save('Attendance_Logs.pdf');
  };

  const handleCalculatePayroll = async (e) => {
    e.preventDefault();
    if (!payrollEmployeeId) {
      triggerAlert('error', 'Please select an employee.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/payroll/calculate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          employeeId: payrollEmployeeId,
          month: payrollMonth,
        }),
      });

      const data = await res.json();
      if (data.success) {
        triggerAlert('success', data.message);
        fetchPayrolls();
      } else {
        triggerAlert('error', data.message);
      }
    } catch (err) {
      triggerAlert('error', 'Server error calculating payroll');
    }
  };

  const handleTogglePaymentStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'Pending' ? 'Paid' : 'Pending';
    try {
      const res = await fetch(`${API_BASE}/payroll/${id}/status`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        triggerAlert('success', `Salary marked as ${nextStatus}`);
        fetchPayrolls();
      }
    } catch (err) {
      triggerAlert('error', 'Failed to update payment status');
    }
  };

  // Direct mock scanner simulation inside web page
  const handleSimulateScan = async (e) => {
    e.preventDefault();
    if (!simEmployeeId) return;

    const selectedEmployee = employees.find((emp) => emp._id === simEmployeeId);
    if (!selectedEmployee) return;

    try {
      const res = await fetch(`${API_BASE}/attendance/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Local-Agent-Key': LOCAL_AGENT_KEY,
        },
        body: JSON.stringify({ fingerprintTemplateId: selectedEmployee.fingerprintTemplateId }),
      });

      const data = await res.json();
      if (data.success) {
        setSimMessage({
          type: 'success',
          status: data.status,
          message: `${selectedEmployee.name}: ${data.message}`,
        });
        fetchEmployees();
        fetchLogs();
      } else {
        setSimMessage({ type: 'error', message: data.message });
      }
    } catch (err) {
      setSimMessage({ type: 'error', message: 'Connection to local backend scan endpoint failed.' });
    }
  };

  const handleSeedDatabase = async () => {
    setLoading(true);
    try {
      const dummyEmployees = [
        { name: 'Dr. Faisal Khan', cnic: '35202-4985223-1', role: 'Doctor', hourlyRate: 1500, phone: '0300-1234567', fingerprintTemplateId: 'FP-101', shift: 'Morning' },
        { name: 'Nurse Maria Bibi', cnic: '35201-8874129-2', role: 'Nurse', hourlyRate: 600, phone: '0321-7654321', fingerprintTemplateId: 'FP-102', shift: 'Evening' },
        { name: 'Dr. Ayesha Alvi', cnic: '35202-9988111-2', role: 'Doctor', hourlyRate: 1800, phone: '0333-9876543', fingerprintTemplateId: 'FP-103', shift: 'Night' },
        { name: 'Staff Sajid Raza', cnic: '35203-1234987-1', role: 'Support Staff', hourlyRate: 350, phone: '0345-4567890', fingerprintTemplateId: 'FP-104', shift: 'Morning' },
        { name: 'Admin Bilal Shah', cnic: '35202-0099887-1', role: 'Receptionist', hourlyRate: 450, phone: '0312-1122334', fingerprintTemplateId: 'FP-105', shift: 'Evening' }
      ];

      let seededCount = 0;
      for (const emp of dummyEmployees) {
        const res = await fetch(`${API_BASE}/employees`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(emp),
        });
        const data = await res.json();
        if (data.success) seededCount++;
      }

      triggerAlert('success', `Database seeded! Registered ${seededCount} staff members.`);
      fetchEmployees();
    } catch (err) {
      triggerAlert('error', 'Seeding failed. Ensure MongoDB is running.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate quick metrics
  const activeStaffCount = employees.filter((emp) => emp.status === 'Present').length;
  const totalHoursWorked = logs.reduce((sum, log) => sum + (log.duration || 0), 0);
  const totalSalariesPaid = payrolls
    .filter((pr) => pr.status === 'Paid')
    .reduce((sum, pr) => sum + pr.grossSalary, 0);

  // Render Login view if not authenticated
  if (!admin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 sm:p-6 antialiased font-sans">
        <div className="w-full max-w-md bg-slate-800 rounded-3xl border border-slate-700/50 shadow-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden">
          {/* Decorative backdrop gradients */}
          <div className="absolute -top-12 -right-12 h-36 w-36 bg-teal-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="absolute -bottom-12 -left-12 h-36 w-36 bg-sky-500/10 rounded-full blur-2xl pointer-events-none"></div>

          <div className="text-center space-y-3">
            <div className="inline-flex p-3 bg-teal-500/10 rounded-2xl text-teal-400 border border-teal-500/20">
              <Activity className="h-8 w-8 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">AlKaram Hospital</h2>
              <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase mt-0.5">Admin Security Access</p>
            </div>
          </div>

          {authError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold rounded-xl flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Username</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Enter username"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full bg-slate-850 border border-slate-700 text-sm font-medium pl-10 pr-3.5 py-3 rounded-xl outline-none text-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition duration-150"
                />
                <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Password</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-850 border border-slate-700 text-sm font-medium pl-10 pr-3.5 py-3 rounded-xl outline-none text-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition duration-150"
                />
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold text-sm py-3 rounded-xl shadow-lg shadow-teal-500/10 transition duration-150 flex items-center justify-center space-x-2 active:scale-98 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Authenticate Securely</span>
                </>
              )}
            </button>
          </form>

          <div className="text-center text-[10px] text-slate-500 border-t border-slate-700/40 pt-4">
            <p>Seeded Credentials for Testing:</p>
            <p className="font-semibold text-slate-400 mt-0.5">Username: admin | Password: admin123</p>
          </div>
        </div>
      </div>
    );
  }

  const navigateTo = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-[#f1f5f9] text-slate-800 antialiased overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[1px] md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] bg-slate-900 text-slate-200 flex flex-col justify-between shrink-0 shadow-lg transition-transform duration-300 ease-out md:static md:z-10 md:max-w-none md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Logo Brand Header */}
          <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="p-2 bg-teal-500 rounded-lg text-white shrink-0">
                <Activity className="h-6 w-6 animate-pulse" />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-lg text-white tracking-wide leading-none">AlKaram</h1>
                <span className="text-xs text-slate-400 font-medium tracking-wider">HOSPITAL SYSTEM</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-2 mt-2 sm:mt-4">
            <button
              onClick={() => navigateTo('overview')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition duration-150 text-sm font-medium ${
                activeTab === 'overview' ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <ClipboardList className="h-4.5 w-4.5" />
              <span>Overview Panel</span>
            </button>
            <button
              onClick={() => navigateTo('employees')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition duration-150 text-sm font-medium ${
                activeTab === 'employees' ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <Users className="h-4.5 w-4.5" />
              <span>Staff Directory</span>
            </button>
            <button
              onClick={() => navigateTo('logs')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition duration-150 text-sm font-medium ${
                activeTab === 'logs' ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <Clock className="h-4.5 w-4.5" />
              <span>Biometric Logs</span>
            </button>
            <button
              onClick={() => navigateTo('payroll')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition duration-150 text-sm font-medium ${
                activeTab === 'payroll' ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <DollarSign className="h-4.5 w-4.5" />
              <span>Payroll Sheets</span>
            </button>
            <button
              onClick={() => navigateTo('kiosk')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${
                activeTab === 'kiosk' ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <Fingerprint className="h-5 w-5" />
              <span>Kiosk Mode</span>
            </button>
          </nav>
        </div>

        {/* Database Seeder Button & Footer */}
        <div className="p-4 border-t border-slate-800 space-y-4">
          {employees.length === 0 && (
            <button
              onClick={handleSeedDatabase}
              disabled={loading}
              className="w-full bg-slate-800 border border-slate-700 hover:border-teal-500 text-teal-400 font-semibold py-2 px-3 rounded-xl text-xs flex items-center justify-center space-x-2 transition duration-200"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              <span>Seed Demo Staff</span>
            </button>
          )}

          {/* Admin Profiler and Logout */}
          <div className="bg-slate-850 rounded-xl p-3 flex items-center justify-between border border-slate-800">
            <div className="flex items-center space-x-2 text-xs min-w-0">
              <User className="h-4 w-4 text-teal-400 shrink-0" />
              <span className="font-semibold text-slate-300 truncate max-w-[120px]">{admin.username}</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-500 hover:text-rose-400 transition p-1 hover:bg-slate-800 rounded-lg shrink-0"
              title="Logout session"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          <div className="text-center text-[10px] text-slate-500">
            <p>© 2026 AlKaram Hospital</p>
            <p className="mt-1">Terminal Desk Agent V1.0</p>
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="min-h-16 h-auto py-3 sm:py-0 sm:h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 shrink-0 shadow-sm">
          <div className="flex items-center space-x-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 -ml-1 rounded-xl text-slate-600 hover:bg-slate-100 border border-slate-200 shrink-0"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="font-semibold text-base sm:text-lg text-slate-800 capitalize truncate">{activeTab} Manager</h2>
            {loading && <RefreshCw className="h-4 w-4 animate-spin text-teal-500 shrink-0" />}
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={() => {
                fetchEmployees();
                fetchLogs({
                  employeeId: logFilterEmployee,
                  shift: logFilterShift,
                  startDate: logFilterStartDate,
                  endDate: logFilterEndDate,
                });
                fetchPayrolls();
                triggerAlert('success', 'Data refreshed successfully');
              }}
              className="flex items-center space-x-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-bold border border-indigo-200 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Refresh Data</span>
            </button>
            <div className="hidden sm:flex items-center space-x-2 bg-slate-100 rounded-full px-3.5 py-1 text-xs font-semibold text-slate-600 border border-slate-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="hidden md:inline">Terminal Bridge Online</span>
              <span className="md:hidden">Online</span>
            </div>
          </div>
        </header>

        {/* Contents Wrapper */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 relative">
          
          {/* Action Alerts */}
          {alert && (
            <div
              className={`mb-6 p-4 rounded-xl flex items-center space-x-3 shadow-md border animate-fadeIn ${
                alert.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {alert.type === 'success' ? (
                <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
              )}
              <span className="text-sm font-medium">{alert.message}</span>
            </div>
          )}

          {/* TAB 1: OVERVIEW PANEL */}
          {activeTab === 'overview' && (
            <div className="space-y-6 sm:space-y-8">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm flex items-center justify-between">
                  <div className="space-y-1 min-w-0">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Registered Staff</span>
                    <p className="text-2xl sm:text-3xl font-extrabold text-slate-800">{employees.length}</p>
                  </div>
                  <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl border border-teal-100 shrink-0">
                    <Users className="h-6 w-6" />
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm flex items-center justify-between">
                  <div className="space-y-1 min-w-0">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Present Now</span>
                    <p className="text-2xl sm:text-3xl font-extrabold text-slate-800">{activeStaffCount}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shrink-0">
                    <Activity className="h-6 w-6" />
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm flex items-center justify-between">
                  <div className="space-y-1 min-w-0">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Hours Tracked</span>
                    <p className="text-2xl sm:text-3xl font-extrabold text-slate-800">{parseFloat(totalHoursWorked.toFixed(1))}</p>
                  </div>
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 shrink-0">
                    <Clock className="h-6 w-6" />
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm flex items-center justify-between">
                  <div className="space-y-1 min-w-0">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Disbursed Wages</span>
                    <p className="text-2xl sm:text-3xl font-extrabold text-slate-800 truncate">₨ {totalSalariesPaid.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 shrink-0">
                    <DollarSign className="h-6 w-6" />
                  </div>
                </div>
              </div>

              {/* Currently Present List */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800 text-sm tracking-wide">Active On-Duty Personnel</h3>
                </div>

                <div className="overflow-x-auto -mx-1 px-1">
                  <table className="w-full min-w-[520px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Employee</th>
                        <th className="py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Shift</th>
                        <th className="py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Check-in Time</th>
                        <th className="py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {employees.filter((emp) => emp.status === 'Present').length === 0 ? (
                        <tr>
                          <td colSpan="4" className="py-8 text-center text-xs text-slate-400 font-medium">
                            No staff members are currently checked in.
                          </td>
                        </tr>
                      ) : (
                        employees
                          .filter((emp) => emp.status === 'Present')
                          .map((emp) => {
                            const matchingLog = logs.find((l) => l.employeeId?._id === emp._id && l.checkOut === null);
                            return (
                              <tr key={emp._id} className="text-xs">
                                <td className="py-3 font-semibold text-slate-800">
                                  {emp.name}
                                  <span className="block text-[10px] text-slate-400 font-normal">{emp.role}</span>
                                </td>
                                <td className="py-3">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                    emp.shift === 'Morning' ? 'bg-orange-50 text-orange-600' :
                                    emp.shift === 'Evening' ? 'bg-teal-50 text-teal-600' : 'bg-purple-50 text-purple-600'
                                  }`}>
                                    {emp.shift}
                                  </span>
                                </td>
                                <td className="py-3 font-medium text-slate-500">
                                  {matchingLog ? new Date(matchingLog.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unknown'}
                                </td>
                                <td className="py-3 text-right">
                                  <span className="inline-flex items-center space-x-1.5 px-2 py-1 bg-emerald-50 rounded-full border border-emerald-100 text-[10px] text-emerald-700 font-bold">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <span>On-Duty</span>
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STAFF DIRECTORY */}
          {activeTab === 'employees' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
              {/* Form Side */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 h-fit space-y-5">
                <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
                  <UserPlus className="h-5 w-5 text-teal-500" />
                  <h3 className="font-bold text-slate-800 text-sm tracking-wide">
                    {editingEmployee ? 'Modify Staff Record' : 'Register New Staff'}
                  </h3>
                </div>

                <form onSubmit={handleRegisterEmployee} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Kamran Shah"
                      value={empName}
                      onChange={(e) => setEmpName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-sm font-medium px-3.5 py-2.5 rounded-xl outline-none focus:border-teal-500 transition duration-150"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">CNIC (Pakistan ID)</label>
                    <input
                      type="text"
                      required
                      placeholder="35202-1234567-1"
                      value={empCnic}
                      onChange={(e) => setEmpCnic(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-sm font-medium px-3.5 py-2.5 rounded-xl outline-none focus:border-teal-500 transition duration-150"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">Role</label>
                      <select
                        value={empRole}
                        onChange={(e) => setEmpRole(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-sm font-medium px-3.5 py-2.5 rounded-xl outline-none focus:border-teal-500 transition duration-150"
                      >
                        <option>Doctor</option>
                        <option>Nurse</option>
                        <option>Receptionist</option>
                        <option>Support Staff</option>
                        <option>Admin</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">Hourly Rate (PKR)</label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={empRate}
                        onChange={(e) => setEmpRate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-sm font-medium px-3.5 py-2.5 rounded-xl outline-none focus:border-teal-500 transition duration-150"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Phone Number</label>
                    <input
                      type="text"
                      required
                      placeholder="0300-1234567"
                      value={empPhone}
                      onChange={(e) => setEmpPhone(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-sm font-medium px-3.5 py-2.5 rounded-xl outline-none focus:border-teal-500 transition duration-150"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">Shift</label>
                      <select
                        value={empShift}
                        onChange={(e) => setEmpShift(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-sm font-medium px-3.5 py-2.5 rounded-xl outline-none focus:border-teal-500 transition duration-150"
                      >
                        <option value="Morning">Morning (8am-4pm)</option>
                        <option value="Evening">Evening (4pm-12am)</option>
                        <option value="Night">Night (12am-8am)</option>
                      </select>
                    </div>
                  </div>



                  <div className="flex space-x-3 pt-2">
                    <button
                      type="submit"
                      className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-bold text-sm py-2.5 px-4 rounded-xl shadow-md shadow-teal-500/10 hover:shadow-teal-500/20 transition duration-150"
                    >
                      {editingEmployee ? 'Update Profile' : 'Register Profile'}
                    </button>
                    {editingEmployee && (
                      <button
                        type="button"
                        onClick={resetEmpForm}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-sm py-2.5 px-4 rounded-xl transition duration-150"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Table List Side */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 xl:col-span-2 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800 text-sm tracking-wide font-sans">Active Employees Directory</h3>
                  <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{employees.length} registered</span>
                </div>

                <div className="overflow-x-auto -mx-1 px-1">
                  <table className="w-full min-w-[720px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Employee</th>
                        <th className="py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">CNIC</th>
                        <th className="py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Shift</th>
                        <th className="py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Rate/Hr</th>
                        <th className="py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fingerprint ID</th>
                        <th className="py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {employees.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-12 text-center text-xs text-slate-400 font-medium">
                            No employees found. Seed or add some staff.
                          </td>
                        </tr>
                      ) : (
                        employees.map((emp) => (
                          <tr key={emp._id} className="text-xs hover:bg-slate-50/50 transition duration-100">
                            <td className="py-3.5 font-semibold text-slate-800">
                              {emp.name}
                              <span className="block text-[10px] text-slate-400 font-normal">{emp.role} • {emp.phone}</span>
                            </td>
                            <td className="py-3.5 text-slate-500 font-medium font-sans">{emp.cnic}</td>
                            <td className="py-3.5">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                emp.shift === 'Morning' ? 'bg-orange-50 text-orange-600' :
                                emp.shift === 'Evening' ? 'bg-teal-50 text-teal-600' : 'bg-purple-50 text-purple-600'
                              }`}>
                                {emp.shift}
                              </span>
                            </td>
                            <td className="py-3.5 font-bold text-slate-700">₨ {emp.hourlyRate}</td>
                            <td className="py-3.5 font-mono text-slate-500 font-medium">
                              {emp.fingerprintTemplate ? (
                                <button
                                  onClick={() => setEnrollEmployee(emp)}
                                  className="text-emerald-600 font-bold text-[10px] hover:text-emerald-700 hover:underline decoration-emerald-300 underline-offset-2 transition-all cursor-pointer"
                                  title="Click to update fingerprint"
                                >
                                  ✅ ENROLLED
                                </button>
                              ) : (
                                <button
                                  onClick={() => setEnrollEmployee(emp)}
                                  className="text-[10px] font-bold text-white bg-indigo-500 hover:bg-indigo-600 px-2 py-1 rounded shadow-sm"
                                >
                                  Enroll Fingerprint
                                </button>
                              )}
                            </td>
                            <td className="py-3.5 text-right space-x-2">
                              <button
                                onClick={() => handleEditEmployee(emp)}
                                className="text-teal-600 hover:text-teal-700 hover:underline font-bold"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteEmployee(emp._id)}
                                className="text-rose-600 hover:text-rose-700 inline-flex items-center align-middle"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ATTENDANCE LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-4 sm:space-y-6">
              {/* Filter Panel */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
                <form onSubmit={handleApplyLogFilters} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Employee</label>
                    <select
                      value={logFilterEmployee}
                      onChange={(e) => setLogFilterEmployee(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-xs font-medium px-3.5 py-2.5 rounded-xl outline-none focus:border-teal-500 transition duration-150"
                    >
                      <option value="">-- All Staff --</option>
                      {employees.map((emp) => (
                        <option key={emp._id} value={emp._id}>{emp.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Shift</label>
                    <select
                      value={logFilterShift}
                      onChange={(e) => setLogFilterShift(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-xs font-medium px-3.5 py-2.5 rounded-xl outline-none focus:border-teal-500 transition duration-150"
                    >
                      <option value="">-- All Shifts --</option>
                      <option value="Morning">Morning</option>
                      <option value="Evening">Evening</option>
                      <option value="Night">Night</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Start Date</label>
                    <input
                      type="date"
                      value={logFilterStartDate}
                      onChange={(e) => setLogFilterStartDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-xs font-medium px-3.5 py-2 rounded-xl outline-none focus:border-teal-500 transition duration-150"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">End Date</label>
                    <input
                      type="date"
                      value={logFilterEndDate}
                      onChange={(e) => setLogFilterEndDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-xs font-medium px-3.5 py-2 rounded-xl outline-none focus:border-teal-500 transition duration-150"
                    />
                  </div>

                  <div className="flex space-x-2">
                    <button
                      type="submit"
                      className="flex-1 bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold py-2.5 rounded-xl transition duration-150"
                    >
                      Filter Logs
                    </button>
                    <button
                      type="button"
                      onClick={handleClearLogFilters}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold py-2.5 px-3 rounded-xl transition duration-150"
                    >
                      Reset
                    </button>
                  </div>
                </form>
              </div>

              {/* Logs Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <h3 className="font-bold text-slate-800 text-sm tracking-wide">Biometric Session Activity</h3>
                    <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{logs.length} sessions tracked</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportExcel}
                      className="flex items-center space-x-1.5 bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-[11px] font-bold border border-green-200 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Excel</span>
                    </button>
                    <button
                      onClick={handleExportPDF}
                      className="flex items-center space-x-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 rounded-full text-[11px] font-bold border border-rose-200 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>PDF</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto -mx-1 px-1">
                  <table className="w-full min-w-[800px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Employee</th>
                        <th className="py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">CNIC</th>
                        <th className="py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Shift</th>
                        <th className="py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Check-In</th>
                        <th className="py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Check-Out</th>
                        <th className="py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hours Worked</th>
                        <th className="py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Warnings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {logs.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="py-12 text-center text-xs text-slate-400 font-medium">
                            No attendance logs match the current filters.
                          </td>
                        </tr>
                      ) : (
                        logs.map((log) => (
                          <tr key={log._id} className="text-xs hover:bg-slate-50/50 transition duration-100">
                            <td className="py-3.5 font-semibold text-slate-800">
                              {log.employeeId?.name || 'Removed Employee'}
                              <span className="block text-[10px] text-slate-400 font-normal">{log.employeeId?.role || ''}</span>
                            </td>
                            <td className="py-3.5 text-slate-500 font-medium">{log.employeeId?.cnic || 'N/A'}</td>
                            <td className="py-3.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                log.shift === 'Morning' ? 'bg-orange-50 text-orange-600' :
                                log.shift === 'Evening' ? 'bg-teal-50 text-teal-600' : 'bg-purple-50 text-purple-600'
                              }`}>
                                {log.shift}
                              </span>
                            </td>
                            <td className="py-3.5 font-medium text-slate-500">{new Date(log.checkIn).toLocaleString()}</td>
                            <td className="py-3.5 font-medium text-slate-500">
                              {log.checkOut ? new Date(log.checkOut).toLocaleString() : (
                                <span className="inline-flex items-center space-x-1 text-emerald-600 font-semibold animate-pulse">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                  <span>Active Now</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 font-bold text-slate-700">
                              {log.checkOut ? `${log.duration} hrs` : 'Calculating...'}
                            </td>
                            <td className="py-3.5 text-right">
                              {log.autoCheckedOut ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-100">
                                  Auto Checked Out (8hr limit)
                                </span>
                              ) : (
                                <span className="text-slate-400 font-medium">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PAYROLL sheets */}
          {activeTab === 'payroll' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
              {/* Generate Salary Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 h-fit space-y-5">
                <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
                  <DollarSign className="h-5 w-5 text-teal-500" />
                  <h3 className="font-bold text-slate-800 text-sm tracking-wide">Generate Monthly Salary</h3>
                </div>

                <form onSubmit={handleCalculatePayroll} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Employee</label>
                    <select
                      value={payrollEmployeeId}
                      onChange={(e) => setPayrollEmployeeId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-sm font-medium px-3.5 py-2.5 rounded-xl outline-none focus:border-teal-500 transition duration-150"
                      required
                    >
                      <option value="">-- Choose Employee --</option>
                      {employees.map((emp) => (
                        <option key={emp._id} value={emp._id}>
                          {emp.name} ({emp.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Month</label>
                    <input
                      type="month"
                      value={payrollMonth}
                      onChange={(e) => setPayrollMonth(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-sm font-medium px-3.5 py-2.5 rounded-xl outline-none focus:border-teal-500 transition duration-150"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold text-sm py-2.5 px-4 rounded-xl shadow-md shadow-teal-500/10 hover:shadow-teal-500/20 transition duration-150"
                  >
                    Calculate & Save Payroll
                  </button>
                </form>
              </div>

              {/* Payroll History Grid */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 xl:col-span-2 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800 text-sm tracking-wide">Salary Disbursement History</h3>
                  <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{payrolls.length} payroll sheets</span>
                </div>

                <div className="overflow-x-auto -mx-1 px-1">
                  <table className="w-full min-w-[720px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Employee</th>
                        <th className="py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Month</th>
                        <th className="py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hours Worked</th>
                        <th className="py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Rate</th>
                        <th className="py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gross Salary</th>
                        <th className="py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                        <th className="py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Payment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {payrolls.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="py-12 text-center text-xs text-slate-400 font-medium">
                            No payroll records found. Select an employee and run calculations above.
                          </td>
                        </tr>
                      ) : (
                        payrolls.map((pr) => (
                          <tr key={pr._id} className="text-xs hover:bg-slate-50/50 transition duration-100">
                            <td className="py-3.5 font-semibold text-slate-800">
                              {pr.employeeId?.name || 'Removed Employee'}
                              <span className="block text-[10px] text-slate-400 font-normal">{pr.employeeId?.role || ''}</span>
                            </td>
                            <td className="py-3.5 text-slate-500 font-medium font-sans">{pr.month}</td>
                            <td className="py-3.5 font-bold text-slate-700 font-sans">{pr.totalHours} hrs</td>
                            <td className="py-3.5 text-slate-500 font-sans">₨ {pr.hourlyRate}/hr</td>
                            <td className="py-3.5 font-black text-teal-600 font-sans">₨ {pr.grossSalary.toLocaleString()}</td>
                            <td className="py-3.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                pr.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                              }`}>
                                {pr.status}
                              </span>
                            </td>
                            <td className="py-3.5 text-right">
                              <button
                                onClick={() => handleTogglePaymentStatus(pr._id, pr.status)}
                                className={`text-[10px] font-bold px-2.5 py-1 rounded-xl transition duration-150 ${
                                  pr.status === 'Paid'
                                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    : 'bg-teal-500 text-white hover:bg-teal-600 shadow-sm shadow-teal-500/10'
                                }`}
                              >
                                {pr.status === 'Paid' ? 'Revert to Pending' : 'Mark as Paid'}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {/* TAB 5: KIOSK MODE */}
          {activeTab === 'kiosk' && !enrollEmployee && (
            <AttendanceKiosk />
          )}

        </div>
        
        {/* Modals & Portals */}
        <FingerprintEnrollmentModal 
          isOpen={!!enrollEmployee}
          employee={enrollEmployee}
          onClose={() => setEnrollEmployee(null)}
          onSuccess={handleEnrollComplete}
        />
      </main>
    </div>
  );
}
