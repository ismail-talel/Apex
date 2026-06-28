// src/services/AIService.js
const { Mistral } = require('@mistralai/mistralai');
const Parking = require('../models/Parking');
const ParkingSpot = require('../models/ParkingSpot');
const { BadRequestError } = require('../utils/errors');

// Tunisian Geocoding DB
const LOCAL_GEOCODE_DB = {
  "tunis": { lat: 36.8065, lng: 10.1815 },
  "ariana": { lat: 36.8600, lng: 10.1900 },
  "ben arous": { lat: 36.7531, lng: 10.2189 },
  "sousse": { lat: 35.8333, lng: 10.6333 },
  "sfax": { lat: 34.7406, lng: 10.7603 },
  "monastir": { lat: 35.7778, lng: 10.8264 },
  "carthage": { lat: 36.8522, lng: 10.3287 },
  "sidi bou said": { lat: 36.8700, lng: 10.3400 },
  "la marsa": { lat: 36.8800, lng: 10.3400 },
  "hammamet": { lat: 36.4000, lng: 10.6167 },
  "djerba": { lat: 33.8075, lng: 10.8458 },
  "kairouan": { lat: 35.6781, lng: 10.0964 },
  "bizerte": { lat: 37.2744, lng: 9.8739 },
  "gabes": { lat: 33.8814, lng: 10.0983 },
  "nabeul": { lat: 36.4564, lng: 10.7364 },
  "mahdia": { lat: 35.5050, lng: 11.0622 },
  "el jem": { lat: 35.2964, lng: 10.7069 },
  "dougga": { lat: 36.4233, lng: 9.2200 },
  "tozeur": { lat: 33.9197, lng: 8.1336 },
  "tabarka": { lat: 36.9544, lng: 8.7581 },
  "avenue habib bourguiba": { lat: 36.8000, lng: 10.1850 },
  "médina de tunis": { lat: 36.7984, lng: 10.1709 },
  "mosquée zitouna": { lat: 36.7972, lng: 10.1692 },
  "musée du bardo": { lat: 36.8114, lng: 10.1347 },
  "amphithéâtre d'el jem": { lat: 35.2964, lng: 10.7069 },
  "ribat de sousse": { lat: 35.8333, lng: 10.6400 },
  "aéroport tunis carthage": { lat: 36.8510, lng: 10.2272 },
  "aéroport monastir": { lat: 35.7589, lng: 10.7614 }
};

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'trouver_parking_proche',
      description: '⭐ OBLIGATOIRE pour répondre à toute question sur la recherche de parking. Utilise ce tool quand l\'utilisateur demande "où se garer", "parking près de", "stationnement", "trouver un parking", "je cherche un parking", "meilleur parking".',
      parameters: {
        type: 'object',
        properties: {
          lieu: {
            type: 'string',
            description: 'Nom du lieu en Tunisie extrait du message utilisateur (ex: Carthage, Tunis, Sidi Bou Said)'
          },
          latitude: {
            type: 'number',
            description: 'Latitude GPS si fournie par l\'utilisateur'
          },
          longitude: {
            type: 'number',
            description: 'Longitude GPS si fournie par l\'utilisateur'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'lister_parkings',
      description: '⭐ Utilise ce tool quand l\'utilisateur demande "liste des parkings", "quels sont les parkings", "plusieurs parkings", "parkings à proximité".',
      parameters: {
        type: 'object',
        properties: {
          lieu: {
            type: 'string',
            description: 'Nom du lieu en Tunisie'
          },
          limite: {
            type: 'integer',
            description: 'Nombre maximum de parkings',
            default: 5
          },
          rayon_km: {
            type: 'integer',
            description: 'Rayon de recherche en kilomètres',
            default: 5
          }
        },
        required: ['lieu']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'verifier_disponibilite',
      description: '⭐ Utilise ce tool quand l\'utilisateur demande "places disponibles", "combien de places", "y a-t-il de la place", "place libre", "disponibilité".',
      parameters: {
        type: 'object',
        properties: {
          lieu: {
            type: 'string',
            description: 'Nom du lieu où se trouve le parking'
          }
        },
        required: ['lieu']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'verifier_prix',
      description: '⭐ Utilise ce tool quand l\'utilisateur demande "prix", "tarif", "combien coûte", "c\'est combien", "tarification".',
      parameters: {
        type: 'object',
        properties: {
          lieu: {
            type: 'string',
            description: 'Nom du lieu où se trouve le parking'
          }
        },
        required: ['lieu']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'verifier_horaires',
      description: '⭐ Utilise ce tool quand l\'utilisateur demande "ouvert", "fermé", "horaire", "jusqu\'à quelle heure", "24h".',
      parameters: {
        type: 'object',
        properties: {
          lieu: {
            type: 'string',
            description: 'Nom du lieu où se trouve le parking'
          }
        },
        required: ['lieu']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'reserver_place',
      description: '⭐ Utilise ce tool quand l\'utilisateur demande "réserver", "réservation", "je veux réserver", "booker", "retenir une place".',
      parameters: {
        type: 'object',
        properties: {
          lieu: {
            type: 'string',
            description: 'Nom du lieu où se trouve le parking'
          },
          numero_place: {
            type: 'string',
            description: 'Numéro de la place à réserver (ex: A12, B05)'
          },
          duree_heures: {
            type: 'integer',
            description: 'Durée de réservation en heures',
            default: 2
          },
          nom_utilisateur: {
            type: 'string',
            description: 'Nom de l\'utilisateur'
          },
          email_utilisateur: {
            type: 'string',
            description: 'Email de l\'utilisateur'
          }
        },
        required: ['lieu']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'liberer_place',
      description: '⭐ Utilise ce tool quand l\'utilisateur demande "libérer", "annuler réservation", "je libère", "je quitte la place".',
      parameters: {
        type: 'object',
        properties: {
          lieu: {
            type: 'string',
            description: 'Nom du lieu où se trouve le parking'
          },
          numero_place: {
            type: 'string',
            description: 'Numéro de la place à libérer'
          }
        },
        required: ['lieu', 'numero_place']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'lister_villes',
      description: '⭐ Utilise ce tool quand l\'utilisateur demande "quelles villes", "lieux disponibles", "où puis-je me garer".',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'chercher_lieu',
      description: '⭐ Utilise ce tool pour vérifier si un lieu existe dans la base de données tunisienne.',
      parameters: {
        type: 'object',
        properties: {
          recherche: {
            type: 'string',
            description: 'Terme de recherche (nom de ville ou lieu)'
          }
        },
        required: ['recherche']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'lister_tous_parkings',
      description: '⭐ Liste TOUS les parkings disponibles dans la base de données (sans filtre géographique).',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  }
];

class AIService {
  constructor() {
    this.model = process.env.MISTRAL_MODEL || 'mistral-small-latest';
    this.formatModel = process.env.MISTRAL_FORMAT_MODEL || this.model;
    this.conversationHistory = new Map();
    this.sessionMeta = new Map();
    this.client = null;
    this._toolCache = null;
    this.maxHistoryMessages = parseInt(process.env.IA_MAX_HISTORY || '16', 10);
    this.sessionTtlMs = parseInt(process.env.IA_SESSION_TTL_MS || String(30 * 60 * 1000), 10);
  }

  _getClient() {
    if (!this.client) {
      const apiKey = process.env.MISTRAL_API_KEY;
      if (!apiKey) {
        throw new Error('MISTRAL_API_KEY non configurée.');
      }
      this.client = new Mistral({ apiKey });
    }
    return this.client;
  }

  getHistory(sessionId) {
    this._evictOldSessions();
    this.sessionMeta.set(sessionId, Date.now());

    if (!this.conversationHistory.has(sessionId)) {
      this.conversationHistory.set(sessionId, [
        {
          role: 'system',
          content: `Tu es "Apex Assistant", expert stationnement en Tunisie pour la plateforme Apex.
Règles: français uniquement, utilise les outils pour les données parking, ne jamais inventer.
Routing: parking proche→trouver_parking_proche, liste→lister_parkings, places→verifier_disponibilite, prix→verifier_prix, horaires→verifier_horaires, réserver→reserver_place, libérer→liberer_place, villes→lister_villes.
Distances en km, prix en DT.`
        }
      ]);
    }
    return this.conversationHistory.get(sessionId);
  }

  _evictOldSessions() {
    const now = Date.now();
    for (const [id, lastAccess] of this.sessionMeta.entries()) {
      if (now - lastAccess > this.sessionTtlMs) {
        this.conversationHistory.delete(id);
        this.sessionMeta.delete(id);
      }
    }
    if (this.conversationHistory.size > 500) {
      const oldest = [...this.sessionMeta.entries()].sort((a, b) => a[1] - b[1])[0];
      if (oldest) {
        this.conversationHistory.delete(oldest[0]);
        this.sessionMeta.delete(oldest[0]);
      }
    }
  }

  _trimHistory(history) {
    if (history.length <= this.maxHistoryMessages + 1) return history;
    return [history[0], ...history.slice(-(this.maxHistoryMessages))];
  }

  _compactToolResult(result) {
    return JSON.stringify({
      success: result.success,
      message: result.message_formatee || result.message,
      parking: result.data?.name || undefined
    });
  }

  _formatResponseData(result) {
    if (!result?.success) return result;
    const parking = result.data;
    if (parking && typeof parking === 'object' && parking.name && parking.availableSpots !== undefined) {
      return {
        bestParking: parking,
        navigationUrl: result.navigation_url || result.navigationUrl || null
      };
    }
    return result;
  }

  _getSuggestions(toolName) {
    const map = {
      trouver_parking_proche: ['Disponibilité', 'Tarifs', 'Y aller', 'Réserver'],
      lister_parkings: ['Trouver le meilleur', 'Tarifs', 'Réserver'],
      verifier_disponibilite: ['Tarifs', 'Horaires', 'Réserver'],
      verifier_prix: ['Disponibilité', 'Réserver', 'Autre parking'],
      verifier_horaires: ['Disponibilité', 'Tarifs', 'Réserver'],
      reserver_place: ['Mes réservations', 'Autre parking', 'Aide'],
      liberer_place: ['Trouver parking', 'Disponibilité', 'Aide']
    };
    return map[toolName] || ['Trouver parking', 'Disponibilité', 'Tarifs', 'Aide'];
  }

  async _getSpotCountsByParkingIds(parkingIds) {
    if (!parkingIds.length) return new Map();

    const counts = await ParkingSpot.aggregate([
      {
        $match: {
          parkingId: { $in: parkingIds },
          status: 'ACTIVE'
        }
      },
      {
        $group: {
          _id: '$parkingId',
          total: { $sum: 1 },
          available: {
            $sum: { $cond: [{ $eq: ['$isAvailable', true] }, 1, 0] }
          }
        }
      }
    ]);

    const map = new Map();
    for (const row of counts) {
      map.set(String(row._id), { total: row.total, available: row.available });
    }
    return map;
  }

  _enrichParkingWithSpots(parking, spotCounts) {
    const counts = spotCounts.get(String(parking._id)) || { total: 0, available: 0 };
    const { total, available } = counts;

    let isOpen = parking.isOpen24h || false;
    if (!isOpen && parking.openingTime && parking.closingTime) {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const [openH, openM] = parking.openingTime.split(':').map(Number);
      const [closeH, closeM] = parking.closingTime.split(':').map(Number);
      isOpen = currentTime >= (openH * 60 + openM) && currentTime <= (closeH * 60 + closeM);
    }

    return {
      id: parking._id,
      name: parking.name,
      address: parking.address,
      city: parking.city,
      distance: parking.distance,
      distanceKm: parking.distance.toFixed(2),
      isOpen,
      totalSpots: total,
      availableSpots: available,
      occupancyRate: total > 0 ? ((total - available) / total * 100).toFixed(1) : 0,
      pricePerHour: parking.pricePerHour,
      pricePerDay: parking.pricePerDay,
      location: parking.location,
      features: parking.features || []
    };
  }

  async geocodePlace(placeName) {
    if (!placeName) return null;
    const normalizedName = placeName.toLowerCase().trim();
    if (LOCAL_GEOCODE_DB[normalizedName]) {
      return LOCAL_GEOCODE_DB[normalizedName];
    }
    for (const [key, coords] of Object.entries(LOCAL_GEOCODE_DB)) {
      if (normalizedName.includes(key) || key.includes(normalizedName)) {
        return coords;
      }
    }
    return { lat: 36.8065, lng: 10.1815 }; // Tunis default
  }

  // Action: Trouver le meilleur parking proche
  async findBestParking(locationQuery, userCoordinates = null) {
    const cacheKey = `${locationQuery || 'gps'}_${userCoordinates?.lat || ''}_${userCoordinates?.lng || ''}`;
    if (this._toolCache?.has(cacheKey)) {
      return this._toolCache.get(cacheKey);
    }

    let coords = userCoordinates;
    if (!coords && locationQuery) {
      coords = await this.geocodePlace(locationQuery);
    }
    if (!coords) {
      coords = { lat: 36.8065, lng: 10.1815 };
    }

    const { lat, lng } = coords;

    const parkings = await Parking.aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          distanceField: 'distance',
          distanceMultiplier: 0.001,
          spherical: true
        }
      },
      {
        $match: {
          isDeleted: { $ne: true },
          status: 'approved'
        }
      },
      {
        $limit: 10
      }
    ]);

    if (parkings.length === 0) {
      const empty = {
        success: false,
        message: 'Aucun parking trouvé à proximité',
        searchedLocation: locationQuery || 'position actuelle'
      };
      if (this._toolCache) this._toolCache.set(cacheKey, empty);
      return empty;
    }

    const spotCounts = await this._getSpotCountsByParkingIds(parkings.map((p) => p._id));
    const parkingsWithSpots = parkings.map((p) => this._enrichParkingWithSpots(p, spotCounts));

    const availableOpen = parkingsWithSpots.filter(p => p.availableSpots > 0 && p.isOpen).sort((a, b) => a.distance - b.distance);
    const availableClosed = parkingsWithSpots.filter(p => p.availableSpots > 0 && !p.isOpen).sort((a, b) => a.distance - b.distance);
    const full = parkingsWithSpots.filter(p => p.availableSpots === 0).sort((a, b) => a.distance - b.distance);

    let bestParking = null;
    let recommendation = '';

    if (availableOpen.length > 0) {
      bestParking = availableOpen[0];
      recommendation = 'Ce parking est le plus proche, ouvert et dispose de places disponibles.';
    } else if (availableClosed.length > 0) {
      bestParking = availableClosed[0];
      recommendation = 'Ce parking a des places disponibles mais est actuellement fermé. Vérifiez les horaires.';
    } else {
      bestParking = full[0];
      recommendation = 'Tous les parkings proches sont complets. Celui-ci est le plus proche mais complet.';
    }

    const result = {
      success: true,
      searchedLocation: locationQuery || 'position actuelle',
      userPosition: { lat, lng },
      recommendation,
      bestParking: {
        id: bestParking.id,
        name: bestParking.name,
        address: bestParking.address,
        city: bestParking.city,
        distanceKm: bestParking.distanceKm,
        isOpen: bestParking.isOpen,
        totalSpots: bestParking.totalSpots,
        availableSpots: bestParking.availableSpots,
        occupancyRate: `${bestParking.occupancyRate}%`,
        pricePerHour: `${bestParking.pricePerHour} DT`,
        pricePerDay: bestParking.pricePerDay ? `${bestParking.pricePerDay} DT` : undefined,
        features: bestParking.features
      },
      alternatives: availableOpen.slice(1, 4).map(p => ({
        name: p.name,
        distanceKm: p.distanceKm,
        availableSpots: p.availableSpots
      })),
      navigationUrl: `https://www.google.com/maps/dir/${lat},${lng}/${bestParking.location.coordinates[1]},${bestParking.location.coordinates[0]}`
    };

    if (this._toolCache) this._toolCache.set(cacheKey, result);
    return result;
  }

  // Executer les outils
  async executeTool(toolName, params) {
    console.log(`🔧 [AIService] Tool execution: ${toolName}`, params);

    switch (toolName) {
      case 'trouver_parking_proche': {
        const result = await this.findBestParking(params.lieu, params.latitude && params.longitude ? { lat: params.latitude, lng: params.longitude } : null);
        if (!result.success) {
          return { success: false, message: result.message };
        }
        const p = result.bestParking;
        const icon = p.isOpen ? '🟢' : '🔴';
        const dispoText = p.availableSpots > 0 ? `${p.availableSpots}/${p.totalSpots} places disponibles` : '❌ COMPLET';
        return {
          success: true,
          data: p,
          message_formatee: `${icon} **${p.name}**\n📍 ${p.distanceKm} km | 💰 ${p.pricePerHour} | 🅿️ ${dispoText}\n${p.isOpen ? '✅ Ouvert' : '⏰ Fermé'}\n\n🎯 ${result.recommendation}`,
          navigation_url: result.navigationUrl
        };
      }

      case 'lister_tous_parkings': {
        const all = await Parking.find({ isDeleted: { $ne: true }, status: 'approved' })
          .select('name city pricePerHour address')
          .lean();
        const slim = all.map((p) => ({
          name: p.name,
          city: p.city,
          pricePerHour: p.pricePerHour,
          address: p.address
        }));
        return {
          success: true,
          data: slim,
          message_formatee: `📋 **${all.length} parking(s)** disponible(s) en Tunisie.\n\n${slim.slice(0, 5).map(p => `• **${p.name}** - ${p.city} (${p.pricePerHour} DT/h)`).join('\n')}${all.length > 5 ? `\n\nEt ${all.length - 5} autre(s)...` : ''}`
        };
      }

      case 'lister_parkings': {
        const locationQuery = params.lieu;
        const radius = params.rayon_km || 5;
        const coords = await this.geocodePlace(locationQuery);
        
        const parkings = await Parking.aggregate([
          {
            $geoNear: {
              near: {
                type: 'Point',
                coordinates: [parseFloat(coords.lng), parseFloat(coords.lat)]
              },
              distanceField: 'distance',
              distanceMultiplier: 0.001,
              spherical: true,
              maxDistance: radius * 1000
            }
          },
          {
            $match: {
              isDeleted: { $ne: true },
              status: 'approved'
            }
          }
        ]);

        const spotCounts = await this._getSpotCountsByParkingIds(parkings.map((p) => p._id));
        const parkingsList = parkings.map((p) => {
          const counts = spotCounts.get(String(p._id)) || { total: 0, available: 0 };
          return {
            name: p.name,
            distanceKm: p.distance.toFixed(2),
            pricePerHour: p.pricePerHour,
            availableSpots: counts.available,
            totalSpots: counts.total,
            hasAvailableSpots: counts.available > 0
          };
        });

        parkingsList.sort((a, b) => (a.hasAvailableSpots === b.hasAvailableSpots) ? 0 : a.hasAvailableSpots ? -1 : 1);

        return {
          success: true,
          data: parkingsList,
          message_formatee: `📍 **Parkings à ${locationQuery}**\n\n${parkingsList.slice(0, params.limite || 5).map((p, i) => {
            const icon = p.hasAvailableSpots ? '✅' : '🔴';
            return `${i+1}. **${p.name}** - ${p.distanceKm} km\n   ${icon} ${p.availableSpots}/${p.totalSpots} places | ${p.pricePerHour} DT/h`;
          }).join('\n\n')}`
        };
      }

      case 'verifier_disponibilite': {
        const result = await this.findBestParking(params.lieu);
        if (!result.success) return { success: false, message: `Aucun parking trouvé à "${params.lieu}"` };
        const p = result.bestParking;
        const emoji = p.availableSpots === 0 ? '🔴' : p.availableSpots < 10 ? '🟡' : '🟢';
        const statusText = p.availableSpots === 0 ? '❌ COMPLET' : p.availableSpots < 10 ? '⚠️ Plus que quelques places !' : '✅ Des places disponibles';
        return {
          success: true,
          data: p,
          message_formatee: `📊 **${p.name}**\n\n${emoji} **${p.availableSpots}/${p.totalSpots} places disponibles**\n📈 Taux d'occupation: ${p.occupancyRate}\n\n${statusText}`
        };
      }

      case 'verifier_prix': {
        const result = await this.findBestParking(params.lieu);
        if (!result.success) return { success: false, message: `Aucun parking trouvé à "${params.lieu}"` };
        const p = result.bestParking;
        let reply = `💰 **Tarifs - ${p.name}**\n\n⏱️ À l'heure: ${p.pricePerHour}`;
        if (p.pricePerDay) reply += `\n📅 Journée (24h): ${p.pricePerDay} DT`;
        return {
          success: true,
          data: p,
          message_formatee: reply
        };
      }

      case 'verifier_horaires': {
        const result = await this.findBestParking(params.lieu);
        if (!result.success) return { success: false, message: `Aucun parking trouvé à "${params.lieu}"` };
        const p = result.bestParking;
        return {
          success: true,
          data: p,
          message_formatee: `⏰ **${p.name}**\n\n${p.isOpen ? '🟢 Ouvert actuellement' : '🔴 Fermé actuellement'}\n📅 ${p.isOpen ? 'Venez vous garer !' : 'Rouvrira aux horaires habituels'}`
        };
      }

      case 'reserver_place': {
        const result = await this.findBestParking(params.lieu);
        if (!result.success) return { success: false, message: `Parking non trouvé à "${params.lieu}"` };
        const parking = await Parking.findById(result.bestParking.id);
        const num = params.numero_place || 'A01';
        const hours = params.duree_heures || 2;

        const spot = await ParkingSpot.findOne({
          parkingId: parking._id,
          spotNumber: num.toUpperCase()
        });

        if (!spot) {
          return { success: false, message: `La place ${num} n'existe pas dans le parking ${parking.name}` };
        }
        if (!spot.isAvailable) {
          return { success: false, message: `La place ${num} est ${spot.isReserved ? 'déjà réservée' : 'occupée'}` };
        }

        const until = new Date();
        until.setHours(until.getHours() + hours);

        spot.isAvailable = false;
        spot.isReserved = true;
        spot.currentReservation = {
          bookingId: `BK_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          userId: params.user_id && params.user_id !== 'anonymous' ? params.user_id : undefined,
          userName: params.nom_utilisateur || 'Client',
          userEmail: params.email_utilisateur || 'client@email.com',
          vehiclePlate: 'À renseigner',
          reservedUntil: until,
          startTime: new Date(),
          endTime: until
        };
        await spot.save();

        // Mettre à jour availableSpots sur Parking
        const count = await ParkingSpot.countDocuments({ parkingId: parking._id, isAvailable: true, status: 'ACTIVE' });
        parking.availableSpots = count;
        await parking.save();

        return {
          success: true,
          data: spot,
          message_formatee: `✅ **Réservation confirmée !**\n\n🅿️ **Parking:** ${parking.name}\n🔢 **Place:** ${num}\n⏱️ **Durée:** ${hours} heure(s)\n⏰ **Valable jusqu'à:** ${until.toLocaleTimeString('fr-FR')}\n\n💡 Arrivez 5 minutes avant la fin.`
        };
      }

      case 'liberer_place': {
        const result = await this.findBestParking(params.lieu);
        if (!result.success) return { success: false, message: `Parking non trouvé à "${params.lieu}"` };
        const parking = await Parking.findById(result.bestParking.id);
        const num = params.numero_place;

        const spot = await ParkingSpot.findOne({
          parkingId: parking._id,
          spotNumber: num.toUpperCase()
        });

        if (!spot) return { success: false, message: `Place ${num} non trouvée` };
        if (!spot.isReserved) return { success: false, message: `La place ${num} n'est pas réservée` };

        if (spot.currentReservation && spot.currentReservation.bookingId) {
          spot.reservationsHistory.push({
            bookingId: spot.currentReservation.bookingId,
            userId: spot.currentReservation.userId,
            userName: spot.currentReservation.userName,
            userEmail: spot.currentReservation.userEmail,
            vehiclePlate: spot.currentReservation.vehiclePlate,
            startTime: spot.currentReservation.startTime,
            endTime: new Date(),
            status: 'COMPLETED'
          });
        }

        spot.isAvailable = true;
        spot.isReserved = false;
        spot.currentReservation = undefined;
        await spot.save();

        // Mettre à jour availableSpots
        const count = await ParkingSpot.countDocuments({ parkingId: parking._id, isAvailable: true, status: 'ACTIVE' });
        parking.availableSpots = count;
        await parking.save();

        return {
          success: true,
          data: spot,
          message_formatee: `✅ Place **${num}** libérée avec succès !\n\nMerci d'avoir utilisé notre service. 🚗`
        };
      }

      case 'lister_villes': {
        const villes = Object.keys(LOCAL_GEOCODE_DB).filter(k => !k.includes(' ')).slice(0, 50);
        return {
          success: true,
          data: villes,
          message_formatee: `🏙️ **Villes supportées en Tunisie:**\n${villes.map(v => `• ${v.charAt(0).toUpperCase() + v.slice(1)}`).join('\n')}\n\n${villes.length} villes disponibles.`
        };
      }

      case 'chercher_lieu': {
        const query = params.recherche.toLowerCase();
        const found = Object.keys(LOCAL_GEOCODE_DB).filter(name => name.toLowerCase().includes(query)).slice(0, 20);
        if (found.length === 0) return { success: false, message: `Aucun lieu trouvé pour "${params.recherche}"` };
        return {
          success: true,
          data: found,
          message_formatee: `🔍 **Résultats pour "${params.recherche}":**\n${found.map(f => `• ${f}`).join('\n')}`
        };
      }

      default:
        return { success: false, message: `Outil "${toolName}" non reconnu` };
    }
  }

  async chat(message, userId = 'anonymous', options = {}) {
    this._toolCache = new Map();
    try {
      const history = this.getHistory(userId);
      history.push({ role: 'user', content: message });

      const client = this._getClient();
      const trimmedHistory = this._trimHistory(history);
      const response = await client.chat.complete({
        model: this.model,
        messages: trimmedHistory,
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.2,
        max_tokens: 600
      });

      const assistantMessage = response?.choices?.[0]?.message;
      history.push(assistantMessage);

      const toolCalls = assistantMessage?.tool_calls || assistantMessage?.toolCalls || [];

      if (toolCalls && toolCalls.length > 0) {
        const parsedResults = [];
        const toolResults = [];
        for (const toolCall of toolCalls) {
          let parameters = {};
          try {
            parameters = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
          } catch (e) {
            console.warn('⚠️ Error parsing tool call arguments');
          }

          if (userId && userId !== 'anonymous') parameters.user_id = userId;
          if (options.userName) parameters.nom_utilisateur = options.userName;
          if (options.userEmail) parameters.email_utilisateur = options.userEmail;
          if (options.coordinates) {
            parameters.latitude = options.coordinates.lat;
            parameters.longitude = options.coordinates.lng;
          }

          const result = await this.executeTool(toolCall.function.name, parameters);
          parsedResults.push(result);
          toolResults.push({
            role: 'tool',
            name: toolCall.function.name,
            toolCallId: toolCall.id,
            content: this._compactToolResult(result)
          });
        }

        history.push(...toolResults);

        const primaryResult = parsedResults[0];
        const primaryTool = toolCalls[0]?.function?.name;

        if (primaryResult?.message_formatee) {
          const replyText = primaryResult.message_formatee;
          history.push({ role: 'assistant', content: replyText });
          return {
            success: true,
            reply: replyText,
            suggestions: this._getSuggestions(primaryTool),
            data: this._formatResponseData(primaryResult),
            actionsExecuted: toolCalls.map(tc => tc.function.name)
          };
        }

        const finalResponse = await client.chat.complete({
          model: this.formatModel,
          messages: this._trimHistory(history),
          temperature: 0.4,
          max_tokens: 600
        });

        const finalMessage = finalResponse.choices[0].message;
        history.push(finalMessage);

        return {
          success: true,
          reply: finalMessage.content,
          suggestions: this._getSuggestions(primaryTool),
          data: this._formatResponseData(primaryResult),
          actionsExecuted: toolCalls.map(tc => tc.function.name)
        };
      }

      return {
        success: true,
        reply: assistantMessage.content || "Veuillez préciser votre demande (ex: 'Où se garer près de Tunis ?')",
        suggestions: ['Trouver parking', 'Disponibilité', 'Tarifs', 'Aide'],
        data: null,
        actionsExecuted: []
      };

    } catch (error) {
      console.error('❌ AIService Chat Error:', error);
      let errorReply = '❌ Une erreur est survenue. Veuillez réessayer.';
      if (error.message.includes('API key')) {
        errorReply = '❌ Erreur de configuration de l\'IA.';
      } else if (error.message.includes('rate limit')) {
        errorReply = '⚠️ Le service est temporairement saturé. Veuillez réessayer.';
      }

      return {
        success: false,
        reply: errorReply,
        error: error.message
      };
    } finally {
      this._toolCache = null;
    }
  }

  async healthCheck() {
    const mistralConfigured = !!process.env.MISTRAL_API_KEY;
    return {
      status: 'OK',
      service: 'Mistral Parking Agent',
      version: '2.1.0',
      mistralConfigured,
      model: this.model,
      formatModel: this.formatModel,
      locationsCount: Object.keys(LOCAL_GEOCODE_DB).length,
      activeSessions: this.conversationHistory.size,
      timestamp: new Date().toISOString()
    };
  }

  async getLocations(search, limit = 50) {
    let locations = Object.entries(LOCAL_GEOCODE_DB).map(([name, coords]) => ({
      name,
      lat: coords.lat,
      lng: coords.lng
    }));

    if (search) {
      const searchLower = search.toLowerCase();
      locations = locations.filter(loc => loc.name.toLowerCase().includes(searchLower));
    }

    return locations.slice(0, parseInt(limit));
  }
}

module.exports = new AIService();
