// app.js - Logique SPA & Appels API Premium pour Smart Parking

const API_BASE = '/api';

// État global de l'application
let currentUser = null;
let token = null;
let mockEmailsInterval = null;
let selectedParkingForSpots = null;
let selectedParkingForEmployee = null;

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  // Récupérer le token et l'utilisateur dans le stockage local
  token = localStorage.getItem('sp_token');
  
  // Masquer le loader
  const loader = document.getElementById('loader');
  if (loader) {
    setTimeout(() => {
      loader.classList.add('fade-out');
    }, 600);
  }

  // Configurer les écouteurs d'événements principaux
  setupEventListeners();

  // Démarrer la boîte de réception simulée en tâche de fond (polling toutes les 3s)
  fetchMockEmails();
  mockEmailsInterval = setInterval(fetchMockEmails, 3000);

  // Vérifier la session active
  if (token) {
    validateSession();
  } else {
    showAuthSection();
  }
});

// Écouteurs d'événements
function setupEventListeners() {
  // Navigation
  document.getElementById('btn-nav-dashboard').addEventListener('click', () => switchSection('dashboard'));
  document.getElementById('btn-nav-profile').addEventListener('click', () => switchSection('profile'));
  document.getElementById('btn-logout').addEventListener('click', logout);

  // Formulaires Authentification
  document.getElementById('form-login').addEventListener('submit', handleLogin);
  document.getElementById('form-register').addEventListener('submit', handleRegister);

  // Formulaires Tableaux de bord
  document.getElementById('form-request-parking').addEventListener('submit', handleRequestParking);
  document.getElementById('form-add-spot').addEventListener('submit', handleAddSpot);
  document.getElementById('form-create-employee').addEventListener('submit', handleCreateEmployee);
  document.getElementById('form-client-vehicle').addEventListener('submit', handleSaveVehicle);

  // Profil
  document.getElementById('form-profile-info').addEventListener('submit', handleUpdateProfile);
  document.getElementById('form-profile-password').addEventListener('submit', handleResetPasswordFromProfile);
}

// ==========================================
// SYSTÈME DE TOASTS (Notifications)
// ==========================================
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-xmark';
  if (type === 'info') icon = 'fa-circle-info';

  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);

  // Animation de sortie
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 4000);
}

// ==========================================
// ROTATION DES SECTIONS & DASHBOARDS
// ==========================================
function switchSection(sectionId) {
  const sections = ['sec-auth', 'sec-dashboard', 'sec-profile'];
  sections.forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });

  const activeNavItems = document.querySelectorAll('.nav-item');
  activeNavItems.forEach(item => item.classList.remove('active'));

  if (sectionId === 'auth') {
    document.getElementById('main-header').classList.add('hidden');
    document.getElementById('sec-auth').classList.remove('hidden');
  } else if (sectionId === 'dashboard') {
    document.getElementById('main-header').classList.remove('hidden');
    document.getElementById('sec-dashboard').classList.remove('hidden');
    document.getElementById('btn-nav-dashboard').classList.add('active');
    loadDashboardContent();
  } else if (sectionId === 'profile') {
    document.getElementById('main-header').classList.remove('hidden');
    document.getElementById('sec-profile').classList.remove('hidden');
    document.getElementById('btn-nav-profile').classList.add('active');
    loadProfileContent();
  }
}

function showAuthSection() {
  switchSection('auth');
  switchAuthTab('login');
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('form-login');
  const registerForm = document.getElementById('form-register');
  const loginTab = document.getElementById('tab-login');
  const registerTab = document.getElementById('tab-register');
  const forgotPwdPanel = document.getElementById('forgot-password-panel');
  const resetPwdPanel = document.getElementById('reset-password-panel');

  forgotPwdPanel.classList.add('hidden');
  resetPwdPanel.classList.add('hidden');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    document.getElementById('auth-subtitle').textContent = "Connectez-vous à votre espace de gestion";
  } else {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    loginTab.classList.remove('active');
    registerTab.classList.add('active');
    document.getElementById('auth-subtitle').textContent = "Inscrivez votre entreprise sur Smart Parking";
  }
}

// ==========================================
// GESTION DU PROFIL
// ==========================================
function loadProfileContent() {
  if (!currentUser) return;
  document.getElementById('profile-name').value = currentUser.name || '';
  document.getElementById('profile-phone').value = currentUser.phone || '';
}

async function handleUpdateProfile(e) {
  e.preventDefault();
  const name = document.getElementById('profile-name').value;
  const phone = document.getElementById('profile-phone').value;

  try {
    const res = await fetch(`${API_BASE}/users/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, phone })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erreur lors de la mise à jour.');

    currentUser = data.user;
    updateUserHeader();
    showToast('Profil mis à jour avec succès !');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleResetPasswordFromProfile(e) {
  e.preventDefault();
  const password = document.getElementById('profile-new-password').value;
  const confirm = document.getElementById('profile-confirm-password').value;

  if (password !== confirm) {
    showToast('Les mots de passe ne correspondent pas.', 'error');
    return;
  }

  try {
    // Étape 1 : Déclencher le forgot password pour obtenir le token
    const forgotRes = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentUser.email })
    });
    
    const forgotData = await forgotRes.json();
    if (!forgotRes.ok) throw new Error(forgotData.message);

    // Étape 2 : Réinitialiser avec le token nouvellement généré automatiquement
    const resetToken = forgotData.resetToken;
    const resetRes = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetToken, password })
    });

    const resetData = await resetRes.json();
    if (!resetRes.ok) throw new Error(resetData.message);

    document.getElementById('form-profile-password').reset();
    showToast('Mot de passe mis à jour avec succès !');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==========================================
// GESTION AUTHENTIFICATION (LOGIN, REGISTER, MDP OUBLIÉ)
// ==========================================
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Identifiants incorrects.');

    token = data.token;
    currentUser = data.user;
    
    localStorage.setItem('sp_token', token);
    
    updateUserHeader();
    showToast(`Ravi de vous revoir, ${currentUser.name} !`);
    switchSection('dashboard');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const phone = document.getElementById('reg-phone').value;
  const siret = document.getElementById('reg-siret').value;
  const address = document.getElementById('reg-address').value;
  const password = document.getElementById('reg-password').value;
  const confirmPassword = document.getElementById('reg-confirm-password').value;

  if (password !== confirmPassword) {
    showToast('Les mots de passe ne correspondent pas.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        phone,
        siret,
        address,
        password,
        role: 'company' // Inscription entreprise d'abord
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erreur lors de la création du compte.');

    showToast('Inscription de l\'entreprise réussie ! Votre compte est en attente d\'approbation.');
    switchAuthTab('login');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function showForgotPasswordForm(e) {
  e.preventDefault();
  document.getElementById('form-login').classList.add('hidden');
  document.getElementById('form-register').classList.add('hidden');
  document.getElementById('forgot-password-panel').classList.remove('hidden');
  document.getElementById('auth-subtitle').textContent = "Récupérer mon accès";
}

function backToLogin() {
  switchAuthTab('login');
}

async function submitForgotPassword() {
  const email = document.getElementById('forgot-email').value;
  if (!email) {
    showToast('Veuillez saisir votre email.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showToast('Token de réinitialisation généré ! Récupérez-le dans la boîte mail virtuelle en bas.');
    
    // Basculer sur l'écran de saisie du nouveau mot de passe
    document.getElementById('forgot-password-panel').classList.add('hidden');
    document.getElementById('reset-password-panel').classList.remove('hidden');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function submitResetPassword() {
  const tokenVal = document.getElementById('reset-token').value;
  const password = document.getElementById('reset-new-password').value;

  if (!tokenVal || !password) {
    showToast('Tous les champs sont requis.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenVal, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showToast('Mot de passe réinitialisé avec succès. Connectez-vous !');
    switchAuthTab('login');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function validateSession() {
  try {
    const res = await fetch(`${API_BASE}/users/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error();

    currentUser = data.user;
    updateUserHeader();
    switchSection('dashboard');
  } catch (error) {
    logout();
  }
}

function logout() {
  localStorage.removeItem('sp_token');
  token = null;
  currentUser = null;
  showAuthSection();
  showToast('Vous avez été déconnecté.', 'info');
}

function updateUserHeader() {
  if (!currentUser) return;
  document.getElementById('header-user-name').textContent = currentUser.name;
  
  // Formatage propre du rôle
  let roleLabel = currentUser.role;
  if (currentUser.role === 'super_admin') roleLabel = 'Administrateur';
  else if (currentUser.role === 'company') roleLabel = 'Compagnie';
  else if (currentUser.role === 'employee') roleLabel = 'Employé';
  else if (currentUser.role === 'customer') roleLabel = 'Client';

  document.getElementById('header-user-role').textContent = roleLabel;
  document.getElementById('header-avatar').textContent = currentUser.name.charAt(0).toUpperCase();
}

// ==========================================
// CHARGEMENT DU CONTENU DYNAMIQUE DASHBOARDS
// ==========================================
function loadDashboardContent() {
  if (!currentUser) return;

  // Cacher tous les dashboards
  const dashboards = ['super_admin', 'company', 'employee', 'customer'];
  dashboards.forEach(role => {
    document.getElementById(`dash-${role}`).classList.add('hidden');
  });

  // Afficher le dashboard correspondant
  const activeDash = document.getElementById(`dash-${currentUser.role}`);
  if (activeDash) {
    activeDash.classList.remove('hidden');
  }

  // Charger les données appropriées
  if (currentUser.role === 'super_admin') {
    loadSuperAdminDashboard();
  } else if (currentUser.role === 'company') {
    loadCompanyDashboard();
  } else if (currentUser.role === 'employee') {
    loadEmployeeDashboard();
  } else if (currentUser.role === 'customer') {
    loadCustomerDashboard();
  }
}

// ==========================================
// 1. DASHBOARD SUPER ADMIN
// ==========================================
async function loadSuperAdminDashboard() {
  try {
    // 1. Charger les entreprises en attente
    const resUsers = await fetch(`${API_BASE}/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const dataUsers = await resUsers.json();
    
    const pendingCompanies = dataUsers.users.filter(u => u.role === 'company' && u.status === 'pending');
    renderAdminCompanies(pendingCompanies);

    // 2. Charger les demandes de parking en attente
    const resParkings = await fetch(`${API_BASE}/parkings?approvalStatus=pending`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const dataParkings = await resParkings.json();
    renderAdminParkings(dataParkings.parkings);

  } catch (error) {
    showToast('Erreur lors du chargement des demandes admin.', 'error');
  }
}

function renderAdminCompanies(companies) {
  const tbody = document.querySelector('#tbl-admin-companies tbody');
  if (companies.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Aucune inscription en attente.</td></tr>`;
    return;
  }

  tbody.innerHTML = companies.map(company => `
    <tr>
      <td><strong>${company.name}</strong></td>
      <td>${company.email}</td>
      <td>${company.phone}</td>
      <td><code>${company.siret || 'N/A'}</code></td>
      <td>${new Date(company.createdAt).toLocaleDateString('fr-FR')}</td>
      <td>
        <button class="btn btn-xs btn-primary" onclick="updateCompanyStatus('${company._id}', 'approved')"><i class="fa-solid fa-check"></i> Valider</button>
        <button class="btn btn-xs btn-danger" onclick="updateCompanyStatus('${company._id}', 'rejected')"><i class="fa-solid fa-xmark"></i> Refuser</button>
      </td>
    </tr>
  `).join('');
}

async function updateCompanyStatus(companyId, status) {
  try {
    const res = await fetch(`${API_BASE}/users/${companyId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showToast(`Compte d'entreprise mis à jour avec le statut: ${status}.`);
    loadSuperAdminDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderAdminParkings(parkings) {
  const tbody = document.querySelector('#tbl-admin-parkings tbody');
  if (parkings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Aucune demande de parking en attente.</td></tr>`;
    return;
  }

  tbody.innerHTML = parkings.map(parking => `
    <tr>
      <td><strong>${parking.name}</strong><br><small class="text-muted">${parking.address}, ${parking.city}</small></td>
      <td>${parking.companyId ? parking.companyId.name : 'Inconnu'}</td>
      <td>${parking.city} (${parking.zipCode})</td>
      <td><code>${parking.totalSpots} places</code></td>
      <td>${parking.pricePerHour} € / h</td>
      <td>
        <button class="btn btn-xs btn-primary" onclick="updateParkingApproval('${parking._id}', 'approve')"><i class="fa-solid fa-check"></i> Approuver</button>
        <button class="btn btn-xs btn-danger" onclick="updateParkingApproval('${parking._id}', 'reject')"><i class="fa-solid fa-xmark"></i> Rejeter</button>
      </td>
    </tr>
  `).join('');
}

async function updateParkingApproval(parkingId, action) {
  try {
    const res = await fetch(`${API_BASE}/parkings/${parkingId}/${action}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showToast(`La demande de parking a été traitée (${action === 'approve' ? 'Approuvée' : 'Rejetée'}).`);
    loadSuperAdminDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  }
}


// ==========================================
// 2. DASHBOARD COMPANY
// ==========================================
async function loadCompanyDashboard() {
  const alertBox = document.getElementById('company-pending-alert');
  const btnRequest = document.getElementById('btn-open-request-parking');
  
  if (currentUser.status === 'pending') {
    alertBox.classList.remove('hidden');
    btnRequest.setAttribute('disabled', 'true');
    document.getElementById('company-parkings-container').innerHTML = `
      <div class="text-center pad-lg text-muted">Votre compte entreprise est en attente. Une fois approuvé par le Super Admin, vous pourrez faire des demandes d'ajout.</div>
    `;
    return;
  }

  alertBox.classList.add('hidden');
  btnRequest.removeAttribute('disabled');

  try {
    const res = await fetch(`${API_BASE}/parkings/my`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    renderCompanyParkings(data.parkings);
  } catch (error) {
    showToast('Erreur lors de la récupération de vos parkings.', 'error');
  }
}

function renderCompanyParkings(parkings) {
  const container = document.getElementById('company-parkings-container');
  if (parkings.length === 0) {
    container.innerHTML = `
      <div class="text-center pad-lg text-muted" style="grid-column: span 3;">
        Aucun parking enregistré. Soumettez une demande en cliquant sur le bouton ci-dessus !
      </div>
    `;
    return;
  }

  container.innerHTML = parkings.map(parking => {
    let badgeClass = 'badge-pending';
    let label = 'En attente';
    
    if (parking.approvalStatus === 'approved') {
      badgeClass = 'badge-approved';
      label = 'Approuvé';
    } else if (parking.approvalStatus === 'rejected') {
      badgeClass = 'badge-rejected';
      label = 'Rejeté';
    }

    const isApproved = parking.approvalStatus === 'approved';
    const actionButtons = isApproved ? `
      <button class="btn btn-secondary btn-xs flex-1" onclick="openManageSpotsModal('${parking._id}', '${parking.name}')"><i class="fa-solid fa-grip"></i> Places</button>
      <button class="btn btn-secondary btn-xs flex-1" onclick="openManageEmployeeModal('${parking._id}')"><i class="fa-solid fa-user-tie"></i> Employé</button>
    ` : `<p class="text-muted text-center flex-1" style="font-size:11px;"><i class="fa-solid fa-hourglass-half"></i> En attente de validation administrative.</p>`;

    return `
      <div class="parking-card glass-panel">
        <div class="parking-card-header">
          <h4>${parking.name}</h4>
          <span class="badge ${badgeClass}">${label}</span>
        </div>
        <div class="parking-card-body">
          <p><i class="fa-solid fa-location-dot"></i> ${parking.address}, ${parking.city}</p>
          <p><i class="fa-solid fa-car"></i> Capacité : <strong>${parking.totalSpots} places</strong></p>
          <p><i class="fa-solid fa-euro-sign"></i> Tarif : <strong>${parking.pricePerHour} € / h</strong></p>
        </div>
        <div class="parking-card-actions">
          ${actionButtons}
        </div>
      </div>
    `;
  }).join('');
}

// Modal Demande d'ajout de parking
function openRequestParkingModal() {
  document.getElementById('modal-request-parking').classList.remove('hidden');
}

function closeRequestParkingModal() {
  document.getElementById('modal-request-parking').classList.add('hidden');
  document.getElementById('form-request-parking').reset();
}

function toggleHoursFields(checkbox) {
  const fields = document.getElementById('hours-fields-group');
  if (checkbox.checked) {
    fields.classList.add('hidden');
  } else {
    fields.classList.remove('hidden');
  }
}

async function handleRequestParking(e) {
  e.preventDefault();
  const name = document.getElementById('park-name').value;
  const address = document.getElementById('park-address').value;
  const city = document.getElementById('park-city').value;
  const zipCode = document.getElementById('park-zip').value;
  const totalSpots = parseInt(document.getElementById('park-spots').value);
  const pricePerHour = parseFloat(document.getElementById('park-price').value);
  const is24Hours = document.getElementById('park-24h').checked;
  const openingTime = document.getElementById('park-open').value;
  const closingTime = document.getElementById('park-close').value;

  // Récupérer les équipements
  const amenitiesCheckboxes = document.querySelectorAll('input[name="amenities"]:checked');
  const amenities = Array.from(amenitiesCheckboxes).map(cb => cb.value);

  try {
    const res = await fetch(`${API_BASE}/parkings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name,
        address,
        city,
        zipCode,
        totalSpots,
        pricePerHour,
        is24Hours,
        openingTime: is24Hours ? '00:00' : (openingTime || '00:00'),
        closingTime: is24Hours ? '23:59' : (closingTime || '23:59'),
        amenities
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showToast('Votre demande de parking a été soumise avec succès !');
    closeRequestParkingModal();
    loadCompanyDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Modal Gestion des places (Entreprise)
async function openManageSpotsModal(parkingId, parkingName) {
  selectedParkingForSpots = parkingId;
  document.getElementById('spot-parking-id').value = parkingId;
  document.getElementById('spots-modal-title').innerHTML = `<i class="fa-solid fa-grip text-cyan"></i> Places - ${parkingName}`;
  document.getElementById('modal-manage-spots').classList.remove('hidden');
  
  // Charger la liste des places
  loadParkingSpotsList(parkingId);
}

function closeManageSpotsModal() {
  document.getElementById('modal-manage-spots').classList.add('hidden');
  document.getElementById('form-add-spot').reset();
  selectedParkingForSpots = null;
}

async function loadParkingSpotsList(parkingId) {
  const container = document.getElementById('spots-list-container');
  container.innerHTML = `<div class="text-center pad-md text-muted" style="grid-column:span 3;"><div class="spinner" style="width:30px;height:30px;margin:0 auto;"></div> Chargement des places...</div>`;

  try {
    const res = await fetch(`${API_BASE}/spots/parking/${parkingId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    document.getElementById('spots-count-badge').textContent = data.spots.length;

    // Récupérer le parking correspondant pour voir sa capacité max
    const resParkings = await fetch(`${API_BASE}/parkings/my`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const dataPark = await resParkings.json();
    const currentPark = dataPark.parkings.find(p => p._id === parkingId);
    
    if (currentPark) {
      document.getElementById('spots-capacity-alert').textContent = `Capacité max : ${data.spots.length} / ${currentPark.totalSpots} places`;
    }

    if (data.spots.length === 0) {
      container.innerHTML = `
        <div class="text-center pad-md text-muted" style="grid-column: span 3;">
          <i class="fa-solid fa-grip-lines" style="font-size:30px;margin-bottom:10px;display:block;"></i>
          Aucune place n'a été ajoutée pour le moment.
        </div>
      `;
      return;
    }

    container.innerHTML = data.spots.map(spot => {
      let statusLabel = 'Libre';
      let statusClass = 'badge-free';
      if (spot.status === 'occupied') { statusLabel = 'Occupé'; statusClass = 'badge-occupied'; }
      if (spot.status === 'reserved') { statusLabel = 'Réservé'; statusClass = 'badge-indigo'; }
      if (spot.status === 'maintenance') { statusLabel = 'Maintenance'; statusClass = 'badge-maintenance'; }

      return `
        <div class="spot-item-card">
          <div class="spot-item-card-id">${spot.spotNumber}</div>
          <div class="spot-item-card-meta">Étage ${spot.floor} • Zone ${spot.zone}</div>
          <span class="badge ${statusClass}">${statusLabel}</span>
        </div>
      `;
    }).join('');

  } catch (error) {
    container.innerHTML = `<div class="text-center pad-md text-danger" style="grid-column:span 3;">Erreur lors de la récupération des places.</div>`;
  }
}

async function handleAddSpot(e) {
  e.preventDefault();
  const parkingId = document.getElementById('spot-parking-id').value;
  const floor = parseInt(document.getElementById('spot-floor').value);
  const zone = document.getElementById('spot-zone').value;
  const locationType = document.getElementById('spot-type').value;
  const isCovered = document.getElementById('spot-covered').checked;
  const isHandicap = document.getElementById('spot-handicap').checked;
  const isElectricCharging = document.getElementById('spot-electric').checked;
  const width = parseFloat(document.getElementById('spot-width').value);
  const length = parseFloat(document.getElementById('spot-length').value);

  try {
    const res = await fetch(`${API_BASE}/spots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        parkingId,
        floor,
        zone,
        locationType,
        isCovered,
        isHandicap,
        isElectricCharging,
        width,
        length
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showToast(`Place ajoutée avec l'ID auto-généré: ${data.spot.spotNumber}`);
    document.getElementById('form-add-spot').reset();
    document.getElementById('spot-parking-id').value = parkingId;
    loadParkingSpotsList(parkingId);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Modal Gestion des Employés (Entreprise)
async function openManageEmployeeModal(parkingId) {
  selectedParkingForEmployee = parkingId;
  document.getElementById('employee-parking-id').value = parkingId;
  document.getElementById('modal-manage-employee').classList.remove('hidden');
  
  const form = document.getElementById('form-create-employee');
  const details = document.getElementById('employee-details-view');
  form.classList.add('hidden');
  details.classList.add('hidden');

  try {
    // Charger tous les employés de cette entreprise
    const res = await fetch(`${API_BASE}/users/employees`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    // Trouver l'employé lié à ce parking spécifique
    const employee = data.employees.find(emp => emp.parkingId === parkingId);

    if (employee) {
      // Cas 2 : Un employé existe déjà pour ce parking
      details.classList.remove('hidden');
      document.getElementById('view-emp-name').textContent = employee.name;
      document.getElementById('view-emp-number').textContent = employee.employeeNumber || 'EMP-0000';
      document.getElementById('view-emp-position').innerHTML = `<i class="fa-solid fa-briefcase"></i> Position : <strong>${employee.position}</strong>`;
      document.getElementById('view-emp-email').textContent = employee.email;
      document.getElementById('view-emp-phone').textContent = employee.phone;
      document.getElementById('view-emp-shift').textContent = `${employee.shiftStart} à ${employee.shiftEnd}`;
      document.getElementById('view-emp-date').textContent = new Date(employee.createdAt).toLocaleDateString('fr-FR');
    } else {
      // Cas 1 : Aucun employé n'est lié à ce parking
      form.classList.remove('hidden');
    }

  } catch (error) {
    showToast(error.message, 'error');
  }
}

function closeManageEmployeeModal() {
  document.getElementById('modal-manage-employee').classList.add('hidden');
  document.getElementById('form-create-employee').reset();
  selectedParkingForEmployee = null;
}

async function handleCreateEmployee(e) {
  e.preventDefault();
  const parkingId = document.getElementById('employee-parking-id').value;
  const name = document.getElementById('emp-name').value;
  const email = document.getElementById('emp-email').value;
  const phone = document.getElementById('emp-phone').value;
  const password = document.getElementById('emp-password').value;
  const position = document.getElementById('emp-position').value;
  const shiftStart = document.getElementById('emp-shift-start').value;
  const shiftEnd = document.getElementById('emp-shift-end').value;

  try {
    const res = await fetch(`${API_BASE}/users/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        parkingId,
        name,
        email,
        phone,
        password,
        position,
        shiftStart,
        shiftEnd
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showToast('Compte employé créé avec succès ! Identifiants envoyés.');
    openManageEmployeeModal(parkingId); // Rafraîchir
  } catch (error) {
    showToast(error.message, 'error');
  }
}


// ==========================================
// 3. DASHBOARD EMPLOYÉ (TERRAIN)
// ==========================================
async function loadEmployeeDashboard() {
  const detailsContainer = document.getElementById('employee-parking-details');
  const spotsContainer = document.getElementById('employee-spots-grid');

  if (!currentUser.parkingId) {
    detailsContainer.innerHTML = `<p class="text-center pad-md text-danger"><i class="fa-solid fa-circle-xmark"></i> Vous n'êtes actuellement affecté à aucun parking.</p>`;
    spotsContainer.innerHTML = `<p class="text-center pad-md text-muted">Veuillez contacter votre entreprise pour vous faire affecter un parking.</p>`;
    return;
  }

  try {
    // 1. Charger la liste des places associées au parking affecté à l'employé
    const res = await fetch(`${API_BASE}/spots/parking/${currentUser.parkingId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    // 2. Afficher les détails du parking
    const freeSpotsCount = data.spots.filter(s => s.status === 'free').length;
    
    detailsContainer.innerHTML = `
      <div class="parking-detail-row"><strong>Nom du Parking :</strong> <span>${data.parkingName || 'Assigné'}</span></div>
      <div class="parking-detail-row"><strong>Places Disponibles :</strong> <span class="badge badge-free">${freeSpotsCount} Libres</span></div>
      <div class="parking-detail-row"><strong>Capacité totale :</strong> <span>${data.spots.length} places enregistrées</span></div>
      <div class="parking-detail-row"><strong>Horaires de shift :</strong> <span>${currentUser.shiftStart} à ${currentUser.shiftEnd}</span></div>
    `;

    // 3. Dessiner la grille de places interactives
    if (data.spots.length === 0) {
      spotsContainer.innerHTML = `<div class="text-center pad-md text-muted" style="grid-column:span 3;">Aucune place n'a été ajoutée par l'entreprise pour le moment.</div>`;
      return;
    }

    spotsContainer.innerHTML = data.spots.map(spot => {
      let statusLabel = 'Libre';
      let statusClass = 'free';
      if (spot.status === 'occupied') { statusLabel = 'Occupé'; statusClass = 'occupied'; }
      if (spot.status === 'reserved') { statusLabel = 'Réservé'; statusClass = 'occupied'; }
      if (spot.status === 'maintenance') { statusLabel = 'Maintenance'; statusClass = 'maintenance'; }

      return `
        <div class="live-spot-btn ${statusClass}" onclick="toggleSpotStatusFromDashboard('${spot._id}', '${spot.status}')">
          <span class="live-spot-id">${spot.spotNumber}</span>
          <span class="live-spot-label">Étage ${spot.floor} • Zone ${spot.zone}</span>
          <span class="live-spot-action">${statusLabel}</span>
        </div>
      `;
    }).join('');

  } catch (error) {
    detailsContainer.innerHTML = `<p class="text-center pad-md text-danger">Erreur lors de la récupération des détails.</p>`;
    spotsContainer.innerHTML = `<p class="text-center pad-md text-danger">Impossible de charger la grille de places.</p>`;
  }
}

async function toggleSpotStatusFromDashboard(spotId, currentStatus) {
  let nextStatus = 'free';
  if (currentStatus === 'free') nextStatus = 'occupied';
  else if (currentStatus === 'occupied') nextStatus = 'maintenance';
  else if (currentStatus === 'maintenance') nextStatus = 'free';

  try {
    const res = await fetch(`${API_BASE}/spots/${spotId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: nextStatus })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showToast(`Place ${data.spot.spotNumber} mise à jour en statut : ${nextStatus}`);
    loadEmployeeDashboard(); // Recharger la grille
  } catch (error) {
    showToast(error.message, 'error');
  }
}


// ==========================================
// 4. DASHBOARD CLIENT (CUSTOMER)
// ==========================================
function loadCustomerDashboard() {
  if (!currentUser) return;
  document.getElementById('client-plate').value = currentUser.vehiclePlate || '';
  document.getElementById('client-serial').value = currentUser.vehicleSerialNumber || '';
  document.getElementById('client-vtype').value = currentUser.vehicleType || 'car';
}

async function handleSaveVehicle(e) {
  e.preventDefault();
  const vehiclePlate = document.getElementById('client-plate').value;
  const vehicleSerialNumber = document.getElementById('client-serial').value;
  const vehicleType = document.getElementById('client-vtype').value;

  try {
    const res = await fetch(`${API_BASE}/users/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ vehiclePlate, vehicleSerialNumber, vehicleType })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erreur lors de l\'enregistrement.');

    currentUser = data.user;
    showToast('Informations sur le véhicule enregistrées avec succès !');
  } catch (error) {
    showToast(error.message, 'error');
  }
}


// ==========================================
// VIRTUAL MOCK MAILBOX SIMULATOR (WOW FACTOR)
// ==========================================
function toggleVirtualInbox() {
  const drawer = document.getElementById('email-drawer');
  drawer.classList.toggle('hidden');
}

async function fetchMockEmails() {
  try {
    const res = await fetch(`${API_BASE}/mock-emails`);
    if (!res.ok) return;

    const data = await res.json();
    allMockEmails = data.emails;

    // Mettre à jour le badge de notification
    const badge = document.getElementById('email-badge-count');
    badge.textContent = allMockEmails.length;
    if (allMockEmails.length > 0) {
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    // Mettre à jour la liste dans le drawer
    renderMockEmails();
  } catch (error) {
    console.error('Erreur lors de la récupération des mails simulés :', error);
  }
}

function renderMockEmails() {
  const container = document.getElementById('virtual-emails-list');
  if (allMockEmails.length === 0) {
    container.innerHTML = `
      <div class="no-emails">
        <i class="fa-solid fa-envelope-open-text"></i>
        <p>Aucun email reçu pour le moment.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = allMockEmails.map(email => {
    const dateStr = new Date(email.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="email-item">
        <div class="email-item-header">
          <span class="email-item-to">À : ${email.to}</span>
          <span class="email-item-date">${dateStr}</span>
        </div>
        <div class="email-item-subj">${email.subject}</div>
        <div class="email-item-body">${email.body}</div>
      </div>
    `;
  }).join('');
}

async function clearSimulatedEmails() {
  try {
    const res = await fetch(`${API_BASE}/mock-emails`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error();
    
    showToast('Boîte mail simulée vidée avec succès.');
    fetchMockEmails();
  } catch (error) {
    showToast('Erreur lors du vidage de la boîte mail.', 'error');
  }
}
