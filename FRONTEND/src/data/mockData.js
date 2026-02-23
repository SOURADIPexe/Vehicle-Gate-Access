export const INITIAL_PENDING = [
  { 
    id: 1, 
    plate: "AS12MI3871", 
    slot: "A1",          // <--- Slot is here
    owner: "John Doe",   // <--- Added Owner Name
    type: "4-Wheeler",   // <--- Added Wheeler Type
    time: "1:55:20 AM" 
  },
  { 
    id: 2, 
    plate: "AS22RX2974", 
    slot: "A3", 
    owner: "Jane Smith", 
    type: "2-Wheeler", 
    time: "1:55:48 AM" 
  },
  { 
    id: 3, 
    plate: "AS05YJ5579", 
    slot: "A1", 
    owner: "Rahul Das", 
    type: "4-Wheeler", 
    time: "1:56:09 AM" 
  }
];



export const PARKING_SPOTS = [
  // Row A
  { id: 'A1', type: '2W', status: 'occupied' },
  { id: 'A2', type: '2W', status: 'available' },
  { id: 'A3', type: '2W', status: 'available' },
  { id: 'A4', type: '2W', status: 'available' },
  { id: 'A5', type: '2W', status: 'available' },
  { id: 'A6', type: '2W', status: 'available' },
  { id: 'A7', type: '2W', status: 'available' },
  { id: 'A8', type: '2W', status: 'available' },
  { id: 'A9', type: '2W', status: 'available' },
  { id: 'A10', type: '2W', status: 'available' },
  // Row B
  { id: 'B1', type: '4W', status: 'occupied' },
  { id: 'B2', type: '4W', status: 'available' },
  { id: 'B3', type: '4W', status: 'available' },
  { id: 'B4', type: '4W', status: 'available' },
  { id: 'B5', type: '4W', status: 'available' },
  { id: 'B6', type: '4W', status: 'available' },
  { id: 'B7', type: '4W', status: 'available' },
  { id: 'B8', type: '4W', status: 'available' },
  { id: 'B9', type: '4W', status: 'available' },
  { id: 'B10', type: '4W', status: 'available' },
];

export const PARKED_VEHICLES = [
  { spot: 'A1', plate: 'AS01CD3556', type: '2-Wheeler', owner: 'Nganthoibi R' },
  { spot: 'B1', plate: 'AS01BC2345', type: '4-Wheeler', owner: 'Bedanta Gogoi' },
];

export const VEHICLE_TYPES = [
  { id: '2-Wheeler', type: 'Bike/Scooter' },
  { id: '4-Wheeler', type: 'Car/SUV' }
];

// Add some active reservations to see how they look
export const ACTIVE_RESERVATIONS = [
  { spot: 'A4', plate: 'AS01XY9999', owner: 'Rahul Sharma' }
];