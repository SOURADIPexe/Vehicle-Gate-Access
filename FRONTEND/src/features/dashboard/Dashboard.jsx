import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Calendar, Check } from 'lucide-react';
import { ApprovalCard } from '../../components/ui/ApprovalCard';
import { RecordTable } from './RecordTable';
import { ParkingMap } from '../parking/ParkingMap';
import { PARKING_SPOTS } from '../../data/mockData';

const socket = io('http://localhost:5000', {
  transports: ['websocket']
});

const processedPlates = new Set();

export default function Dashboard() {
  const [pending, setPending] = useState([]);
  const [records, setRecords] = useState([]);

  const actionLocks = useRef(new Set());

  // 1. WebSocket Listener
  useEffect(() => {
    socket.on('new_plate_detected', (newPlate) => {

      const cleanPlate = newPlate.plate.trim();

      // --- 1. BLOCK DUPLICATE EVENTS ---
      if (processedPlates.has(cleanPlate)) {
        return;
      }

      // Add to tracker & release after 30s
      processedPlates.add(cleanPlate);
      setTimeout(() => {
        processedPlates.delete(cleanPlate);
      }, 30000);

      const formattedSocketData = {
        id: newPlate.id,
        plate: cleanPlate,
        type: newPlate.type || 'Car',
        owner: newPlate.owner || 'Guest',
        isRegistered: newPlate.isRegistered || false,
        isReserved: newPlate.isReserved || false,
        reservedSlot: newPlate.reservedSlot || null,
        reservationId: newPlate.reservationId || null,
        time: newPlate.time,
        rawTimestamp: newPlate.rawTimestamp
      };

      setPending((prev) => [formattedSocketData, ...prev]);
    });

    return () => socket.off('new_plate_detected');
  }, []);

  // 2. Fetch Initial Pending Data
  useEffect(() => {
    const fetchPending = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/plates');
        const formattedData = response.data.map(item => ({
          id: item._id,
          plate: item.plateNumber,
          type: item.vehicleType || 'Car',
          owner: item.owner || 'Guest',
          isRegistered: item.isRegistered || false,
          isReserved: item.isReserved || false,
          reservedSlot: item.reservedSlot || null,
          reservationId: item.reservationId || null,
          time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          rawTimestamp: item.timestamp
        }));

        // Add DB items to processed blocker so we don't re-add them immediately
        formattedData.forEach(p => processedPlates.add(p.plate));
        setPending(formattedData);
      } catch (error) {
        console.log("Error fetching pending plates:", error);
      }
    };
    fetchPending();
  }, []);

  // 3. Fetch History
  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/records');
        setRecords(response.data);
      } catch (error) {
        console.log("Error fetching records:", error);
      }
    };
    fetchRecords();
  }, []);

  // --- THE ACTION HANDLER ---
  // This is passed down to ApprovalCard. It runs when user clicks OR when card timer ends.
  const handleAction = async (item, action) => {
    // 🔒 Check Lock
    if (actionLocks.current.has(item.id)) return;
    actionLocks.current.add(item.id);

    try {
      const timestamp = new Date().toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

      let assignedSlot = 'N/A';
      
      if (action === 'approved') {
        if (item.reservedSlot) {
          assignedSlot = item.reservedSlot;
        } else {
          try {
            const assignRes = await axios.post('http://localhost:5000/api/slots/assign', { type: item.type });
            assignedSlot = assignRes.data.slot;
          } catch (err) {
            console.error("Assign slot error:", err);
            // Fallback or error handling
            assignedSlot = 'Pending';
          }
        }
        
        // Trigger the physical ESP32 gate
        axios.post('http://localhost:5000/api/gate/trigger').catch(e => console.log("Gate error:", e));
      }

      const recordData = {
        plate: item.plate,
        owner: item.owner,
        type: item.type,
        status: action === 'approved' ? 'Approved' : 'Denied',
        slot: assignedSlot,
        timestamp: timestamp
      };

      // 1. Save to History
      const response = await axios.post('http://localhost:5000/api/records/add', recordData);
      setRecords(prev => [response.data, ...prev]);

      // 2. DELETE from pending collection 
      await axios.delete(`http://localhost:5000/api/plates/${item.id}`);

      // 3. IF Reserved, DELETE from Reservations
      if (item.reservationId) {
        await axios.delete(`http://localhost:5000/api/reservations/${item.reservationId}`);
      }

      // 4. Remove from UI
      setPending(prev => prev.filter(p => p.id !== item.id));
      console.log(`✅ Success: ${item.plate} handled.`);

    } catch (error) {
      console.error("❌ Action Error:", error);
      // Only unlock on error so user can retry. On success, we keep it locked 
      // since the item is removed from UI anyway.
      actionLocks.current.delete(item.id);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <aside className="lg:col-span-4 bg-white rounded-[32px] p-8 shadow-sm h-[700px] flex flex-col">
        <h2 className="text-xl font-bold text-slate-800 mb-6">Pending Approvals</h2>
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {pending.map((item) => (
            <ApprovalCard
              key={item.id}
              {...item} // Passes all data (plate, owner, etc.)
              onApprove={() => handleAction(item, 'approved')}
              onDeny={() => handleAction(item, 'denied')}
            />
          ))}
          {pending.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center opacity-30">
              <Check size={48} className="mb-2 text-emerald-500" />
              <p className="font-bold uppercase tracking-widest text-[10px]">All Requests Cleared</p>
            </div>
          )}
        </div>
      </aside>

      <main className="lg:col-span-8 bg-white rounded-[32px] p-8 shadow-sm h-[700px] flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <h2 className="text-xl font-bold text-slate-800">Live Parking Layout</h2>
        </div>
        <ParkingMap spots={PARKING_SPOTS} />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 mt-4">
          <h2 className="text-xl font-bold text-slate-800">Access Records</h2>
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-slate-400">
            <span className="text-sm font-medium">{new Date().toLocaleDateString('en-GB')}</span>
            <Calendar size={16} />
          </div>
        </div>
        <RecordTable records={records} />
      </main>
    </div>
  );
}