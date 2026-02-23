import express from 'express';
import Reservation from '../models/Reservation.js';

const router = express.Router();

// 1. GET ALL
router.get('/', async (req, res) => {
  try {
    const reservations = await Reservation.find().sort({ createdAt: -1 });
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. POST (Save with Debugging)
router.post('/add', async (req, res) => {
  // DEBUG: Print the data coming from React
  console.log("📥 RECEIVED DATA:", req.body); 

  try {
    const newReservation = new Reservation(req.body);
    const savedReservation = await newReservation.save();
    
    console.log("✅ SAVED SUCCESSFULLY:", savedReservation);
    res.status(201).json(savedReservation);
  } catch (err) {
    // DEBUG: Print the exact reason why it failed
    console.error("❌ SAVE FAILED:", err.message); 
    
    res.status(400).json({ message: err.message });
  }
});

// 3. DELETE
router.delete('/:id', async (req, res) => {
  try {
    await Reservation.findByIdAndDelete(req.params.id);
    res.json({ message: "Reservation deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;