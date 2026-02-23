import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema({
  owner: { type: String, required: true },
  contact: { type: String, required: true },
  plate: { type: String, required: true, unique: true }, //
  type: { type: String, enum: ['2-Wheeler', '4-Wheeler'], default: '4-Wheeler' }
}, { timestamps: true });

export default mongoose.model('Vehicle', vehicleSchema);