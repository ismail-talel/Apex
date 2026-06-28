// seed.js - Comptes de test + parkings de démonstration (Tunis)
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./src/models/User');
const Parking = require('./src/models/Parking');
const ParkingSpot = require('./src/models/ParkingSpot');
const SubscriptionPlan = require('./src/models/SubscriptionPlan');

const DEMO_SUBSCRIPTION_PLANS = [
  {
    parkingName: 'Parking Lafayette',
    name: 'Forfait Mensuel',
    description: 'Accès illimité pendant 30 jours au parking Lafayette.',
    price: 120,
    durationDays: 30,
    features: ['Accès 24/7', 'Place garantie', 'Support prioritaire']
  },
  {
    parkingName: 'Parking Lafayette',
    name: 'Forfait Hebdomadaire',
    description: 'Idéal pour une semaine de stationnement régulier.',
    price: 35,
    durationDays: 7,
    features: ['7 jours d\'accès', 'Réservation prioritaire']
  },
  {
    parkingName: 'Parking Carthage Byrsa',
    name: 'Forfait Week-end',
    description: 'Profitez du parking près du site archéologique.',
    price: 25,
    durationDays: 3,
    features: ['Vendredi au dimanche', 'Accès PMR inclus']
  },
  {
    parkingName: 'Parking La Marsa Corniche',
    name: 'Forfait Premium',
    description: 'Abonnement mensuel en bord de mer avec recharge électrique.',
    price: 150,
    durationDays: 30,
    features: ['Recharge électrique', 'Place couverte', 'Accès 24h/24']
  }
];

const DEMO_PARKINGS = [
  {
    name: 'Parking Lafayette',
    address: 'Avenue Habib Bourguiba',
    city: 'Tunis',
    zipCode: '1000',
    totalSpots: 40,
    availableSpots: 28,
    pricePerHour: 2.5,
    coordinates: [10.1815, 36.8065],
    openingTime: '07:00',
    closingTime: '23:00',
    rating: 4.2,
    features: ['Surveillance', 'Éclairage', 'Handicapé'],
    description: 'Parking central au cœur de Tunis.'
  },
  {
    name: 'Parking Carthage Byrsa',
    address: 'Colline de Byrsa',
    city: 'Carthage',
    zipCode: '2016',
    totalSpots: 30,
    availableSpots: 18,
    pricePerHour: 3,
    coordinates: [10.3287, 36.8522],
    openingTime: '08:00',
    closingTime: '20:00',
    rating: 4.5,
    features: ['Vue mer', 'Surveillance'],
    description: 'Proche du site archéologique de Carthage.'
  },
  {
    name: 'Parking La Marsa Corniche',
    address: 'Avenue Habib Thameur',
    city: 'La Marsa',
    zipCode: '2070',
    totalSpots: 25,
    availableSpots: 12,
    pricePerHour: 2,
    coordinates: [10.3400, 36.8800],
    isOpen24h: true,
    rating: 4.0,
    features: ['24h/24', 'Recharge électrique'],
    description: 'Parking en bord de mer à La Marsa.'
  }
];

async function upsertUser(data) {
  const existing = await User.findOne({ email: data.email }).select('+password');

  if (existing) {
    existing.name = data.name;
    existing.phone = data.phone;
    existing.role = data.role;
    existing.isActive = data.isActive !== false;
    existing.status = data.status || existing.status;

    if (data.address !== undefined) existing.address = data.address;
    if (data.siret !== undefined) existing.siret = data.siret;
    if (data.vehiclePlate !== undefined) existing.vehiclePlate = data.vehiclePlate;
    if (data.vehicleSerialNumber !== undefined) existing.vehicleSerialNumber = data.vehicleSerialNumber;
    if (data.vehicleType !== undefined) existing.vehicleType = data.vehicleType;

    // Toujours réinitialiser le mot de passe en clair (le hook pre-save le hash)
    existing.password = data.password;
    await existing.save();
    console.log(`♻️  Compte mis à jour : ${data.email} (mot de passe réinitialisé)`);
    return existing;
  }

  const user = new User(data);
  await user.save();
  console.log(`✅ Compte créé : ${data.email}`);
  return user;
}

const TEST_SPOTS = ['A01', 'A02', 'A03'];
const TEST_PARKING_NAME = 'Parking Lafayette';

async function syncParkingSpotCount(parkingId) {
  const count = await ParkingSpot.countDocuments({
    parkingId,
    isAvailable: true,
    isReserved: false,
    status: 'ACTIVE'
  });
  const total = await ParkingSpot.countDocuments({ parkingId });
  await Parking.findByIdAndUpdate(parkingId, { availableSpots: count, totalSpots: total });
  return count;
}

async function ensureSubscriptionPlans(companyId, parkingByName) {
  console.log('\n🎫 Forfaits d\'abonnement :');
  for (const demo of DEMO_SUBSCRIPTION_PLANS) {
    const parking = parkingByName[demo.parkingName];
    if (!parking) continue;

    let plan = await SubscriptionPlan.findOne({
      parkingId: parking._id,
      name: demo.name
    });

    if (!plan) {
      plan = new SubscriptionPlan({
        name: demo.name,
        description: demo.description,
        parkingId: parking._id,
        companyId,
        price: demo.price,
        durationDays: demo.durationDays,
        features: demo.features,
        isActive: true
      });
      await plan.save();
      console.log(`✅ Forfait créé : ${demo.name} (${demo.parkingName}) — ${demo.price} DT`);
    } else {
      plan.description = demo.description;
      plan.price = demo.price;
      plan.durationDays = demo.durationDays;
      plan.features = demo.features;
      plan.isActive = true;
      await plan.save();
      console.log(`♻️  Forfait mis à jour : ${demo.name} (${demo.parkingName})`);
    }
  }
}

async function ensureTestReservationSpots(parkingId) {
  await ParkingSpot.updateMany(
    { parkingId, spotNumber: { $in: TEST_SPOTS } },
    {
      $set: {
        isAvailable: true,
        isReserved: false,
        status: 'ACTIVE'
      },
      $unset: { currentReservation: '' }
    }
  );

  return syncParkingSpotCount(parkingId);
}

async function createSpotsForParking(parkingId, totalSpots) {
  const existing = await ParkingSpot.countDocuments({ parkingId });
  if (existing > 0) {
    console.log(`   ↳ ${existing} places déjà présentes`);
    const available = await ensureTestReservationSpots(parkingId);
    console.log(`   ↳ Places test ${TEST_SPOTS.join(', ')} libérées (${available} dispo au total)`);
    return existing;
  }

  const zones = ['A', 'B', 'C', 'D'];
  const spots = [];
  for (let i = 1; i <= totalSpots; i++) {
    const zone = zones[Math.floor((i - 1) / 10) % zones.length];
    const spotNumber = `${zone}${String(i).padStart(2, '0')}`;
    spots.push({
      parkingId,
      spotNumber,
      row: Math.ceil(i / 10),
      column: ((i - 1) % 10) + 1,
      level: 0,
      zone,
      type: 'STANDARD',
      isAvailable: TEST_SPOTS.includes(spotNumber) ? true : Math.random() > 0.35,
      isReserved: false,
      status: 'ACTIVE'
    });
  }

  await ParkingSpot.insertMany(spots);
  const available = await syncParkingSpotCount(parkingId);
  console.log(`   ↳ ${spots.length} places générées (${available} disponibles)`);
  return spots.length;
}

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');

    await upsertUser({
      name: 'Super Admin',
      email: 'admin@smartparking.com',
      password: 'Admin123!',
      phone: '0600000000',
      role: 'super_admin',
      isActive: true,
      status: 'approved'
    });

    const company = await upsertUser({
      name: 'Parking Indigo Corp',
      email: 'company@smartparking.com',
      password: 'Company123!',
      phone: '0611223344',
      role: 'company',
      address: '15 Avenue Habib Bourguiba, Tunis',
      siret: '12345678901234',
      status: 'approved',
      isActive: true
    });

    await upsertUser({
      name: 'Client Test',
      email: 'client@smartparking.com',
      password: 'Client123!',
      phone: '0612345678',
      role: 'client',
      vehiclePlate: 'AA123BB',
      vehicleSerialNumber: 'VF3123456789',
      vehicleType: 'car',
      preferredPaymentMethod: 'card',
      isActive: true,
      status: 'approved'
    });

    console.log('\n🅿️  Parkings de démonstration :');
    let testParking = null;
    const parkingByName = {};
    for (const demo of DEMO_PARKINGS) {
      let parking = await Parking.findOne({ name: demo.name, companyId: company._id });
      if (!parking) {
        parking = new Parking({
          name: demo.name,
          address: demo.address,
          city: demo.city,
          zipCode: demo.zipCode,
          totalSpots: demo.totalSpots,
          availableSpots: demo.availableSpots,
          pricePerHour: demo.pricePerHour,
          companyId: company._id,
          status: 'approved',
          location: { type: 'Point', coordinates: demo.coordinates },
          openingTime: demo.openingTime || '08:00',
          closingTime: demo.closingTime || '22:00',
          isOpen24h: demo.isOpen24h || false,
          rating: demo.rating || 4,
          features: demo.features || [],
          description: demo.description || '',
          contactPhone: '71234567'
        });
        await parking.save();
        console.log(`✅ Parking créé : ${demo.name}`);
      } else {
        parking.status = 'approved';
        parking.isDeleted = false;
        parking.isBlocked = false;
        await parking.save();
        console.log(`♻️  Parking existant : ${demo.name}`);
      }

      await createSpotsForParking(parking._id, demo.totalSpots);
      if (demo.name === TEST_PARKING_NAME) {
        testParking = parking;
      }
      parkingByName[demo.name] = parking;
    }

    await ensureSubscriptionPlans(company._id, parkingByName);

    if (testParking) {
      const testSpot = await ParkingSpot.findOne({
        parkingId: testParking._id,
        spotNumber: TEST_SPOTS[0]
      }).select('_id spotNumber type');

      console.log('\n========================================');
      console.log('🧪 RÉSERVATION DE TEST');
      console.log('========================================');
      console.log(`Parking  : ${TEST_PARKING_NAME}`);
      console.log(`Place    : ${TEST_SPOTS[0]} (STANDARD)`);
      if (testSpot) console.log(`Spot ID  : ${testSpot._id}`);
      console.log('Compte   : client@smartparking.com / Client123!');
      console.log('Véhicule : AA123BB');
      console.log('Étapes   : Mon espace → Parkings → Réserver → choisir place A01');
      console.log('========================================');
    }

    console.log('\n========================================');
    console.log('🎉 Seeding terminé — Comptes de test :');
    console.log('========================================');
    console.log('CLIENT  → client@smartparking.com  / Client123!');
    console.log('ADMIN   → admin@smartparking.com   / Admin123!');
    console.log('COMPANY → company@smartparking.com / Company123!');
    console.log('========================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors du seeding:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seed();
