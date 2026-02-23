import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { VehicleTable } from './VehicleTable';

export default function ManageVehicles() {
  // State for the list of vehicles fetched from MongoDB
  const [vehicles, setVehicles] = useState([]);
  
  // State for the registration form
  const [formData, setFormData] = useState({
    owner: '',
    contact: '',
    plate: '',
    type: '4-Wheeler'
  });

  // Fetch all vehicles when the component mounts
  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/vehicles');
      setVehicles(response.data);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
    }
  };

  // Handle registering a new vehicle
// Handle registering a new vehicle
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5000/api/vehicles/register', formData);
      
      if (response.status === 201 || response.status === 200) {
        // Success Logic:
        // 1. Clear the form
        setFormData({
          owner: '',
          contact: '',
          plate: '',
          type: '4-Wheeler'
        });
        
        // 2. Refresh the list from the database
        await fetchVehicles();
        
        alert("Vehicle Registered Successfully!");
      }
    } catch (error) {
      console.error("Full Error Object:", error);
      const serverMessage = error.response?.data?.message || "Server is unreachable";
      alert(serverMessage); 
    }
  };

  // Handle deleting a vehicle by its MongoDB _id
  const deleteVehicle = async (id) => {
    if (window.confirm("Are you sure you want to delete this vehicle?")) {
      try {
        await axios.delete(`http://localhost:5000/api/vehicles/${id}`);
        fetchVehicles(); // Refresh the table list
      } catch (error) {
        alert("Could not delete vehicle.");
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Registration Form Panel */}
      <aside className="lg:col-span-4 bg-white rounded-[32px] p-8 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 mb-6">Register New Vehicle</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            type="text" 
            placeholder="Owner Name" 
            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-5 py-3 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            value={formData.owner}
            onChange={(e) => setFormData({...formData, owner: e.target.value})}
            required
          />
          <input 
            type="text" 
            placeholder="Owner Contact" 
            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-5 py-3 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            value={formData.contact}
            onChange={(e) => setFormData({...formData, contact: e.target.value})}
            required
          />
          <input 
            type="text" 
            placeholder="LICENSE PLATE" 
            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-5 py-3 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all uppercase"
            value={formData.plate}
            onChange={(e) => setFormData({...formData, plate: e.target.value.toUpperCase()})}
            required
          />
          <select 
            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-5 py-3 outline-none cursor-pointer"
            value={formData.type}
            onChange={(e) => setFormData({...formData, type: e.target.value})}
          >
            <option value="4-Wheeler">4-Wheeler</option>
            <option value="2-Wheeler">2-Wheeler</option>
          </select>

          <button type="submit" className="w-full bg-[#2563eb] text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all mt-4">
            Register Vehicle
          </button>
        </form>
      </aside>

      {/* Registered Vehicles Table Panel */}
      <main className="lg:col-span-8 bg-white rounded-[32px] p-8 shadow-sm min-h-[600px] flex flex-col">
        <h2 className="text-xl font-bold text-slate-800 mb-8">Registered Vehicles</h2>
        <VehicleTable vehicles={vehicles} onDelete={deleteVehicle} />
      </main>
    </div>
  );
}