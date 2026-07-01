# 🅿️ APEX — Écosystème de stationnement intelligent

**APEX** est une solution SaaS modulaire et sécurisée, dédiée à la gestion optimisée des parkings urbains et privés. La plateforme orchestre une collaboration transparente entre **quatre acteurs majeurs** (clients, entreprises exploitantes, agents de terrain et administrateurs) au sein d'une infrastructure scalable, temps réel et hautement personnalisable.

---

## 📋 Fonctionnalités stratégiques

| Module | Description fonctionnelle |
|--------|---------------------------|
| 🗺️ **Cartographie dynamique** | Visualisation en temps réel de l'occupation des parkings via **Leaflet** et **Socket.IO** (mise à jour push instantanée). |
| 📅 **Réservation & paiement** | Prise de réservation sécurisée intégrant la passerelle **Konnect** (paiement par CB ou wallet mobile). |
| 📦 **Gestion des abonnements** | Offres modulables destinées aux entreprises et à leurs collaborateurs (forfaits, quotas, renouvellements). |
| 👥 **Espace multi-profils** | Interfaces différenciées et adaptées aux usages : Client, Exploitant, Employé terrain, Administrateur. |
| 🧾 **Gestion des réclamations** | Workflow complet de ticketing avec niveaux de priorité, affectation automatique et suivi d'escalade. |
| 🤖 **Assistant intelligent** | Intégration de l'API **Mistral** (function calling) pour une assistance contextuelle et une recherche sémantique. |
| 🔐 **Contrôle d'accès QR** | Génération et scan de QR codes pour les opérations de check-in / check-out, garantissant une traçabilité rigoureuse. |
| 🔑 **Passkeys (WebAuthn)** | Connexion sans mot de passe via empreinte digitale, Face ID ou PIN (Windows Hello). |
| 😊 **Reconnaissance faciale** | Authentification biométrique par webcam via **Amazon Rekognition** en production (mode MOCK en développement). |

---

## 🔒 Politique d'authentification multi-niveaux

Apex unifie l'ensemble de ses méthodes d'authentification autour d'un **JWT unique**. L'utilisateur final bénéficie d'une liberté de choix selon son équipement et ses exigences de sécurité :

| Mode | Technologie | Paramétrage | Cas d'usage |
|------|-------------|-------------|-------------|
| **Mot de passe** | Email + bcrypt + JWT | Dès l'inscription / compte de test | Authentification standard |
| **Passkey (WebAuthn)** | `@simplewebauthn` | Mon Profil → Sécurité avancée | Connexion biométrique sans mot de passe (PC / mobile) |
| **Reconnaissance faciale** | Amazon Rekognition + Webcam | Mon Profil → Enregistrer mon visage | Connexion rapide par selfie |

### 🔑 Détails techniques — Passkey

- L'enregistrement s'effectue depuis l'espace **Sécurité avancée** du profil utilisateur.
- La clé privée reste exclusivement stockée sur le dispositif de l'utilisateur ; seule la clé publique est conservée en base de données.
- La connexion s'effectue via l'onglet dédié sur la page d'authentification.

### 😊 Détails techniques — Reconnaissance faciale

- **Production** : services `IndexFaces` et `SearchFacesByImage` d'AWS Rekognition.
- **Développement (MOCK)** : comparaison locale via `sharp` (activation automatique en l'absence de clés AWS).
- Détection limitée à un unique visage ; seuil de similarité ajustable via `FACE_MATCH_THRESHOLD`.

---

## 🛠️ Architecture technique

| Couche | Stack utilisée |
|--------|----------------|
| **Frontend** | Angular 18 • TypeScript • Leaflet • Socket.IO Client • Bootstrap |
| **Backend** | Node.js • Express 5 • MongoDB • Mongoose • JWT • Socket.IO Server |
| **Authentification** | bcryptjs • WebAuthn • Amazon Rekognition • sharp (mode MOCK) |
| **Paiement** | Konnect (passerelle de paiement certifiée pour la Tunisie) |
| **IA / LLM** | Mistral API (function calling pour l'assistance contextuelle) |
| **Infrastructure** | Architecture prête pour le déploiement cloud (Docker compatible, scalable) |

---

## 🚀 Guide de démarrage rapide

### Prérequis

- **Node.js** (version 18 ou supérieure)
- **MongoDB** (instance locale ou distante / Atlas)
- **Angular CLI** (optionnel — inclus via `npx` ou `npm start`)

### Procédure d'installation

```bash
# 1. Récupérer le projet
git clone https://github.com/ismail-talel/Apex.git
cd Apex

# 2. Configurer l'environnement backend
cd "Apex parking/backend"
copy .env.example .env        # Windows
# cp .env.example .env        # Linux / macOS

# 3. Installer et lancer le backend
npm install
npm run seed        # Peuplement initial de la base de données
npm start           # API sur http://localhost:5000

# 4. Installer et lancer le frontend (dans un nouveau terminal)
cd "../frontend"
npm install
npm start           # App sur http://localhost:4201
# ou : npx ng serve --configuration development --host localhost
