const API_URL = "https://script.google.com/macros/s/AKfycbx...YOUR_SCRIPT_ID.../exec";

let currentUser = null;
let currentCoords = { lat: 0, lng: 0 };
let map = null;
let marker = null;
let stream = null;
let currentDateStr = "";

// Toggle Password
function togglePass(inputId, icon) {
  const input = document.getElementById(inputId);
  if (input.type === "password") {
    input.type = "text";
    icon.classList.replace("fa-eye", "fa-eye-slash");
  } else {
    input.type = "password";
    icon.classList.replace("fa-eye-slash", "fa-eye");
  }
}

// Login Function
async function login() {
  const nik = document.getElementById('loginNik').value;
  const password = document.getElementById('loginPass').value;

  if (!nik || !password) {
    alert("Isi NIK dan Password!");
    return;
  }

  const res = await fetchAPI({ action: 'login', nik, password });
  if (res.success) {
    currentUser = res.user;
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('appScreen').classList.add('active');
    
    document.getElementById('userNamaDisplay').innerText = currentUser.nama;
    document.getElementById('userUnitDisplay').innerText = currentUser.unitKerja;
    
    initApp();
  } else {
    alert(res.message);
  }
}

function logout() {
  location.reload();
}

async function initApp() {
  initMap();
  startGPSWatcher();
  await loadTodayStatus();
  loadProfileData();
  
  // Checking/refreshing date automatically
  setInterval(checkDateRefresh, 10000);
}

// Map GPS Initialization
function initMap() {
  map = L.map('map').setView([0, 0], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
}

function startGPSWatcher() {
  if ("geolocation" in navigator) {
    navigator.geolocation.watchPosition(
      (pos) => {
        currentCoords.lat = pos.coords.latitude;
        currentCoords.lng = pos.coords.longitude;
        
        const latLng = [currentCoords.lat, currentCoords.lng];
        map.setView(latLng, 16);

        if (!marker) {
          marker = L.marker(latLng).addTo(map);
        } else {
          marker.setLatLng(latLng);
        }
      },
      (err) => alert("Harap aktifkan GPS perangkat Anda!"),
      { enableHighAccuracy: true }
    );
  }
}

// Server Time & Refresh Automatic
async function loadTodayStatus() {
  const res = await fetchAPI({ action: 'getTodayStatus', nik: currentUser.nik });
  if (res.success) {
    document.getElementById('dateDisplay').innerText = res.serverTanggal;
    document.getElementById('clockDisplay').innerText = res.serverJam;
    document.getElementById('jamMasukDisplay').innerText = res.jamMasuk;
    document.getElementById('jamPulangDisplay').innerText = res.jamPulang;
    currentDateStr = res.serverTanggal;
  }
}

async function checkDateRefresh() {
  const res = await fetchAPI({ action: 'getTodayStatus', nik: currentUser.nik });
  if (res.success && res.serverTanggal !== currentDateStr) {
    // Otomatis refresh tanggal berikutnya
    loadTodayStatus();
  }
}

// Distance Calculation (Haversine Formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; 
}

// Camera Selfie Actions
async function openCamera() {
  document.getElementById('cameraModal').style.display = 'flex';
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    document.getElementById('webcam').srcObject = stream;
  } catch (err) {
    alert("Tidak dapat mengakses kamera depan.");
  }
}

function closeCamera() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
  document.getElementById('cameraModal').style.display = 'none';
}

async function executeAbsen(tipe) {
  // Distance Check (Maksimal 50 meter)
  const dist = calculateDistance(
    currentCoords.lat, currentCoords.lng,
    currentUser.latTarget, currentUser.lngTarget
  );

  if (dist > 50) {
    alert(`Gagal! Jarak Anda ${Math.round(dist)} meter dari lokasi target (Maksimal 50 meter).`);
    return;
  }

  const payload = {
    action: 'doAbsen',
    nik: currentUser.nik,
    nama: currentUser.nama,
    unitKerja: currentUser.unitKerja,
    lat: currentCoords.lat,
    lng: currentCoords.lng,
    tipe: tipe
  };

  const res = await fetchAPI(payload);
  if (res.success) {
    alert(res.message);
    if (tipe === 'masuk') {
      document.getElementById('jamMasukDisplay').innerText = res.waktu.jam;
    } else {
      document.getElementById('jamPulangDisplay').innerText = res.waktu.jam;
    }
    closeCamera();
  } else {
    alert(res.message);
  }
}

// Navigation Tabs
function switchTab(tabId, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  
  document.getElementById(tabId).classList.add('active');
  if (btn) btn.classList.add('active');

  if (tabId === 'rekapTab') loadRekapData();
}

async function loadRekapData() {
  const container = document.getElementById('rekapList');
  container.innerHTML = "Memuat rekap...";
  
  const res = await fetchAPI({ action: 'getRekap', nik: currentUser.nik });
  if (res.success && res.data.length > 0) {
    container.innerHTML = res.data.map(item => `
      <div class="status-box" style="margin-bottom: 8px; text-align: left;">
        <strong>${item.tanggal}</strong>
        <small>Masuk: ${item.jamMasuk} | Pulang: ${item.jamPulang}</small>
      </div>
    `).join('');
  } else {
    container.innerHTML = "<p>Belum ada data rekap.</p>";
  }
}

function loadProfileData() {
  document.getElementById('profNik').innerText = currentUser.nik;
  document.getElementById('profNama').innerText = currentUser.nama;
  document.getElementById('profUnit').innerText = currentUser.unitKerja;

  document.getElementById('editNama').value = currentUser.nama;
  document.getElementById('editUnit').value = currentUser.unitKerja;
}

async function saveSettings() {
  const nama = document.getElementById('editNama').value;
  const unitKerja = document.getElementById('editUnit').value;
  const password = document.getElementById('editPass').value;

  const res = await fetchAPI({
    action: 'updateProfile',
    nik: currentUser.nik,
    nama, unitKerja, password
  });

  if (res.success) {
    alert(res.message);
    currentUser.nama = nama;
    currentUser.unitKerja = unitKerja;
    loadProfileData();
  }
}

// Asynchronous API Engine
async function fetchAPI(payload) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    return await response.json();
  } catch (e) {
    console.error(e);
    return { success: false, message: "Gagal terhubung ke Server Apps Script." };
  }
}