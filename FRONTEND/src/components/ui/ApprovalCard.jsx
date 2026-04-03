import React, { useState, useEffect } from 'react';
import { Check, X, Car, Bike, ShieldCheck, ShieldAlert, Timer } from 'lucide-react';

export const ApprovalCard = ({ plate, owner, type, time, isRegistered, isReserved, onApprove, onDeny }) => {
  const [timeLeft, setTimeLeft] = useState(10);
  const canAutoApprove = isRegistered || isReserved;

  useEffect(() => {
    // If not allowed to auto-approve, do nothing.
    if (!canAutoApprove) return;

    // 1. ACTION TIMER: The "Source of Truth" for the logic.
    // Triggers the actual approval function after 10 seconds.
    const actionTimer = setTimeout(() => {
      onApprove();
    }, 10000);

    // 2. VISUAL TIMER: purely for the UI countdown.
    const visualTimer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    // Cleanup: If user manually clicks Approve/Deny (unmounting the component),
    // we MUST clear these timers immediately to prevent "ghost" actions.
    return () => {
      clearTimeout(actionTimer);
      clearInterval(visualTimer);
    };
  }, [canAutoApprove, onApprove]);

  return (
    <div className={`bg-white border-2 ${isRegistered || isReserved ? 'border-slate-50' : 'border-orange-100'} rounded-2xl p-5 mb-4 hover:shadow-md transition-all group relative overflow-hidden`}>

      {/* Visual Indicator for Registration Status */}
      <div className="absolute top-0 right-0 flex">
        {canAutoApprove && timeLeft > 0 && (
          <div className="bg-indigo-600 text-white px-2 py-1 text-[9px] font-black flex items-center gap-1 animate-pulse">
            <Timer size={10} />
            {timeLeft}s
          </div>
        )}
        <div className={`px-3 py-1 rounded-bl-xl text-[9px] font-black uppercase tracking-tighter ${isRegistered ? 'bg-emerald-100 text-emerald-700' : (isReserved ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700')}`}>
          {isRegistered ? 'Registered Member' : (isReserved ? 'Reserved Slot' : 'Guest / Unregistered')}
        </div>
      </div>

      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {/* Dynamic Icon based on type */}
            {type === '2W' ? (
              <Bike size={14} className="text-blue-500" />
            ) : (
              <Car size={14} className="text-indigo-500" />
            )}
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {type}
            </span>
          </div>

          <h3 className="text-lg font-mono font-bold text-slate-800 tracking-tight">
            {plate}
          </h3>

          <div className="flex items-center gap-1.5 mt-1">
            {isRegistered ? (
              <ShieldCheck size={12} className="text-emerald-500" />
            ) : (
              <ShieldAlert size={12} className="text-orange-500" />
            )}
            <span className={`text-sm font-bold ${isRegistered ? 'text-slate-700' : 'text-orange-600'}`}>
              {owner}
            </span>
          </div>
        </div>

        <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 self-end">
          {time}
        </span>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onApprove}
          className="flex-1 bg-emerald-500 text-white py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-200"
        >
          <Check size={16} strokeWidth={3} />
          <span className="text-xs font-bold">Approve</span>
        </button>
        <button
          onClick={onDeny}
          className="flex-1 bg-white border border-slate-200 text-slate-600 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
        >
          <X size={16} strokeWidth={3} />
          <span className="text-xs font-bold">Deny</span>
        </button>
      </div>
    </div>
  );
};