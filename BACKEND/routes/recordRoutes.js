import express from 'express';
import AccessRecord from '../models/AccessRecord.js';

const router = express.Router();

// 1. GET: Fetch all records (newest first)
router.get('/', async (req, res) => {
  try {
    // Sort by _id desc (newest created first) since we have no complex metadata
    const records = await AccessRecord.find().sort({ _id: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. POST: Save a new record (Approve/Deny action)
router.post('/add', async (req, res) => {
  try {
    const newRecord = new AccessRecord(req.body);
    const savedRecord = await newRecord.save();
    res.status(201).json(savedRecord);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;