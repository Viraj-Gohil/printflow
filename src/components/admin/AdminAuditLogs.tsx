import React from 'react';
import { FileCode2, Shield, User, Clock } from 'lucide-react';
import { useApp } from '../../lib/store/appStore';

export const AdminAuditLogs: React.FC = () => {
  const { auditLogs } = useApp();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Security Audit Logs</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Immutable audit trail of administrator actions, payment updates, and tenant lifecycle events.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Entity Type</th>
                <th className="py-3 px-4">Metadata</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-purple-700">
                    {log.action}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900">{log.actorName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{log.actorRole}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-mono">
                      {log.entityType}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 max-w-[200px] truncate">
                    {log.metadata ? JSON.stringify(log.metadata) : '-'}
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-400">
                    {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
