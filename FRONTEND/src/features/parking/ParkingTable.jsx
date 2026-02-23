import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Car } from 'lucide-react';

export const ParkingTable = () => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch data from AccessRecords when component mounts
  useEffect(() => {
    const fetchParkedVehicles = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/records');
        
        // Filter only 'Approved' vehicles to show as parked
        // Note: Check if your DB saves 'Approved' or 'approved' and match accordingly
        const parkedOnly = res.data.filter(record => 
          record.status === 'Approved' || record.status === 'approved'
        );
        
        setVehicles(parkedOnly);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching parked vehicles:", error);
        setLoading(false);
      }
    };

    fetchParkedVehicles();
  }, []); // Empty dependency array means this runs once on load

  // Empty State
  if (!loading && vehicles.length === 0) {
    return (
      <div className="bg-white rounded-[32px] p-8 shadow-sm flex-1 flex flex-col items-center justify-center min-h-[300px]">
        <Car size={48} className="text-slate-200 mb-2" />
        <p className="text-slate-400 italic">No approved vehicles currently parked.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[32px] p-8 shadow-sm flex-1">
      <h2 className="text-xl font-bold text-slate-800 mb-6">Parked Vehicles</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-slate-400 text-[11px] uppercase font-bold tracking-widest border-b border-slate-50">
              <th className="pb-4">Spot #</th>
              <th className="pb-4">License Plate</th>
              <th className="pb-4">Vehicle Type</th>
              <th className="pb-4">Owner Name</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {vehicles.map((v) => (
              // Use MongoDB _id for the key
              <tr key={v._id} className="hover:bg-slate-50/50 transition-colors">
                
                {/* 1. Slot: AccessRecord uses 'slot', not 'spot' */}
                <td className="py-4 font-bold text-slate-800">
                  {v.slot || "--"}
                </td>
                
                {/* 2. Plate */}
                <td className="py-4">
                  <span className="bg-slate-100 px-2.5 py-1.5 rounded-lg font-mono font-bold text-xs text-slate-700">
                    {v.plate}
                  </span>
                </td>
                {/* 4. Type & Owner */}
                <td className="py-4 text-slate-500 text-sm">{v.type}</td>
                <td className="py-4 text-slate-700 font-medium text-sm">{v.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};