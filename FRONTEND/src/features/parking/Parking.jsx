import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, Clock, Car, CheckCircle2, Trash2 } from 'lucide-react';
import { ParkingMap } from './ParkingMap';
import { ParkingTable } from './ParkingTable';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { PARKING_SPOTS } from '../../data/mockData';

export default function Parking() {
  // --- 1. State Management ---
  const [registeredVehicles, setRegisteredVehicles] = useState([]);
  const [activeReservations, setActiveReservations] = useState([]);
  const [accessRecords, setAccessRecords] = useState([]); // Added state for AccessRecords

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedSpot, setSelectedSpot] = useState(null);

  const searchRef = useRef(null);

  // --- 2. Load Data from all 3 Sources ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [vehRes, resRes, accRes] = await Promise.all([
          axios.get('http://localhost:5000/api/vehicles'),
          axios.get('http://localhost:5000/api/reservations'),
          axios.get('http://localhost:5000/api/records') // Fetching AccessRecords
        ]);
        setRegisteredVehicles(vehRes.data);
        setActiveReservations(resRes.data);
        setAccessRecords(accRes.data); //
      } catch (error) {
        console.error("Error loading data:", error);
      }
    };
    fetchData();
  }, []);

  // --- 3. Search Logic ---
  useEffect(() => {
    if (!searchTerm || searchTerm.trim() === '') {
      setSearchResults([]);
    } else {
      const results = registeredVehicles.filter(v => {
        const plate = v.plate ? v.plate.toLowerCase() : '';
        const owner = v.owner ? v.owner.toLowerCase() : '';
        const term = searchTerm.toLowerCase();
        return plate.includes(term) || owner.includes(term);
      });
      setSearchResults(results);
    }
  }, [searchTerm, registeredVehicles]);

  // --- 4. Click Outside Dropdown Handler ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- 5. Filtering Logic for Truly Available Spots ---
  // We compare PARKING_SPOTS against both activeReservations and accessRecords
  const availableSpots = PARKING_SPOTS.filter(spot => {
    // 1. Check if spot is in Reservation DB
    const isReserved = activeReservations.some(res => res.spot === spot.id);

    // 2. Check if spot is in AccessRecord DB
    const isOccupied = accessRecords.some(rec => rec.slot === spot.id);

    // Only return true if it's not in either database
    return !isReserved && !isOccupied;
  });

  // --- 6. Handle Reservation Logic ---
  const handleReserve = async () => {
    if (!selectedVehicle || !selectedSpot) return;

    const spotId = selectedSpot.id || selectedSpot.label || selectedSpot;

    const reservationData = {
      plate: selectedVehicle.plate,
      owner: selectedVehicle.owner || "Unknown",
      type: selectedVehicle.type || "4-Wheeler",
      spot: spotId,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    try {
      const res = await axios.post('http://localhost:5000/api/reservations/add', reservationData);
      setActiveReservations(prev => [res.data, ...prev]);
      setSelectedVehicle(null);
      setSearchTerm('');
      setSelectedSpot(null);
      alert("✅ Reservation Saved Successfully!");
    } catch (error) {
      console.error("Reservation failed", error);
      alert(`Failed to save: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleRemove = async (id) => {
    if (!window.confirm("Remove this active reservation?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/reservations/${id}`);
      setActiveReservations(prev => prev.filter(r => r._id !== id));
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div className="lg:col-span-8 flex flex-col gap-8">
        <ParkingMap spots={PARKING_SPOTS} />
        <ParkingTable />
      </div>

      <aside className="lg:col-span-4 flex flex-col gap-8 sticky top-6">
        <div className="bg-white rounded-[32px] p-8 shadow-sm h-fit">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Reserve a Parking Spot</h2>
          <div className="space-y-5">
            <div ref={searchRef} className="relative">
              <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Search Registered Vehicle</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name or plate..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowDropdown(true);
                    setSelectedVehicle(null);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  className={`w-full bg-slate-50 border ${selectedVehicle ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-100'} rounded-xl px-5 py-3 pr-10 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-slate-700`}
                />
                {selectedVehicle ? <CheckCircle2 size={18} className="absolute right-4 top-3.5 text-emerald-500" /> : <Search size={18} className="absolute right-4 top-3.5 text-slate-400" />}
              </div>

              {showDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 max-h-60 overflow-y-auto custom-scrollbar">
                  {searchResults.map((vehicle) => (
                    <div
                      key={vehicle._id}
                      onClick={() => {
                        setSelectedVehicle(vehicle);
                        setSearchTerm(`${vehicle.plate} - ${vehicle.owner}`);
                        setShowDropdown(false);
                      }}
                      className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 flex justify-between items-center group transition-colors"
                    >
                      <div>
                        <p className="font-bold text-slate-700 font-mono text-sm group-hover:text-blue-600">{vehicle.plate}</p>
                        <p className="text-xs text-slate-400 font-medium">{vehicle.owner}</p>
                      </div>
                      <div className="bg-slate-50 p-1.5 rounded-lg group-hover:bg-white">
                        <Car size={16} className="text-slate-300 group-hover:text-blue-500" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedVehicle && (
                <div className="mt-3 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Car size={16} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-emerald-600">Selected Type</p>
                    <p className="text-sm font-bold text-slate-700">{selectedVehicle.type || "Vehicle"}</p>
                  </div>
                </div>
              )}
            </div>

            {/* CustomSelect now uses the filtered availableSpots */}
            <CustomSelect
              label="Available Parking Spot"
              placeholder="Select available spot"
              options={availableSpots}
              onSelect={(spot) => setSelectedSpot(spot)}
            />

            <button
              onClick={handleReserve}
              disabled={!selectedVehicle || !selectedSpot}
              className={`w-full py-4 rounded-xl font-bold shadow-lg transition-all ${!selectedVehicle || !selectedSpot
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-[#4f46e5] text-white shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 transform active:scale-[0.98]'
                }`}
            >
              Confirm Reservation
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[32px] p-8 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-800">Active Reservations</h2>
            <span className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg text-xs font-bold">
              {activeReservations.length}
            </span>
          </div>

          <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
            {activeReservations.length > 0 ? (
              activeReservations.map((res) => (
                <div key={res._id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-colors group">
                  <div>
                    <p className="text-sm font-bold text-slate-700 font-mono group-hover:text-blue-600 transition-colors">{res.plate}</p>
                    <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5 mt-1">
                      <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-500 font-bold">Slot {res.spot}</span>
                      <span>• {res.owner}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end gap-1">
                      <Clock size={16} className="text-blue-500" />
                      <span className="text-[10px] font-bold text-slate-400">{res.time}</span>
                    </div>
                    <button
                      onClick={() => handleRemove(res._id)}
                      className="p-2 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Remove Reservation"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="border border-dashed border-slate-100 rounded-2xl p-8 text-center flex flex-col items-center gap-2">
                <div className="bg-slate-50 p-3 rounded-full">
                  <Clock size={24} className="text-slate-300" />
                </div>
                <p className="text-slate-400 text-sm italic">No active reservations.</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}