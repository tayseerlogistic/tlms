import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLms } from '../context/LmsContext';
import { UserProfile, UserRole } from '../types';
import {
  Shield, Users, UserPlus, Key, Lock, CheckCircle2,
  AlertTriangle, RefreshCw, Trash2, Edit2, ShieldAlert,
  Search, Eye, EyeOff, Sparkles, UserCheck, XCircle,
  Truck, FileSpreadsheet, Wallet, Check, ChevronDown
} from 'lucide-react';

export const UserManagementView: React.FC = () => {
  const {
    user,
    profile,
    role,
    isAdmin,
    usersList,
    addUser,
    updateUser,
    updateUserRole,
    updateUserStatus,
    resetUserPassword,
    deleteUser
  } = useAuth();

  const { drivers } = useLms();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editUserModal, setEditUserModal] = useState<UserProfile | null>(null);
  const [passwordModalUser, setPasswordModalUser] = useState<UserProfile | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserProfile | null>(null);

  // New user form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('TLS@' + Math.floor(1000 + Math.random() * 9000));
  const [newRole, setNewRole] = useState<UserRole>('operator');
  const [newDriverId, setNewDriverId] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset password form state
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetError, setResetError] = useState('');

  // Toast / notification feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return usersList.filter(u => {
      const matchSearch =
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.notes && u.notes.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchRole = selectedRoleFilter === 'all' || u.role === selectedRoleFilter;
      const matchStatus = selectedStatusFilter === 'all' || (u.status || 'active') === selectedStatusFilter;
      return matchSearch && matchRole && matchStatus;
    });
  }, [usersList, searchTerm, selectedRoleFilter, selectedStatusFilter]);

  // Role metadata definitions
  const roleMeta: Record<UserRole, {
    label: string;
    badgeBg: string;
    badgeText: string;
    border: string;
    description: string;
    icon: any;
  }> = {
    admin: {
      label: 'Admin',
      badgeBg: 'bg-rose-500/20',
      badgeText: 'text-rose-400',
      border: 'border-rose-500/30',
      description: 'Full access to all modules, User Management, Master DB, Backups, and Audits.',
      icon: ShieldAlert
    },
    editor: {
      label: 'Editor',
      badgeBg: 'bg-indigo-500/20',
      badgeText: 'text-indigo-400',
      border: 'border-indigo-500/30',
      description: 'Can add, edit, and update Trucks, Equipment, Drivers, Daily Manifests, and Schedules.',
      icon: Edit2
    },
    operator: {
      label: 'Operator',
      badgeBg: 'bg-cyan-500/20',
      badgeText: 'text-cyan-400',
      border: 'border-cyan-500/30',
      description: 'Fleet operations, Timetable parsing, Manifest confirmation, and Dispatch execution.',
      icon: Truck
    },
    dispatcher: {
      label: 'Dispatcher',
      badgeBg: 'bg-blue-500/20',
      badgeText: 'text-blue-400',
      border: 'border-blue-500/30',
      description: 'Fleet dispatching, Route scheduling, and Daily manifest tracking.',
      icon: FileSpreadsheet
    },
    cashier: {
      label: 'Cashier',
      badgeBg: 'bg-emerald-500/20',
      badgeText: 'text-emerald-400',
      border: 'border-emerald-500/30',
      description: 'Cashbook Pro operations, Fuel voucher posting, Advances, and Expense settlements.',
      icon: Wallet
    },
    driver: {
      label: 'Driver',
      badgeBg: 'bg-amber-500/20',
      badgeText: 'text-amber-400',
      border: 'border-amber-500/30',
      description: 'Driver Portal, Personal trip view, assigned tractor/trailer status, and Odometer logs.',
      icon: UserCheck
    },
    viewer: {
      label: 'Viewer',
      badgeBg: 'bg-slate-500/20',
      badgeText: 'text-slate-400',
      border: 'border-slate-500/30',
      description: 'Read-only access to Fleet status, Daily schedules, and Performance dashboards.',
      icon: Users
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!newName.trim()) {
      setFormError('Please enter user full name.');
      return;
    }
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setFormError('Please provide a valid corporate email address.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setFormError('Password must contain at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedDriver = drivers.find(d => d.id === newDriverId);
      const res = await addUser({
        name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        role: newRole,
        driverId: newRole === 'driver' ? newDriverId : undefined,
        driverName: newRole === 'driver' ? selectedDriver?.name : undefined,
        notes: newNotes.trim()
      });

      if (!res.success) {
        setFormError(res.error || 'Failed to create user account.');
        return;
      }

      showToast(`User account for ${newEmail} created successfully with role "${roleMeta[newRole].label}".`);
      setIsAddModalOpen(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('TLS@' + Math.floor(1000 + Math.random() * 9000));
      setNewRole('operator');
      setNewDriverId('');
      setNewNotes('');
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser) return;
    if (!resetPasswordValue || resetPasswordValue.length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }

    try {
      await resetUserPassword(passwordModalUser.uid, resetPasswordValue);
      showToast(`Password updated successfully for ${passwordModalUser.email}`);
      setPasswordModalUser(null);
      setResetPasswordValue('');
      setResetError('');
    } catch (err: any) {
      setResetError(err.message || 'Failed to reset password.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmUser) return;
    try {
      await deleteUser(deleteConfirmUser.uid);
      showToast(`User account ${deleteConfirmUser.email} has been permanently deleted.`);
      setDeleteConfirmUser(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete user.');
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'TLS@';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(code);
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-emerald-400 font-medium text-xs animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl">
              <Shield className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 font-mono">
              User &amp; Access Control
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full font-sans font-semibold">
                RBAC Security
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Provision team members, assign granular permissions (<span className="text-rose-300 font-mono">Admin</span>, <span className="text-indigo-300 font-mono">Editor</span>, <span className="text-cyan-300 font-mono">Operator</span>, <span className="text-emerald-300 font-mono">Cashier</span>, <span className="text-amber-300 font-mono">Driver</span>), and enforce zero-signup corporate security.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <div className="inline-flex items-center gap-1.5 bg-rose-950/60 border border-rose-500/40 text-rose-300 text-[11px] font-mono px-3 py-1 rounded-lg">
              <Lock className="w-3.5 h-3.5 text-rose-400" />
              <span>Public Sign-Up: <strong>LOCKED</strong></span>
            </div>
            <div className="inline-flex items-center gap-1.5 bg-slate-800/80 border border-slate-700 text-slate-300 text-[11px] font-mono px-3 py-1 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Direct Admin Provisioning Active</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              setFormError('');
              setIsAddModalOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition"
          >
            <UserPlus className="w-4 h-4" /> Provision New User
          </button>
        </div>
      </div>

      {/* Super Admin Status Card */}
      <div className="bg-slate-900/90 border border-rose-500/30 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 font-bold">
            👑
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white font-mono">admin@tls.com</span>
              <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Primary Master Admin
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Root administrator account with full system privileges, access control, and master auditing.
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Immutable Root Protected
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Users', count: usersList.length, color: 'text-white', bg: 'bg-slate-900' },
          { label: 'Admins', count: usersList.filter(u => u.role === 'admin').length, color: 'text-rose-400', bg: 'bg-rose-950/20' },
          { label: 'Editors', count: usersList.filter(u => u.role === 'editor').length, color: 'text-indigo-400', bg: 'bg-indigo-950/20' },
          { label: 'Operators', count: usersList.filter(u => u.role === 'operator' || u.role === 'dispatcher').length, color: 'text-cyan-400', bg: 'bg-cyan-950/20' },
          { label: 'Cashiers', count: usersList.filter(u => u.role === 'cashier').length, color: 'text-emerald-400', bg: 'bg-emerald-950/20' },
          { label: 'Drivers', count: usersList.filter(u => u.role === 'driver').length, color: 'text-amber-400', bg: 'bg-amber-950/20' },
        ].map((stat, i) => (
          <div key={i} className={`${stat.bg} border border-slate-800 rounded-xl p-3 flex flex-col`}>
            <span className="text-[11px] text-slate-400 font-medium">{stat.label}</span>
            <span className={`text-xl font-bold font-mono mt-1 ${stat.color}`}>{stat.count}</span>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, email, or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        {/* Role Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-400 mr-1 hidden sm:inline">Role:</span>
          {['all', 'admin', 'editor', 'operator', 'cashier', 'driver', 'viewer'].map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRoleFilter(r)}
              className={`px-2.5 py-1 text-xs rounded-lg font-mono capitalize transition ${
                selectedRoleFilter === r
                  ? 'bg-indigo-600 text-white font-bold shadow'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] text-slate-400 font-mono uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">User Details</th>
                <th className="py-3 px-4">Role &amp; Permissions</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-mono">
                    No users matching criteria found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const roleConfig = roleMeta[u.role] || roleMeta.operator;
                  const Icon = roleConfig.icon;
                  const isMasterAdmin = u.email.toLowerCase() === 'admin@tls.com';
                  const isCurrentActive = user?.email?.toLowerCase() === u.email.toLowerCase();

                  return (
                    <tr key={u.uid} className="hover:bg-slate-800/40 transition">
                      {/* Name & Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase ${
                            isMasterAdmin
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}>
                            {u.name.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">{u.name}</span>
                              {isCurrentActive && (
                                <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.2 rounded font-mono">
                                  You
                                </span>
                              )}
                              {isMasterAdmin && (
                                <span className="text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-1.5 py-0.2 rounded font-mono">
                                  Master
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">{u.email}</div>
                            {u.notes && <div className="text-[10px] text-slate-500 italic mt-0.5">{u.notes}</div>}
                          </div>
                        </div>
                      </td>

                      {/* Role & Permissions */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {isMasterAdmin ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              <span>Admin</span>
                            </span>
                          ) : (
                            <div className="relative inline-block">
                              <select
                                value={u.role}
                                onChange={async (e) => {
                                  const targetRole = e.target.value as UserRole;
                                  await updateUserRole(u.uid, targetRole);
                                  showToast(`Updated role for ${u.email} to ${roleMeta[targetRole].label}`);
                                }}
                                className={`text-xs font-bold font-mono pl-2 pr-7 py-1 rounded-lg border appearance-none cursor-pointer focus:outline-none transition ${roleConfig.badgeBg} ${roleConfig.badgeText} ${roleConfig.border}`}
                              >
                                <option value="admin" className="bg-slate-900 text-rose-400">Admin (Full Access)</option>
                                <option value="editor" className="bg-slate-900 text-indigo-400">Editor (Fleet &amp; Manifests)</option>
                                <option value="operator" className="bg-slate-900 text-cyan-400">Operator (Daily Dispatch)</option>
                                <option value="dispatcher" className="bg-slate-900 text-blue-400">Dispatcher (Routes &amp; Loads)</option>
                                <option value="cashier" className="bg-slate-900 text-emerald-400">Cashier (Cashbook &amp; Fuel)</option>
                                <option value="driver" className="bg-slate-900 text-amber-400">Driver (Driver Portal)</option>
                                <option value="viewer" className="bg-slate-900 text-slate-400">Viewer (Read-Only)</option>
                              </select>
                              <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                            </div>
                          )}
                          <p className="text-[11px] text-slate-400 max-w-xs">{roleConfig.description}</p>
                          {u.driverName && (
                            <div className="text-[10px] text-amber-300 font-mono flex items-center gap-1">
                              <Truck className="w-3 h-3" /> Linked to driver: {u.driverName}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isMasterAdmin ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <button
                            onClick={async () => {
                              const newStatus = (u.status || 'active') === 'active' ? 'suspended' : 'active';
                              await updateUserStatus(u.uid, newStatus);
                              showToast(`Status updated to ${newStatus} for ${u.email}`);
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border transition ${
                              (u.status || 'active') === 'active'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              (u.status || 'active') === 'active' ? 'bg-emerald-400' : 'bg-rose-400'
                            }`} />
                            <span className="capitalize">{u.status || 'active'}</span>
                          </button>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : 'System'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Reset Password */}
                          <button
                            onClick={() => {
                              setPasswordModalUser(u);
                              setResetPasswordValue('');
                              setResetError('');
                            }}
                            title="Reset Password"
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition"
                          >
                            <Key className="w-4 h-4" />
                          </button>

                          {/* Edit User */}
                          <button
                            onClick={() => setEditUserModal(u)}
                            title="Edit User Details"
                            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete User */}
                          {!isMasterAdmin && (
                            <button
                              onClick={() => setDeleteConfirmUser(u)}
                              title="Delete User"
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permissions Matrix Reference Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              Role Permission Capabilities Matrix
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Overview of authorized capabilities assigned to each role within the TLS Logistics Hub.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-slate-800 rounded-xl overflow-hidden">
            <thead className="bg-slate-950 text-slate-400 font-mono text-[11px]">
              <tr>
                <th className="py-2.5 px-3">System Module / Feature</th>
                <th className="py-2.5 px-3 text-rose-400 font-bold">Admin</th>
                <th className="py-2.5 px-3 text-indigo-400 font-bold">Editor</th>
                <th className="py-2.5 px-3 text-cyan-400 font-bold">Operator</th>
                <th className="py-2.5 px-3 text-emerald-400 font-bold">Cashier</th>
                <th className="py-2.5 px-3 text-amber-400 font-bold">Driver</th>
                <th className="py-2.5 px-3 text-slate-400 font-bold">Viewer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {[
                { module: 'User Provisioning & Role Assign', admin: 'Full', editor: 'No', operator: 'No', cashier: 'No', driver: 'No', viewer: 'No' },
                { module: 'Master Data (Trucks, Equip, Drivers)', admin: 'Full', editor: 'Edit/Add', operator: 'View', cashier: 'View', driver: 'Assigned', viewer: 'View' },
                { module: 'Timetable Parser & Dispatching', admin: 'Full', editor: 'Full', operator: 'Full', cashier: 'View', driver: 'No', viewer: 'View' },
                { module: 'Daily Manifest Confirmation', admin: 'Full', editor: 'Full', operator: 'Full', cashier: 'View', driver: 'No', viewer: 'View' },
                { module: 'Cashbook Pro & Financial Posting', admin: 'Full', editor: 'No', operator: 'No', cashier: 'Full', driver: 'No', viewer: 'View' },
                { module: 'KM & Diesel Balancing Logs', admin: 'Full', editor: 'Edit', operator: 'Edit', cashier: 'Edit', driver: 'Odometer', viewer: 'View' },
                { module: 'System Backup / JSON Restore', admin: 'Full', editor: 'No', operator: 'No', cashier: 'No', driver: 'No', viewer: 'No' },
              ].map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30">
                  <td className="py-2 px-3 text-white font-sans font-medium">{row.module}</td>
                  <td className="py-2 px-3 text-rose-400 font-semibold">{row.admin}</td>
                  <td className="py-2 px-3 text-indigo-400">{row.editor}</td>
                  <td className="py-2 px-3 text-cyan-400">{row.operator}</td>
                  <td className="py-2 px-3 text-emerald-400">{row.cashier}</td>
                  <td className="py-2 px-3 text-amber-400">{row.driver}</td>
                  <td className="py-2 px-3 text-slate-500">{row.viewer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Add New User */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-mono">Provision New Team User</h3>
                  <p className="text-xs text-slate-400">Lock signup policy: User will log in with provided credentials.</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Khalid Mansour"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Corporate Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. operator1@tls.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  required
                />
              </div>

              {/* Initial Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">Initial Password</label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Auto Generate
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-10 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Minimum 6 characters. Provide this password to the employee.</p>
              </div>

              {/* Role Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Assigned System Role &amp; Permission</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(['operator', 'editor', 'dispatcher', 'cashier', 'admin', 'driver', 'viewer'] as UserRole[]).map((r) => {
                    const cfg = roleMeta[r];
                    const isSelected = newRole === r;
                    return (
                      <button
                        type="button"
                        key={r}
                        onClick={() => setNewRole(r)}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                          isSelected
                            ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span className="font-bold text-xs font-mono capitalize text-slate-200">{cfg.label}</span>
                        <span className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-tight">{cfg.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* If driver, select which driver */}
              {newRole === 'driver' && (
                <div>
                  <label className="block text-xs font-semibold text-amber-300 mb-1">Map to Fleet Driver Profile</label>
                  <select
                    value={newDriverId}
                    onChange={(e) => setNewDriverId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- Select Driver --</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.empNo || d.iqama})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Department / Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Department / Internal Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Operations shift B, Dammam Terminal"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs px-5 py-2 rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Provisioning...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" /> Create Account
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Reset Password */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-mono">Reset User Password</h3>
                  <p className="text-xs text-slate-400">{passwordModalUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setPasswordModalUser(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {resetError && (
              <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl text-rose-300 text-xs">
                {resetError}
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    placeholder="Enter at least 6 characters"
                    value={resetPasswordValue}
                    onChange={(e) => setResetPasswordValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-10 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs px-5 py-2 rounded-xl shadow-lg transition"
                >
                  Confirm Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Edit User Details */}
      {editUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-mono">Edit User Details</h3>
                  <p className="text-xs text-slate-400">{editUserModal.email}</p>
                </div>
              </div>
              <button
                onClick={() => setEditUserModal(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editUserModal.name}
                  onChange={(e) => setEditUserModal({ ...editUserModal, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Notes / Department</label>
                <input
                  type="text"
                  value={editUserModal.notes || ''}
                  onChange={(e) => setEditUserModal({ ...editUserModal, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditUserModal(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await updateUser(editUserModal.uid, {
                      name: editUserModal.name,
                      notes: editUserModal.notes
                    });
                    showToast(`Updated user profile for ${editUserModal.email}`);
                    setEditUserModal(null);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-5 py-2 rounded-xl transition shadow"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Delete Confirmation */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-mono">Delete Account?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to permanently delete user <strong className="text-white font-mono">{deleteConfirmUser.email}</strong>? They will immediately lose all access.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs px-5 py-2 rounded-xl shadow-lg transition"
              >
                Yes, Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
