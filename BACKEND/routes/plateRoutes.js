import express from 'express';
import Plate from '../models/plate.js';
import Vehicle from '../models/Vehicle.js'; 
import Reservation from '../models/Reservation.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { plateNumber, vehicleType, location } = req.body;

    const cleanInput = plateNumber.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    const registeredUser = await Vehicle.findOne({ plate: cleanInput });
    
    const activeReservation = await Reservation.findOne({ plate: cleanInput, status: "Active" });

    const ownerName = registeredUser ? registeredUser.owner : (activeReservation ? activeReservation.owner : 'Unregistered');
    const isRegistered = !!registeredUser;
    const isReserved = !!activeReservation;
    const reservedSlot = activeReservation ? activeReservation.spot : null;
    const reservationId = activeReservation ? activeReservation._id : null;


    const newEntry = new Plate({ 
        plateNumber: cleanInput, 
        vehicleType, 
        location,
        owner: ownerName, 
        isRegistered,
        isReserved,
        reservedSlot,
        reservationId      
    });
    await newEntry.save();

    // 6. WebSocket Emit
    const io = req.app.get('socketio');
    if (io) {
      io.emit('new_plate_detected', {
          id: newEntry._id,
          plate: newEntry.plateNumber,
          type: newEntry.vehicleType,
          owner: ownerName,
          isRegistered: isRegistered,
          isReserved: isReserved,
          reservedSlot: reservedSlot,
          reservationId: reservationId,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }

    res.status(201).json(newEntry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const logs = await Plate.find().sort({ timestamp: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. DELETE: Clears the record after Approve/Deny
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Plate.findByIdAndDelete(id);
    
    if (!result) {
      return res.status(404).json({ message: "Plate not found" });
    }
    
    console.log(`🗑️ Deleted from Pending: ${id}`);
    res.status(200).json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;