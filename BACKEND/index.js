import express from 'express';
import { createServer } from 'http'; // Required for Socket.io
import { Server } from 'socket.io';   // Required for Socket.io
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

// Route Imports
import vehicleRoutes from './routes/vehicleRoutes.js';
import recordRoutes from './routes/recordRoutes.js';
import reservationRoutes from './routes/reservationRoutes.js';
import plateRoutes from './routes/plateRoutes.js';

dotenv.config();

const app = express();

// --- SOCKET.IO SETUP ---
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", // Your React App's URL
    methods: ["GET", "POST"]
  }
});

// Pass the 'io' instance to Express so routes can access it
app.set('socketio', io);

// Log when a client (React) connects
io.on('connection', (socket) => {
  console.log('📡 New Client Connected:', socket.id);
  socket.on('disconnect', () => console.log('🔌 Client Disconnected'));
});
// -----------------------

// Middleware
app.use(cors());
app.use(express.json());

// Mount Routes
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/plates', plateRoutes); 

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ MongoDB Connection Error:", err.message));

// Start Server (Use httpServer instead of app)
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});