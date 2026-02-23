import React from 'react';
import { StatusBadge } from '../../components/ui/StatusBadge';

export const RecordTable = ({ records }) => {
  // Empty State handler
  if (!records || records.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-20 text-slate-400">
        <p className="italic text-sm">No access records for today yet.</p>
        <p className="text-xs mt-2 opacity-60">Approve or deny a pending request to see it here.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto custom-scrollbar">
      <table className="w-full text-left min-w-[700px]">
        <thead>
          <tr className="text-slate-400 text-[11px] uppercase font-bold tracking-widest border-b border-slate-50">
            <th className="pb-4 px-2">License Plate</th>
            <th className="pb-4 px-2">Owner Name</th>
            <th className="pb-4 px-2">Type</th>
            <th className="pb-4 px-2">Status</th>
            <th className="pb-4 px-2">Parking Spot</th>
            <th className="pb-4 px-2 text-right">Timestamp</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {records.map((row) => (
            // Use row._id (from MongoDB) or row.id for stability
            <tr key={row._id || row.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="py-5 px-2">
                <span className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg font-mono font-bold text-sm">
                  {row.plate}
                </span>
              </td>
              <td className="py-5 px-2 font-medium text-slate-500">{row.owner}</td>
              <td className="py-5 px-2">
                <StatusBadge type={row.type} />
              </td>
              <td className="py-5 px-2">
                <StatusBadge type={row.status} variant="text" />
              </td>
              <td className="py-5 px-2 font-extrabold text-slate-700">{row.slot}</td>
              <td className="py-5 px-2 text-right text-[11px] font-medium text-slate-400 font-mono">
                {row.timestamp}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};