import { Shield, CarFront, Zap } from 'lucide-react';

export const Navbar = ({ activeTab, onTabChange }) => {
  const tabs = ["Dashboard", "Parking", "Manage Vehicles"];

  return (
    <nav className="bg-white rounded-[24px] px-8 py-4 shadow-sm flex items-center justify-between mb-8">
      {/* --- Sleek Logo Section --- */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center">
          {/* Outer Ring/Shield */}
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
            <Shield size={24} className="text-white fill-blue-400/20" />
          </div>
          {/* Overlaid Car Icon */}
          <div className="absolute -right-2 -bottom-1 bg-white p-1 rounded-lg shadow-sm border border-slate-100">
            <CarFront size={12} className="text-blue-600" />
          </div>
        </div>
        
        <div className="flex flex-col">
          <span className="text-lg font-black text-slate-900 leading-none tracking-tight">
            GATE<span className="text-blue-600">WATCH</span>
          </span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 flex items-center gap-1">
            <Zap size={8} className="fill-blue-400 text-blue-400" /> 
            Security
          </span>
        </div>
      </div>

      {/* --- Navigation Tabs --- */}
      <div className="hidden md:flex items-center space-x-1">
        {tabs.map((tab) => (
          <button 
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === tab 
                ? "bg-[#2563eb] text-white shadow-lg shadow-blue-100" 
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
    </nav>
  );
};