import mongoose from 'mongoose';

const PlateSchema = new mongoose.Schema({
  plateNumber: { type: String, required: true },
  vehicleType: { type: String, required: true },
  location: String,
  owner: { type: String, default: 'Unregistered' }, // 🔥 ADD THIS
  isRegistered: { type: Boolean, default: false }, // 🔥 ADD THIS
  isReserved: { type: Boolean, default: false },
  reservedSlot: { type: String, default: null },
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', default: null },
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.model('Plate', PlateSchema);