import React from 'react';
import { Trash2 } from 'lucide-react';

export const VehicleTable = ({ vehicles, onDelete }) => (
  <div className="flex-1 overflow-auto custom-scrollbar">
    <table className="w-full text-left min-w-[700px]">
      <thead>
        <tr className="text-slate-400 text-[11px] uppercase font-bold tracking-widest border-b border-slate-50">
          <th className="pb-4 px-2">Owner Name</th>
          <th className="pb-4 px-2">Contact</th>
          <th className="pb-4 px-2">Vehicle Type</th>
          <th className="pb-4 px-2">License Plate</th>
          <th className="pb-4 px-2 text-center">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {vehicles.map((v) => (
          // Use MongoDB _id for the key
          <tr key={v._id} className="hover:bg-slate-50/50 transition-colors">

            {/* 1. Owner Name */}
            <td className="py-5 px-2 font-medium text-slate-700">{v.owner}</td>

            {/* 2. Contact */}
            <td className="py-5 px-2 text-slate-500">{v.contact}</td>

            {/* 3. NEW: Vehicle Type (Added this column) */}
            <td className="py-5 px-2 text-slate-500 text-sm">
              {v.type || "4-Wheeler"}
            </td>

            {/* 4. License Plate */}
            <td className="py-5 px-2">
              <span className="bg-slate-100 px-3 py-1.5 rounded-lg font-mono font-bold text-sm text-slate-700">
                {v.plate}
              </span>
            </td>

            {/* 5. Actions */}
            <td className="py-5 px-2">
              <div className="flex justify-center">
                <button
                  onClick={() => onDelete(v._id)}
                  className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors group"
                  title="Delete Vehicle"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);