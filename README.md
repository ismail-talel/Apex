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

📊 Acteurs et cas d'usage
Acteur	Bénéfice principal
Client	Trouver, réserver et payer une place en moins de 2 minutes
Entreprise	Gérer les abonnements de ses employés et suivre l'occupation
Employé terrain	Contrôler les accès et gérer les litiges sur le terrain
Administrateur	Superviser l'activité, analyser les KPIs et modérer les réclamations

Perspectives d'évolution:
📱 Application mobile (React Native / Flutter)

📡 Intégration avec des capteurs IoT pour la détection réelle d'occupation

📈 Module BI avancé avec tableaux de bord personnalisables

🌍 Extension multi-villes et multi-pays

👤 Auteur
Ismail Talel
Développeur Full Stack

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
