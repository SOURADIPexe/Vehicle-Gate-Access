import React, { useState } from 'react';
import { Navbar } from './components/layout/Navbar';
import Dashboard from './features/dashboard/Dashboard';
import ManageVehicles from './features/manage-vehicles/ManageVehicles';
import Parking from './features/parking/Parking'; // Check this path!
import './index.css';

function App() {
  const [currentTab, setCurrentTab] = useState("Dashboard");

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-6 md:p-10 text-slate-700">
      <div className="max-w-7xl mx-auto">
        <Navbar activeTab={currentTab} onTabChange={setCurrentTab} />
        
        {currentTab === "Dashboard" && <Dashboard />}
        {currentTab === "Manage Vehicles" && <ManageVehicles />}
        {currentTab === "Parking" && <Parking />}
        
        {currentTab === "Live Map" && <div className="p-20 text-center">Coming Soon</div>}
      </div>
    </div>
  );
}

export default App;