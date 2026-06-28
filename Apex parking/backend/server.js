// backend/server.js
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
require('dotenv').config();

const app = express();

// ==================== MIDDLEWARES ====================
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    const allowed = [
      process.env.FRONTEND_URL,
      'http://localhost:4200',
      'http://localhost:4201',
      'http://127.0.0.1:4200',
      'http://127.0.0.1:4201'
    ].filter(Boolean);
    if (allowed.includes(origin)) return callback(null, true);
    callback(null, true);
  },
  credentials: true
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== CONNEXION MONGODB ====================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connecté'))
  .catch(err => console.error('❌ MongoDB erreur:', err));

// ==================== ROUTES ====================
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Routes existantes
const authRoutes    = require('./src/routes/auth');
const userRoutes    = require('./src/routes/users');
const adminRoutes   = require('./src/routes/admin');

// Nouvelles routes intégrées
const iaRoutes      = require('./src/routes/ia');
const parkingRoutes = require('./src/routes/parking');
const subscriptionRoutes = require('./src/routes/subscription');
const reservationRoutes = require('./src/routes/reservation');
const paymentRoutes = require('./src/routes/payment');
const complaintRoutes = require('./src/routes/complaints');

app.use('/api/auth',         authRoutes);
app.use('/api/users',        userRoutes);
app.use('/api/admin',        adminRoutes);
app.use('/api/ia',           iaRoutes);
app.use('/api/parking',      parkingRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/payments',     paymentRoutes);
app.use('/api/complaints',   complaintRoutes);

// ==================== MOCK EMAILS ====================
const MockEmail = require('./src/models/MockEmail');

app.get('/api/mock-emails', async (req, res) => {
  try {
    const emails = await MockEmail.find().sort({ createdAt: -1 });
    res.json({ emails });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/mock-emails', async (req, res) => {
  try {
    await MockEmail.deleteMany({});
    res.json({ message: 'Boîte de réception virtuelle vidée.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== FICHIERS STATIQUES (SPA) ====================
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.includes('.')) {
    return res.sendFile(path.join(__dirname, '../frontend/index.html'));
  }
  next();
});

// ==================== GLOBAL ERROR HANDLER ====================
// Doit être déclaré APRÈS toutes les routes
const errorHandler = require('./src/middleware/errorHandler');
app.use(errorHandler);

// ==================== SERVEUR HTTP + SOCKET.IO ====================
const { initWebSocket } = require('./src/utils/websocket');
const server = http.createServer(app);
const io = initWebSocket(server);
app.set('io', io); // Rendre l'instance io disponible dans les controllers via req.app.get('io')

// ==================== DÉMARRAGE ====================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(` 🚀 Serveur Apex démarré`);
  console.log(`========================================`);
  console.log(` 📡 API:        http://localhost:${PORT}/api`);
  console.log(` 🤖 IA Mistral: POST http://localhost:${PORT}/api/ia/chat`);
  console.log(` 🏥 IA Health:  GET  http://localhost:${PORT}/api/ia/health`);
  console.log(` 🗺️  Carte:      GET  http://localhost:${PORT}/api/parking/map/parkings`);
  console.log(` 🅿️  Places:     GET  http://localhost:${PORT}/api/parking/:id/spots`);
  console.log(` 📋 Réservations: POST http://localhost:${PORT}/api/reservations`);
  console.log(` 📋 Mes réservs: GET  http://localhost:${PORT}/api/reservations/my`);
  console.log(` 🎫 Abonnements: PUT  http://localhost:${PORT}/api/subscriptions/:id/confirm`);
  console.log(`========================================\n`);
});

// Pré-charger les modèles pour éviter les warnings de ré-enregistrement
require('./src/models/User');
require('./src/models/Parking');
require('./src/models/ParkingSpot');
require('./src/models/SubscriptionPlan');
require('./src/models/Subscription');
require('./src/models/Reservation');
require('./src/models/Complaint');

console.log('✅ Modèles Utilisateur, Parking, ParkingSpot et Reservation chargés');

// ==================== JOB AUTO-EXPIRATION DES RÉSERVATIONS ====================
// Vérifie toutes les 5 minutes les réservations "pending" expirées
const reservationService = require('./src/services/ReservationService');
setInterval(async () => {
  try {
    const count = await reservationService._expirePendingReservations();
    if (count > 0) {
      console.log(`⏰ Auto-expiration : ${count} réservation(s) expirée(s).`);
    }
  } catch (err) {
    console.error('❌ Erreur auto-expiration réservations:', err.message);
  }
}, 5 * 60 * 1000); // toutes les 5 minutes