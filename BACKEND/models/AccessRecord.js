import mongoose from 'mongoose';

const accessRecordSchema = new mongoose.Schema({
  plate: { type: String, required: true },
  owner: { type: String, required: true },
  type: { type: String, required: true },
  status: { type: String, required: true }, 
  slot: { type: String, required: true },  
  timestamp: { type: String, required: true } 
});

const AccessRecord = mongoose.model('AccessRecord', accessRecordSchema);
export default AccessRecord; 