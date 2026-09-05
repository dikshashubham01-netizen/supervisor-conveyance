import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { formatCurrency, formatDistance } from '../../utils/formatters';
import { Modal } from '../../components/common/Modal';
import {
  Users,
  UserPlus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  Phone,
  Key,
  Shield,
  RefreshCw,
  FileSpreadsheet,
  Upload,
  Download,
  AlertCircle
} from 'lucide-react';

export function SupervisorsPage() {
  const [supervisors, setSupervisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupervisor, setEditingSupervisor] = useState(null);
  const [formData, setFormData] = useState({
    employee_id: '',
    name: '',
    phone: '',
    password: '',
    status: 'active'
  });
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Bulk Excel Upload Modal State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkError, setBulkError] = useState(null);

  const fetchSupervisors = async () => {
    try {
      setLoading(true);
      const res = await api.supervisors.list();
      setSupervisors(res.supervisors || []);
    } catch (err) {
      console.error('Failed to load supervisors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupervisors();
  }, []);

  const openCreateModal = () => {
    setEditingSupervisor(null);
    setFormData({
      employee_id: '',
      name: '',
      phone: '',
      password: '',
      status: 'active'
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (sup) => {
    setEditingSupervisor(sup);
    setFormData({
      employee_id: sup.employee_id,
      name: sup.name,
      phone: sup.phone || '',
      password: '', // Blank unless changing
      status: sup.status
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setModalError(null);
    setModalSubmitting(true);

    try {
      if (editingSupervisor) {
        await api.supervisors.update(editingSupervisor.id, {
          name: formData.name,
          phone: formData.phone,
          status: formData.status,
          password: formData.password || undefined
        });
      } else {
        await api.supervisors.create(formData);
      }

      setIsModalOpen(false);
      fetchSupervisors();
    } catch (err) {
      setModalError(err.message || 'Operation failed');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleDelete = async (sup) => {
    if (!window.confirm(`Are you sure you want to remove supervisor ${sup.name} (${sup.employee_id})?`)) {
      return;
    }

    try {
      await api.supervisors.delete(sup.id);
      fetchSupervisors();
    } catch (err) {
      alert('Failed to delete supervisor: ' + err.message);
    }
  };

  const handleDownloadTemplate = () => {
    const a = document.createElement('a');
    a.href = '/Supervisor_Import_Template.xlsx';
    a.download = 'Supervisor_Import_Template.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const openBulkModal = () => {
    setBulkFile(null);
    setBulkResult(null);
    setBulkError(null);
    setIsBulkModalOpen(true);
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!bulkFile) {
      setBulkError('Please select an Excel or CSV file to upload');
      return;
    }

    try {
      setBulkLoading(true);
      setBulkError(null);
      const fd = new FormData();
      fd.append('file', bulkFile);
      const res = await api.supervisors.bulkUpload(fd);
      setBulkResult(res);
      fetchSupervisors();
    } catch (err) {
      setBulkError(err.message || 'Failed to upload file');
    } finally {
      setBulkLoading(false);
    }
  };

  const filtered = supervisors.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.phone && s.phone.includes(searchTerm))
  );

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Supervisor Management</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Register, manage, and monitor field supervisors
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={fetchSupervisors}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            title="Download Excel Template"
          >
            <Download className="w-4 h-4 text-brand-400" />
            <span className="hidden sm:inline">Download Template</span>
          </button>

          <button
            type="button"
            onClick={openBulkModal}
            className="flex items-center gap-2 py-2.5 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-950 transition"
            title="Bulk Import Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Import Excel</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-emerald-950 transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Supervisor</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 bg-slate-850 p-3 rounded-2xl border border-slate-800">
        <Search className="w-4 h-4 text-slate-400 ml-2" />
        <input
          type="text"
          placeholder="Search by name, employee ID, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-slate-850 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider bg-slate-900/60">
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Phone</th>
                <th className="py-3.5 px-4">Duty Status</th>
                <th className="py-3.5 px-4">Total Duties</th>
                <th className="py-3.5 px-4">Total Approved KM</th>
                <th className="py-3.5 px-4">Total Conveyance</th>
                <th className="py-3.5 px-4">Account Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No supervisors found matching search criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/50 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white text-sm">{s.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{s.employee_id}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono">
                      {s.phone || 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      {s.active_duty_id ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 border border-emerald-500/60 text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          ON DUTY
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400">
                          OFF DUTY
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-200">
                      {s.total_approved_duties || 0}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {formatDistance(s.total_approved_km)}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                      {formatCurrency(s.total_conveyance)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        s.status === 'active' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(s)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                          title="Edit Supervisor"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(s)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-400 transition"
                          title="Delete Supervisor"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSupervisor ? `Edit Supervisor (${editingSupervisor.employee_id})` : 'Register New Supervisor'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4 text-slate-200 text-xs">
          {modalError && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300">
              {modalError}
            </div>
          )}

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Employee ID *</label>
            <input
              type="text"
              required
              disabled={!!editingSupervisor}
              placeholder="e.g. EMP004"
              value={formData.employee_id}
              onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-brand-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Rajesh Kumar"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Phone Number</label>
            <input
              type="tel"
              placeholder="e.g. 9876543210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">
              {editingSupervisor ? 'Reset Password (leave blank to keep current)' : 'Login Password *'}
            </label>
            <input
              type="password"
              required={!editingSupervisor}
              placeholder="Enter password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          {editingSupervisor && (
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-semibold hover:bg-slate-750"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={modalSubmitting}
              className="py-2.5 px-4 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition disabled:opacity-50"
            >
              {modalSubmitting ? 'Saving...' : editingSupervisor ? 'Update Supervisor' : 'Create Supervisor'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Upload Modal */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => {
          setIsBulkModalOpen(false);
          setBulkResult(null);
          setBulkFile(null);
        }}
        title="Bulk Register Supervisors via Excel"
        maxWidth="max-w-lg"
      >
        <div className="flex flex-col gap-4 text-slate-200 text-xs">
          {/* Informational banner */}
          <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                Excel Template Required Format
              </span>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="text-brand-400 hover:text-brand-300 font-bold flex items-center gap-1 text-[11px] underline"
              >
                <Download className="w-3 h-3" />
                Download Sample Template (.xlsx)
              </button>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Your Excel file should have these 4 columns: <br />
              <strong className="text-slate-200">Employee ID</strong>, <strong className="text-slate-200">Full Name</strong>, <strong className="text-slate-200">Phone Number</strong>, <strong className="text-slate-200">Password</strong>.
            </p>
          </div>

          {bulkError && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{bulkError}</span>
            </div>
          )}

          {/* Success / Result Summary */}
          {bulkResult ? (
            <div className="flex flex-col gap-3 py-2">
              <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/50 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white text-sm">
                    Import Completed: {bulkResult.createdCount} IDs Created
                  </h4>
                  <p className="text-slate-300 text-[11px] mt-1">
                    {bulkResult.skippedCount > 0
                      ? `${bulkResult.skippedCount} rows skipped (e.g. already registered or missing details).`
                      : 'All supervisor records successfully registered in Supabase!'}
                  </p>
                </div>
              </div>

              {/* List of created */}
              {bulkResult.created && bulkResult.created.length > 0 && (
                <div className="max-h-36 overflow-y-auto bg-slate-900/90 rounded-xl p-3 border border-slate-800 font-mono text-[11px] flex flex-col gap-1">
                  <span className="text-emerald-400 font-bold font-sans text-xs">Successfully Added:</span>
                  {bulkResult.created.map((item, idx) => (
                    <div key={idx} className="text-slate-300 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {item}
                    </div>
                  ))}
                </div>
              )}

              {/* List of skipped */}
              {bulkResult.skipped && bulkResult.skipped.length > 0 && (
                <div className="max-h-36 overflow-y-auto bg-slate-900/90 rounded-xl p-3 border border-slate-800 font-mono text-[11px] flex flex-col gap-1">
                  <span className="text-amber-400 font-bold font-sans text-xs">Skipped Records:</span>
                  {bulkResult.skipped.map((item, idx) => (
                    <div key={idx} className="text-slate-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      {item}
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsBulkModalOpen(false);
                  setBulkResult(null);
                  setBulkFile(null);
                }}
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition"
              >
                Done & View Supervisors
              </button>
            </div>
          ) : (
            <form onSubmit={handleBulkUpload} className="flex flex-col gap-4">
              {/* Drag / File selector */}
              <div className="relative border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-2xl p-6 text-center transition bg-slate-900/50 flex flex-col items-center justify-center gap-2 cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setBulkFile(e.target.files[0]);
                      setBulkError(null);
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="w-12 h-12 rounded-full bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-white block">
                    {bulkFile ? bulkFile.name : 'Click to select Excel (.xlsx, .csv) file'}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    {bulkFile ? `${(bulkFile.size / 1024).toFixed(1)} KB` : 'or drag and drop your spreadsheet here'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-semibold hover:bg-slate-750"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!bulkFile || bulkLoading}
                  className="py-2.5 px-4 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-950"
                >
                  {bulkLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Upload & Create IDs</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </div>
  );
}
