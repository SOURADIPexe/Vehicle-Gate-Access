import React, { useState, useEffect } from 'react';
import axios from 'axios';

// --- Single Spot Component ---
const SpotCard = ({ spot, status }) => {
  // Default: White (Available)
  let cardStyle = 'bg-white border-slate-100 text-slate-400 hover:border-blue-200';
  let textStyle = 'text-blue-500';

  // Case 1: Green (Allocated/Busy) - From AccessRecord DB
  if (status === 'allocated') {
    cardStyle = 'bg-[#22c55e] border-[#22c55e] text-white shadow-md transform scale-105'; // Green
    textStyle = 'text-green-100';
  }
  // Case 2: Blue (Reserved) - From Reservation DB
  else if (status === 'reserved') {
    cardStyle = 'bg-[#3b82f6] border-[#3b82f6] text-white shadow-md'; // Blue
    textStyle = 'text-blue-100';
  }

  return (
    <div className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 min-w-[55px] h-[55px] transition-all duration-300 ${cardStyle}`}>
      <span className="font-bold text-xs">{spot.id}</span>
      <span className={`text-[8px] uppercase font-bold mt-0.5 ${textStyle}`}>
        {/* Label: Alloc, Rsrv, or the Spot Type */}
        {status === 'allocated' ? 'Busy' : status === 'reserved' ? 'Rsrv' : spot.type}
      </span>
    </div>
  );
};

// --- Main Map Component ---
export const ParkingMap = ({ spots }) => {
  const [reservedSlots, setReservedSlots] = useState([]);   // Blue (Reservations)
  const [allocatedSlots, setAllocatedSlots] = useState([]); // Green (Access Records)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch BOTH databases
        const [resDb, recDb] = await Promise.all([
          axios.get('http://localhost:5000/api/reservations'), // Blue Source
          axios.get('http://localhost:5000/api/records')       // Green Source (AccessRecord)
        ]);

        // 1. Process Reservations (Blue)
        const blue = resDb.data.map(r => r.spot || r.slot);
        setReservedSlots(blue);

        // 2. Process Access Records (Green)
        // We map the 'slot' or 'spot' field from the AccessRecord DB
        // We filter out any records that might be marked as 'Exit' or 'Completed' if your DB has that logic
        const green = recDb.data
          .filter(r => r.slot || r.spot) // Ensure slot exists
          .map(r => r.slot || r.spot);   // Extract the ID

        setAllocatedSlots(green);

        // DEBUG: Check console to verify data is arriving
        // console.log("Blue Spots:", blue);
        // console.log("Green Spots:", green);

      } catch (error) {
        console.error("Map Data Error:", error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 600); // Live update every 5s
    return () => clearInterval(interval);
  }, []);

  // Priority Logic: Green (Physical Car) overrides Blue (Reservation)
  const getStatus = (id) => {
    if (allocatedSlots.includes(id)) return 'allocated'; // Green
    if (reservedSlots.includes(id)) return 'reserved';   // Blue
    return 'available';
  };

  const rowA = spots.filter(s => s.id.startsWith('A'));
  const rowB = spots.filter(s => s.id.startsWith('B'));

  return (
    <div className="bg-white rounded-[32px] p-8 shadow-sm mb-8">
      {/* Header & Legend */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-xl font-bold text-slate-800">Parking Map</h2>

        <div className="flex gap-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-[#22c55e] rounded-sm"></div>
            <span className="text-[10px] font-bold text-slate-600 uppercase">Occupied</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-[#3b82f6] rounded-sm"></div>
            <span className="text-[10px] font-bold text-slate-600 uppercase">Reserved</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-white border border-slate-300 rounded-sm"></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Empty</span>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {rowA.map(spot => <SpotCard key={spot.id} spot={spot} status={getStatus(spot.id)} />)}
        </div>
        <div className="flex flex-wrap gap-3">
          {rowB.map(spot => <SpotCard key={spot.id} spot={spot} status={getStatus(spot.id)} />)}
        </div>
      </div>
    </div>
  );
};