import mongoose from 'mongoose';
import AccessRecord from './models/AccessRecord.js';
import dotenv from 'dotenv';

dotenv.config();

const seedData = [
  // Original Row A
  { plate: "ABC-1234", owner: "John Doe", type: "4-Wheeler", status: "Approved", slot: "A1", timestamp: new Date().toLocaleString() },
  { plate: "XYZ-9876", owner: "Jane Smith", type: "4-Wheeler", status: "Approved", slot: "A3", timestamp: new Date().toLocaleString() },
  { plate: "GHI-5544", owner: "Mike Ross", type: "2-Wheeler", status: "Approved", slot: "A5", timestamp: new Date().toLocaleString() },
  
  // Original Row B
  { plate: "KLT-1122", owner: "Harvey Specter", type: "4-Wheeler", status: "Approved", slot: "B2", timestamp: new Date().toLocaleString() },
  { plate: "MNO-3344", owner: "Rachel Zane", type: "2-Wheeler", status: "Approved", slot: "B8", timestamp: new Date().toLocaleString() },
  { plate: "PRQ-7788", owner: "Louis Litt", type: "4-Wheeler", status: "Approved", slot: "B10", timestamp: new Date().toLocaleString() },

  // --- THREE NEW UNIQUE RECORDS ---
  { plate: "UP-14-BN-0001", owner: "Bruce Wayne", type: "4-Wheeler", status: "Approved", slot: "A7", timestamp: new Date().toLocaleString() },
  { plate: "MH-12-DE-5566", owner: "Clark Kent", type: "4-Wheeler", status: "Approved", slot: "B5", timestamp: new Date().toLocaleString() },
  { plate: "DL-3C-AS-9988", owner: "Diana Prince", type: "2-Wheeler", status: "Approved", slot: "B1", timestamp: new Date().toLocaleString() }
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB...");

    // Clear existing records to avoid slot duplication
    await AccessRecord.deleteMany({});
    console.log("Cleared old AccessRecords.");

    // Insert new unique data
    await AccessRecord.insertMany(seedData);
    console.log("✅ Database Seeded! Total 9 slots are now Allocated (Green) on your Map.");
    
    process.exit();
  } catch (err) {
    console.error("Seed Error:", err);
    process.exit(1);
  }
};

seedDB();