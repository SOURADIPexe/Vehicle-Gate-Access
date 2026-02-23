import mongoose from 'mongoose';

const reservationSchema = new mongoose.Schema({
  plate: { type: String, required: true },
  owner: { type: String, required: true }, // <--- Frontend sends this, MUST be here
  type:  { type: String },                 // <--- Frontend sends this, MUST be here
  spot:  { type: String, required: true },
  time:  { type: String, required: true },
  status: { type: String, default: "Active" },
  createdAt: { type: Date, default: Date.now }
});

const Reservation = mongoose.model('Reservation', reservationSchema);
export default Reservation;