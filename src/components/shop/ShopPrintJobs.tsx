import React, { useState } from 'react';
import { useApp } from '../../lib/store';
import {
  Printer,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  X,
  User,
  Phone,
  Eye,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { PrintJob, PrintStatus } from '../../types';

export const ShopPrintJobs: React.FC = () => {
  const { activeShop, printJobs, updateJobStatus, simulateCustomerPrintJob } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [activeJobModal, setActiveJobModal] = useState<PrintJob | null>(null);

  const shopJobs = printJobs.filter((j) => j.shopId === activeShop.id);

  const filteredJobs = shopJobs.filter((job) => {
    const matchesSearch =
      job.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.files.some((f) => f.fileName.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (selectedStatus === 'ALL') return true;
    if (selectedStatus === 'PENDING') return job.printStatus === 'QUEUED' || job.printStatus === 'ASSIGNED';
    if (selectedStatus === 'PRINTING') return job.printStatus === 'PRINTING' || job.printStatus === 'DOWNLOADING';
    if (selectedStatus === 'COMPLETED') return job.printStatus === 'COMPLETED';
    if (selectedStatus === 'FAILED') return job.printStatus === 'FAILED' || job.printStatus === 'CANCELLED' || job.printStatus === 'REQUIRES_ATTENTION';
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-72">
            <input
              type="text"
              placeholder="Search by Order ID, file, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          {import.meta.env.DEV && (
            <button
              onClick={() => simulateCustomerPrintJob()}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Simulate incoming customer print job"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">+ Test Live Queue</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 overflow-x-auto w-full lg:w-auto p-1 bg-slate-100 rounded-xl">
          {[
            { id: 'ALL', label: 'All Jobs' },
            { id: 'PENDING', label: 'Pending / Queued' },
            { id: 'PRINTING', label: 'Printing' },
            { id: 'COMPLETED', label: 'Completed' },
            { id: 'FAILED', label: 'Failed' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedStatus === tab.id
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Customer Details</th>
                <th className="py-3 px-4">Files & Specs</th>
                <th className="py-3 px-4">Printer</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Print Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700">No Jobs Match Filter</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Customers uploading files via counter scan will automatically show up here.
                        </p>
                      </div>
                      {import.meta.env.DEV && (
                        <button
                          onClick={() => simulateCustomerPrintJob()}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Send Sample Test Print</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                      <button
                        onClick={() => setActiveJobModal(job)}
                        className="hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {job.id}
                        <Eye className="w-3 h-3 text-slate-400" />
                      </button>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-900">{job.customerName}</p>
                      <p className="text-[11px] text-slate-500">{job.customerPhone || 'Walk-in'}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-slate-900 truncate max-w-[160px]">
                        {job.files[0]?.fileName}
                      </p>
                      <span className="text-[11px] text-slate-500">
                        {job.files.length} doc{job.files.length > 1 ? 's' : ''} · {job.files[0]?.paperSize} · {job.files[0]?.color}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {job.assignedPrinterName || 'Auto-Queue'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-slate-900 block">₹{job.totalAmount.toFixed(2)}</span>
                      <span className="text-[10px] text-emerald-600 font-semibold">{job.paymentStatus}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          job.printStatus === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : job.printStatus === 'PRINTING'
                            ? 'bg-blue-50 text-blue-700 animate-pulse'
                            : job.printStatus === 'QUEUED'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {job.printStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {job.printStatus === 'QUEUED' && (
                          <button
                            onClick={() => updateJobStatus(job.id, 'PRINTING')}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold shadow-2xs cursor-pointer"
                          >
                            Print
                          </button>
                        )}
                        {job.printStatus === 'PRINTING' && (
                          <button
                            onClick={() => updateJobStatus(job.id, 'COMPLETED')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-2xs cursor-pointer"
                          >
                            Mark Ready
                          </button>
                        )}
                        <button
                          onClick={() => setActiveJobModal(job)}
                          className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded-lg text-[11px] cursor-pointer"
                        >
                          Details
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

      {activeJobModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold uppercase text-blue-600">Job Metadata</span>
                <h3 className="text-lg font-bold text-slate-900 font-mono">{activeJobModal.id}</h3>
              </div>
              <button
                onClick={() => setActiveJobModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[11px]">Customer</span>
                  <span className="font-bold text-slate-900">{activeJobModal.customerName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Mobile Phone</span>
                  <span className="font-bold text-slate-900">{activeJobModal.customerPhone || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Tracking Token</span>
                  <span className="font-mono text-slate-700">{activeJobModal.trackingToken}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Total Paid</span>
                  <span className="font-mono font-bold text-blue-700">₹{activeJobModal.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-800 block mb-2">Files & Print Settings:</span>
                <div className="space-y-2">
                  {activeJobModal.files.map((file) => (
                    <div key={file.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 truncate max-w-[240px]">{file.fileName}</span>
                        <span className="font-mono font-semibold text-slate-800">₹{(file.totalPrice || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 text-[11px] text-slate-600">
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded">{file.paperSize}</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded">{file.color}</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded">{file.sides}</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded">{file.copies} Copies</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded">{file.estimatedPages} Pages</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Created: {new Date(activeJobModal.createdAt).toLocaleTimeString()}
              </span>
              <div className="flex gap-2">
                {activeJobModal.printStatus !== 'COMPLETED' && (
                  <button
                    onClick={() => {
                      updateJobStatus(activeJobModal.id, 'COMPLETED');
                      setActiveJobModal(null);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs cursor-pointer"
                  >
                    Mark as Completed
                  </button>
                )}
                <button
                  onClick={() => setActiveJobModal(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
