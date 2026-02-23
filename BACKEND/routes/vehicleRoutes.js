import express from 'express';
import Vehicle from '../models/Vehicle.js';

const router = express.Router();

// Get all vehicles
router.get('/', async (req, res) => {
  try {
    const vehicles = await Vehicle.find().sort({ createdAt: -1 });
    res.json(vehicles);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Register new vehicle with specific error for duplicates
router.post('/register', async (req, res) => {
  try {
    const newVehicle = new Vehicle(req.body);
    const savedVehicle = await newVehicle.save();
    res.status(201).json(savedVehicle);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Duplicate Plate: This vehicle is already registered." });
    }
    res.status(400).json({ message: err.message });
  }
});

// Delete a vehicle
router.delete('/:id', async (req, res) => {
  try {
    await Vehicle.findByIdAndDelete(req.params.id);
    res.json({ message: "Vehicle removed successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;