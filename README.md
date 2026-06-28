# 🅿️ Apex — Smart Parking Ecosystem

**Apex** est une plateforme web tout-en-un pour la gestion intelligente des parkings urbains et privés. Elle connecte **quatre acteurs clés** — clients, entreprises exploitantes, employés terrain et administrateurs — au sein d'un écosystème fluide, sécurisé et scalable.


## 📌 Fonctionnalités principales

| Module | Description |
|--------|-------------|
| 🗺️ **Carte interactive** | Visualisation en temps réel des parkings et des places disponibles (Leaflet + Socket.IO) |
| 📅 **Réservation avancée** | Réservation de places avec paiement sécurisé via **Konnect** (CB / wallet) |
| 📦 **Gestion des abonnements** | Forfaits personnalisables pour les entreprises et leurs employés |
| 👥 **Espace multi-rôles** | Interfaces distinctes pour client, entreprise, employé et administrateur |
| 🧾 **Réclamations & escalade** | Workflow complet de gestion des tickets avec niveaux de priorité |
| 🤖 **Assistant IA** | Intégration de **Mistral** pour la recherche contextuelle et l'assistance utilisateur |
| 🔐 **Contrôle d'accès** | Génération et validation de QR codes pour check-in / check-out sécurisé |

---

## 🛠️ Stack technique

| Couche | Technologies |
|--------|---------------|
| **Frontend** | Angular • TypeScript • Leaflet • Socket.IO Client • Bootstrap |
| **Backend** | Node.js • Express • MongoDB • Mongoose • JWT • Socket.IO Server |
| **Paiement** | Konnect (passerelle de paiement tunisienne certifiée) |
| **Intelligence Artificielle** | Mistral API (function calling) |
| **Infrastructure** | Environnement scalable (prêt pour Docker / cloud) |

---

## 🚀 Démarrage rapide

### Prérequis
- Node.js (v16+)
- MongoDB
- Angular CLI
- 
### Installation

```bash
# 1. Cloner le projet
git clone https://github.com/ismail-talel/Apex.git
cd Apex

# 2. Backend
cd backend
npm install
npm run seed        # Peuplement initial de la base de données
npm start

# 3. Frontend (dans un nouveau terminal)
cd frontend
npm install
ng serve
