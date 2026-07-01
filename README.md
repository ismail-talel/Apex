# 🅿️ Apex — Smart Parking Ecosystem

**Apex** est une plateforme web tout-en-un pour la gestion intelligente des parkings urbains et privés. Elle connecte **quatre acteurs clés** — clients, entreprises exploitantes, employés terrain et administrateurs — au sein d'un écosystème fluide, sécurisé et scalable.

---

## 📌 Fonctionnalités principales

| Module | Description |
|--------|-------------|
| 🗺️ **Carte interactive** | Visualisation en temps réel des parkings et des places disponibles (Leaflet + Socket.IO) |
| 📅 **Réservation avancée** | Réservation de places avec paiement sécurisé via **Konnect** (CB / wallet) |
| 📦 **Gestion des abonnements** | Forfaits personnalisables pour les entreprises et leurs clients |
| 👥 **Espace multi-rôles** | Interfaces distinctes pour client, entreprise, employé et administrateur |
| 🧾 **Réclamations & escalade** | Workflow complet de gestion des tickets avec niveaux de priorité |
| 🤖 **Assistant IA** | Intégration de **Mistral** pour la recherche contextuelle et l'assistance utilisateur |
| 🔐 **Contrôle d'accès QR** | Génération et validation de QR codes pour check-in / check-out sécurisé |
| 🔑 **Passkeys (WebAuthn)** | Connexion par empreinte digitale, Face ID ou PIN via **Windows Hello** — sans mot de passe |
| 😊 **Reconnaissance faciale** | Connexion par webcam via **Amazon Rekognition** (ou mode MOCK en développement) |

---

## 🔒 Authentification multi-niveaux

Apex propose **trois modes de connexion** complémentaires, tous basés sur un **JWT** unifié :

| Mode | Technologie | Configuration | Usage |
|------|-------------|---------------|-------|
| **Mot de passe** | Email + bcrypt + JWT | Inscription / compte test | Connexion classique |
| **Passkey** | WebAuthn (`@simplewebauthn`) | Profil → Sécurité avancée | Empreinte / Face ID PC / PIN |
| **Visage** | Amazon Rekognition + webcam | Profil → Enregistrer mon visage | Connexion par selfie |

### Passkey (WebAuthn)
- Enregistrement depuis **Mon Profil → Sécurité avancée**
- La clé privée reste sur l'appareil ; seule la clé publique est stockée en base
- Connexion via l'onglet **Passkey** sur la page d'authentification

### Reconnaissance faciale (Rekognition)
- **Mode production** : AWS Rekognition (`IndexFaces`, `SearchFacesByImage`)
- **Mode développement (MOCK)** : comparaison locale via `sharp` — activé automatiquement sans clés AWS
- Détection d'un seul visage, seuil de correspondance configurable (`FACE_MATCH_THRESHOLD`)

---

## 🛠️ Stack technique

| Couche | Technologies |
|--------|---------------|
| **Frontend** | Angular 18 • TypeScript • Leaflet • Socket.IO Client • `@simplewebauthn/browser` |
| **Backend** | Node.js • Express 5 • MongoDB • Mongoose • JWT • Socket.IO |
| **Authentification** | bcryptjs • WebAuthn (`@simplewebauthn/server`) • Amazon Rekognition (`@aws-sdk/client-rekognition`) • `sharp` (mode MOCK) |
| **Paiement** | Konnect (passerelle de paiement tunisienne certifiée) |
| **Intelligence Artificielle** | Mistral API |
| **Infrastructure** | Environnement scalable (prêt pour Docker / cloud) |

---

## 🚀 Démarrage rapide

### Prérequis
- Node.js (v18+)
- MongoDB (local ou Atlas)
- Angular CLI (optionnel, inclus via `npx`)

### Installation

```bash
# 1. Cloner le projet
git clone https://github.com/ismail-talel/Apex.git
cd Apex

# 2. Configurer l'environnement backend
cd "Apex parking/backend"
copy .env.example .env        # Windows
# cp .env.example .env        # Linux / macOS
# Éditer .env avec vos clés (JWT, Mistral, AWS optionnel)

# 3. Backend
npm install
npm run seed                  # Comptes de test + parkings de démonstration
npm start                     # API sur http://localhost:5000

# 4. Frontend (nouveau terminal)
cd "../frontend"
npm install
npm start                     # App sur http://localhost:4201
```

### Comptes de test (après `npm run seed`)

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Client | `client@smartparking.com` | `Client123!` |
| Admin | `admin@smartparking.com` | `Admin123!` |
| Entreprise | `company@smartparking.com` | `Company123!` |

---

## ⚙️ Configuration

### Variables d'environnement essentielles (`Apex parking/backend/.env`)

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/smart_parking_db
JWT_SECRET=votre_secret_jwt
FRONTEND_URL=http://localhost:4201

# WebAuthn (Passkeys)
WEBAUTHN_RP_NAME=Apex Parking
WEBAUTHN_RP_ID=localhost
WEBAUTHN_ORIGIN=http://localhost:4201

# Amazon Rekognition (optionnel — mode MOCK si absent)
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
REKOGNITION_COLLECTION_ID=apex-users-faces
FACE_MATCH_THRESHOLD=90
MOCK_FACE_MATCH_THRESHOLD=40
```

> ⚠️ Ne jamais committer le fichier `.env` (déjà ignoré via `.gitignore`).

---

## 📡 API d'authentification avancée

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| `POST` | `/api/auth/login` | — | Connexion email / mot de passe |
| `POST` | `/api/auth/webauthn/login/options` | — | Options de connexion passkey |
| `POST` | `/api/auth/webauthn/login/verify` | — | Vérification passkey → JWT |
| `POST` | `/api/auth/webauthn/register/options` | JWT | Options d'enregistrement passkey |
| `POST` | `/api/auth/webauthn/register/verify` | JWT | Enregistrement passkey |
| `POST` | `/api/face-auth/enroll` | JWT | Enregistrer un visage |
| `POST` | `/api/face-auth/verify` | — | Connexion par visage → JWT |
| `GET` | `/api/face-auth/status` | — | État MOCK / AWS |

---

## 🧪 Tester les nouvelles fonctionnalités

### Passkey
1. Connexion classique → **Mon Profil → Sécurité avancée → Configurer une passkey**
2. Valider avec Windows Hello
3. Déconnexion → onglet **Passkey** → saisir l'email → connexion biométrique

### Reconnaissance faciale
1. Connexion classique → **Mon Profil → Activer la caméra → Enregistrer mon visage**
2. Déconnexion → onglet **Visage** → connexion par webcam
3. En mode MOCK : même éclairage et position qu'à l'enregistrement

---

## 📁 Structure du projet

```
Apex/
├── README.md
├── .gitignore
└── Apex parking/
    ├── backend/          # API Node.js / Express
    │   ├── server.js
    │   └── src/
    │       ├── routes/       # auth, webauthn, face-auth, parking...
    │       ├── services/     # AuthService, WebAuthnService, RekognitionService...
    │       └── models/       # User, WebAuthnCredential, Parking...
    └── frontend/         # Application Angular 18
        └── src/app/
            ├── features/     # auth, client, admin, company, employee
            └── core/services/  # auth, webauthn, face-auth...
```

---

## 👤 Rôles utilisateurs

| Rôle | Accès |
|------|-------|
| **Client** | Carte, réservations, abonnements, réclamations, profil & sécurité (passkey / visage) |
| **Entreprise** | Gestion des parkings, employés, abonnements, revenus |
| **Employé** | Scanner QR, validation des réservations sur le terrain |
| **Super Admin** | Approbation des entreprises, supervision globale |

---

## 📄 Licence

Projet académique / démonstration — Apex Smart Parking Ecosystem.
