# 🅿️ Apex — Smart Parking Ecosystem

**Apex** est une plateforme web tout-en-un pour la gestion intelligente des parkings urbains et privés. Elle connecte **quatre acteurs clés** — clients, entreprises exploitantes, employés terrain et administrateurs — au sein d'un écosystème fluide, sécurisé et scalable.


Fonctionnalités principales
Module	Description
🗺️ Carte interactive	Visualisation en temps réel des parkings et des places disponibles (Leaflet + Socket.IO)
📅 Réservation avancée	Réservation de places avec paiement sécurisé via Konnect (CB / wallet)
📦 Gestion des abonnements	Forfaits personnalisables pour les entreprises et leurs clients
👥 Espace multi-rôles	Interfaces distinctes pour client, entreprise, employé et administrateur
🧾 Réclamations & escalade	Workflow complet de gestion des tickets avec niveaux de priorité
🤖 Assistant IA	Intégration de Mistral pour la recherche contextuelle et l'assistance utilisateur
🔐 Contrôle d'accès QR	Génération et validation de QR codes pour check-in / check-out sécurisé
🔑 Passkeys (WebAuthn)	Connexion par empreinte digitale, Face ID ou PIN via Windows Hello — sans mot de passe
😊 Reconnaissance faciale	Connexion par webcam via Amazon Rekognition (ou mode MOCK en développement)
🔒 Authentification multi-niveaux
Redeam propose trois modes de connexion complémentaires, tous basés sur un JWT unifié.
L'utilisateur peut choisir la méthode qui lui convient le mieux, en fonction de son équipement et de ses préférences de sécurité.

Mode	Technologie	Configuration	Usage
Mot de passe	Email + bcrypt + JWT	Inscription / compte test	Connexion classique
Passkey	WebAuthn (@simplewebauthn)	Profil → Sécurité avancée	Empreinte / Face ID PC / PIN
Visage	Amazon Rekognition + webcam	Profil → Enregistrer mon visage	Connexion par selfie
🔑 Passkey (WebAuthn)
Enregistrement : depuis Mon Profil → Sécurité avancée.

La clé privée reste sur l'appareil de l'utilisateur ; seule la clé publique est stockée en base de données.

Connexion : via l'onglet Passkey sur la page d'authentification.

😊 Reconnaissance faciale (Rekognition)
Mode production : AWS Rekognition (IndexFaces, SearchFacesByImage).

Mode développement (MOCK) : comparaison locale via sharp — activé automatiquement en l'absence de clés AWS.

Détection d'un seul visage ; seuil de correspondance configurable (FACE_MATCH_THRESHOLD).
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
