const API_URL = "GANTI_DENGAN_URL_DEPLOYMENT_WEB_APP_APPS_SCRIPT_ANDA";

let currentUser = null;
let currentCoords = { lat: 0, lng: 0 };
let map, marker;
let videoStream = null;

// Initial Setup
document.addEventListener("DOMContentLoaded", () => {
  checkSession();
  setupLoginForm();
  setupSettingForm();
});

// Toggle Show/Hide Password
function togglePasswordVisibility(inputId, icon) {
  const input = document.getElementById(inputId);
  if (input.type === "password") {
    input.type = "text";
    icon.classList.replace("fa-eye", "fa-eye-slash");
  } else {
    input.type = "password";
    icon.classList.replace("fa-eye-slash", "fa-eye");
  }
}

// Otentikasi Login
function setupLoginForm() {
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nik = document.getElementById("login-nik").value;
    const password = document.getElementById("login-password").value;

    try {
      const res = await fetch(`${API_URL}?action=login&nik=${nik}&password=${password}`);
      const data = await res.json();

      if (data.success) {
        currentUser = { ...data.user, password: password };
        localStorage.setItem("user_session", JSON.stringify(currentUser));
        initApp();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert("Gagal terhubung ke server.");
    }
  });
}

// Cek Sesi Tersimpan
function checkSession() {
  const session = localStorage.getItem("user_session");
  if (session) {
    currentUser = JSON.parse(session);
    initApp();
  }
}

// Inisialisasi Aplikasi Utama
function initApp() {
  document.getElementById("login-page").classList.add("hidden");
  document.getElementById("app-container").classList.remove("hidden");

  document.getElementById("user-name").innerText = currentUser.nama;
  document.getElementById("user-unit").innerText = currentUser.unitKerja;

  // Sync Server Time
  syncServerTime();
  setInterval(syncServerTime, 1000);

  // Init GPS & Map
  initGPS();

  // Load Today Status
  loadTodayStatus();
}

// Dapatkan Waktu Server Google (WIB)
async function syncServerTime() {
  try {
    const res = await fetch(`${API_URL}?action=getServerTime`);
    const data = await res.json();
    if (data.success) {
      document.getElementById("server-date").innerText = data.date;
      document.getElementById("server-time").innerText = data.time;

      // Auto Refresh jika ganti hari (00:00:00)
      if (data.time === "00:00:00") {
        loadTodayStatus();
      }
    }
  } catch (e) {
    console.log("Time sync error");
  }
}

// GPS & Map Initialization
function initGPS() {
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition((pos) => {
      currentCoords.lat = pos.coords.latitude;
      currentCoords.lng = pos.coords.longitude;

      document.getElementById("gps-coords").innerText = `${currentCoords.lat.toFixed(5)}, ${currentCoords.lng.toFixed(5)}`;

      if (!map) {
        map = L.map('map').setView([currentCoords.lat, currentCoords.lng], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        marker = L.marker([currentCoords.lat, currentCoords.lng]).addTo(map);
      } else {
        marker.setLatLng([currentCoords.lat, currentCoords.lng]);
        map.setView([currentCoords.lat, currentCoords.lng]);
      }
    }, (err) => {
      alert("Harap aktifkan GPS Anda!");
    }, { enableHighAccuracy: true });
  }
}

// Load Jam Masuk & Pulang Hari Ini
async function loadTodayStatus() {
  try {
    const res = await fetch(`${API_URL}?action=getTodayStatus&nik=${currentUser.nik}`);
    const data = await res.json();
    if (data.success) {
      document.getElementById("jam-masuk-display").innerText = data.status.jamMasuk;
      document.getElementById("jam-pulang-display").innerText = data.status.jamPulang;
    }
  } catch (e) {}
}

// Switch Tab Navigation
function switchTab(tabId, btn) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(el => el.classList.remove("active"));

  document.getElementById(tabId).classList.add("active");
  btn.classList.add("active");

  if (tabId === "tab-rekap") loadRekap();
  if (tabId === "tab-setting") loadSetting();
}

// Load Rekap
async function loadRekap() {
  const tbody = document.getElementById("rekap-list");
  tbody.innerHTML = "<tr><td colspan='3'>Loading...</td></tr>";

  const res = await fetch(`${API_URL}?action=getRekap&nik=${currentUser.nik}`);
  const data = await res.json();

  if (data.success) {
    tbody.innerHTML = "";
    data.rekap.forEach(item => {
      tbody.innerHTML += `
        <tr>
          <td>${item.tanggal}</td>
          <td>${item.jamMasuk}</td>
          <td>${item.jamPulang}</td>
        </tr>
      `;
    });
  }
}

// Load Setting Profil
function loadSetting() {
  document.getElementById("setting-nik").value = currentUser.nik;
  document.getElementById("setting-nama").value = currentUser.nama;
  document.getElementById("setting-unit").value = currentUser.unitKerja;
}

// Update Setting Form
function setupSettingForm() {
  document.getElementById("setting-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      action: "updateProfile",
      nik: currentUser.nik,
      nama: document.getElementById("setting-nama").value,
      unitKerja: document.getElementById("setting-unit").value,
      password: document.getElementById("setting-password").value || currentUser.password
    };

    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      alert("Data berhasil diubah!");
      currentUser.nama = payload.nama;
      currentUser.unitKerja = payload.unitKerja;
      if (payload.password) currentUser.password = payload.password;
      localStorage.setItem("user_session", JSON.stringify(currentUser));
      document.getElementById("user-name").innerText = currentUser.nama;
      document.getElementById("user-unit").innerText = currentUser.unitKerja;
    }
  });
}

// Modal Kamera Selfie Absensi
function openAbsenModal() {
  document.getElementById("modal-absen").style.display = "flex";
  navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
    .then(stream => {
      videoStream = stream;
      document.getElementById("webcam").srcObject = stream;
    })
    .catch(err => {
      alert("Akses kamera ditolak/tidak tersedia!");
      closeAbsenModal();
    });
}

function closeAbsenModal() {
  document.getElementById("modal-absen").style.display = "none";
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
  }
}

// Eksekusi One-Click Absen
async function executeAbsen(type) {
  const payload = {
    action: "absen",
    nik: currentUser.nik,
    password: currentUser.password,
    type: type,
    lat: currentCoords.lat,
    lng: currentCoords.lng
  };

  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (data.success) {
    alert(data.message);
    if (type === "masuk") document.getElementById("jam-masuk-display").innerText = data.time;
    if (type === "pulang") document.getElementById("jam-pulang-display").innerText = data.time;
    closeAbsenModal();
  } else {
    alert(data.message);
  }
}

// Logout
function logout() {
  localStorage.removeItem("user_session");
  location.reload();
}