const defaultPosition = { lat: 37.1950, lng: 40.5847 };
const storageKey = "gokhan-makina-field-state-v3";
const sessionKey = "gokhan-makina-active-session-v1";
const savedUsersKey = "gokhan-makina-saved-login-users-v1";
const clientKey = "gokhan-makina-client-id-v1";
const firebaseAppId = "gokhan-makina-v1";
const adminCredentials = { username: "mesut", password: "0852" };
const firebaseConfig = {
  apiKey: "AIzaSyBZfRIh5ArL-WObbjh09XMa0y--2nvUyFI",
  authDomain: "gokhan-makina.firebaseapp.com",
  projectId: "gokhan-makina",
  storageBucket: "gokhan-makina.firebasestorage.app",
  messagingSenderId: "1088331719728",
  appId: "1:1088331719728:web:58c5e78bb205164be279f5",
  measurementId: "G-1WT7FVD1NY"
};

let store = null;
let storeReady = false;
let userSession = null;
let memoryState = { personnel: [], tasks: [] };
let cloudBackup = {
  db: null,
  firestore: null,
  docRef: null,
  enabled: false,
  hydrating: false,
  saveTimer: null,
  unsubscribe: null
};
let clientId = null;
let currentRole = null;
let activeMobileUserId = null;
let activeMobileUserName = "";
let personnelData = [];
let taskData = [];
let unsubscribers = [];
let mainMap = null;
let miniMap = null;
let miniMapMarker = null;
let taskMarkers = [];
let personnelMarkers = [];
let selectedDateKey = getDateKey(new Date());
let calendarCursor = startOfMonth(new Date());
let confirmCallback = null;
let deferredInstallPrompt = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const els = {
  loginScreen: $("#loginScreen"),
  appShell: $("#appShell"),
  adminView: $("#adminView"),
  workerView: $("#workerView"),
  loginForm: $("#loginForm"),
  loginUsername: $("#loginUsername"),
  loginPassword: $("#loginPassword"),
  loginButton: $("#loginButton"),
  loginError: $("#loginError"),
  connectionBadge: $("#connectionBadge"),
  connectionText: $("#connectionText"),
  currentTime: $("#currentTime"),
  activeUserLabel: $("#activeUserLabel"),
  installButton: $("#installButton"),
  logoutButton: $("#logoutButton"),
  openPersonnelModal: $("#openPersonnelModal"),
  openTaskModal: $("#openTaskModal"),
  personnelModal: $("#personnelModal"),
  taskModal: $("#taskModal"),
  completeModal: $("#completeModal"),
  confirmModal: $("#confirmModal"),
  personnelForm: $("#personnelForm"),
  taskForm: $("#taskForm"),
  completeForm: $("#completeForm"),
  personnelList: $("#personnelList"),
  liveFeed: $("#liveFeed"),
  workerTasks: $("#workerTasks"),
  workerEmptyState: $("#workerEmptyState"),
  mobileNotification: $("#mobileNotification"),
  taskAssignee: $("#taskAssignee"),
  mainMap: $("#mainMap"),
  miniMap: $("#miniMap"),
  miniMapWrap: $("#miniMapWrap"),
  toggleMiniMap: $("#toggleMiniMap"),
  closeMiniMapFullscreen: $("#closeMiniMapFullscreen"),
  mapSearchInput: $("#mapSearchInput"),
  mapSearchButton: $("#mapSearchButton"),
  prevMonth: $("#prevMonth"),
  nextMonth: $("#nextMonth"),
  revenueCalendar: $("#revenueCalendar"),
  revenueDayDetail: $("#revenueDayDetail"),
  confirmText: $("#confirmText"),
  confirmExtra: $("#confirmExtra"),
  confirmInput: $("#confirmInput"),
  confirmInputLabel: $("#confirmInputLabel"),
  confirmCancel: $("#confirmCancel"),
  confirmOk: $("#confirmOk"),
  registeredUsersList: $("#registeredUsersList")
};

boot();

async function boot() {
  setStandaloneMode();
  clientId = getClientId();
  registerServiceWorker();
  setupEvents();
  updateClock();
  setInterval(updateClock, 15000);
  await initDataLayer();
}

async function initDataLayer() {
  userSession = { uid: "local-only" };
  store = createLocalStore();
  storeReady = true;
  setConnectionState("local", "Yerel kayıt modu");
  subscribeToStore();
  applyLoginParams();
  restoreSession();
  showToast("Yerel kayıt modu hazır.", "info");
  initFirebaseBackup();
}

function setupEvents() {
  els.loginForm.addEventListener("submit", handleLogin);
  els.loginButton.addEventListener("click", handleLogin);
  els.logoutButton.addEventListener("click", logout);
  els.openPersonnelModal.addEventListener("click", () => openModal("personnelModal"));
  els.openTaskModal.addEventListener("click", openTaskModal);
  els.personnelForm.addEventListener("submit", saveNewPersonnel);
  els.taskForm.addEventListener("submit", assignTask);
  els.completeForm.addEventListener("submit", submitCompletedTask);
  els.toggleMiniMap.addEventListener("click", toggleMiniMapFullscreen);
  els.closeMiniMapFullscreen.addEventListener("click", toggleMiniMapFullscreen);
  els.mapSearchButton.addEventListener("click", searchAddress);
  els.prevMonth.addEventListener("click", () => changeCalendarMonth(-1));
  els.nextMonth.addEventListener("click", () => changeCalendarMonth(1));
  $("#workerRefresh").addEventListener("click", () => {
    renderMobileApp();
    showToast("İş listesi güncellendi.", "info");
  });

  document.addEventListener("click", handleDocumentClick);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (!isStandalone()) {
      els.installButton.classList.remove("hidden");
    }
  });

  els.installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.installButton.classList.add("hidden");
  });
}

function handleDocumentClick(event) {
  const closeTarget = event.target.closest("[data-close-modal]");
  if (closeTarget) {
    closeModal(closeTarget.dataset.closeModal);
    return;
  }

  const deletePerson = event.target.closest("[data-delete-personnel]");
  if (deletePerson) {
    deletePersonnel(deletePerson.dataset.deletePersonnel);
    return;
  }

  const openComplete = event.target.closest("[data-complete-task]");
  if (openComplete) {
    openCompleteModal(openComplete.dataset.completeTask);
    return;
  }

  const calendarDay = event.target.closest("[data-date-key]");
  if (calendarDay) {
    selectedDateKey = calendarDay.dataset.dateKey;
    renderRevenueDashboard();
    return;
  }

  const userButton = event.target.closest("[data-login-user]");
  if (userButton) {
    els.loginUsername.value = userButton.dataset.loginUser || "";
    els.loginPassword.focus();
    return;
  }

  const deleteRevenueButton = event.target.closest("[data-delete-revenue]");
  if (deleteRevenueButton) {
    deleteRevenueTask(deleteRevenueButton.dataset.deleteRevenue);
  }
}

function subscribeToStore() {
  unsubscribers.forEach((unsubscribe) => unsubscribe());
  unsubscribers = [
    store.subscribePersonnel((rows) => {
      personnelData = rows.map(normalizePersonnel).sort((a, b) => a.name.localeCompare(b.name, "tr"));
      renderPersonnelList();
      renderRegisteredUsers();
      updateMainMapMarkers();
      updateStats();
    }),
    store.subscribeTasks((rows) => {
      const oldOpenCount = taskData.filter((task) => task.status === "open" && task.pId === activeMobileUserId).length;
      taskData = rows.map(normalizeTask).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const newOpenCount = taskData.filter((task) => task.status === "open" && task.pId === activeMobileUserId).length;

      updateStats();
      updateMainMapMarkers();
      renderLiveFeed();
      renderRevenueDashboard();

      if (activeMobileUserId) {
        renderMobileApp();
        if (newOpenCount > oldOpenCount) showMobileNotification();
      }
    })
  ];
}

function createLocalStore() {
  const listeners = { personnel: new Set(), tasks: new Set() };
  let state = readLocalState();

  const persist = () => {
    state.updatedAt = Date.now();
    state.updatedBy = clientId;
    writeLocalState(state);
    listeners.personnel.forEach((callback) => callback([...state.personnel]));
    listeners.tasks.forEach((callback) => callback([...state.tasks]));
    queueCloudBackup();
  };

  return {
    subscribePersonnel(callback) {
      listeners.personnel.add(callback);
      callback([...state.personnel]);
      return () => listeners.personnel.delete(callback);
    },
    subscribeTasks(callback) {
      listeners.tasks.add(callback);
      callback([...state.tasks]);
      return () => listeners.tasks.delete(callback);
    },
    async addPersonnel(data) {
      state.personnel.push({ id: makeId("person"), ...data });
      persist();
    },
    async updatePersonnel(id, data) {
      state.personnel = state.personnel.map((item) => item.id === id ? { ...item, ...data } : item);
      persist();
    },
    async deletePersonnel(id) {
      state.personnel = state.personnel.filter((item) => item.id !== id);
      state.tasks = state.tasks.filter((item) => item.pId !== id);
      persist();
    },
    async addTask(data) {
      state.tasks.push({ id: makeId("task"), ...data });
      persist();
    },
    async updateTask(id, data) {
      state.tasks = state.tasks.map((item) => item.id === id ? { ...item, ...data } : item);
      persist();
    },
    async deleteTask(id) {
      state.tasks = state.tasks.filter((item) => item.id !== id);
      persist();
    },
    getState() {
      return cloneState(state);
    },
    replaceState(nextState, options = {}) {
      state = cloneState(nextState);
      writeLocalState(state);
      listeners.personnel.forEach((callback) => callback([...state.personnel]));
      listeners.tasks.forEach((callback) => callback([...state.tasks]));
      if (options.backup !== false) {
        queueCloudBackup();
      }
    }
  };
}

function readLocalState() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey));
    if (parsed && Array.isArray(parsed.personnel) && Array.isArray(parsed.tasks)) {
      const state = cloneState(parsed);
      if (!state.updatedAt && (state.personnel.length || state.tasks.length)) {
        state.updatedAt = Date.now();
        state.updatedBy = clientId || "";
      }
      memoryState = cloneState(state);
      return state;
    }
  } catch {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      return cloneState(memoryState);
    }
  }
  return { personnel: [], tasks: [] };
}

function writeLocalState(state) {
  memoryState = cloneState(state);
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Bazı dosya önizlemeleri localStorage'ı engeller; uygulama yine de açık sayfada çalışır.
  }
}

function cloneState(state) {
  return {
    personnel: Array.isArray(state.personnel) ? state.personnel.map((item) => ({ ...item })) : [],
    tasks: Array.isArray(state.tasks) ? state.tasks.map((item) => ({ ...item })) : [],
    updatedAt: Number(state.updatedAt) || 0,
    updatedBy: state.updatedBy || ""
  };
}

function getClientId() {
  const existing = readJson(clientKey);
  if (existing?.id) return existing.id;

  const id = makeId("client");
  writeJson(clientKey, { id });
  return id;
}

async function initFirebaseBackup() {
  setConnectionState("local", "Yerel kayıt, bulut yedeği bağlanıyor");

  try {
    const [appMod, authMod, firestoreMod] = await withTimeout(Promise.all([
      import("https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js")
    ]), 8000);

    const app = appMod.initializeApp(firebaseConfig);
    const auth = authMod.getAuth(app);
    await authMod.signInAnonymously(auth);

    cloudBackup.firestore = firestoreMod;
    cloudBackup.db = firestoreMod.getFirestore(app);
    cloudBackup.docRef = firestoreMod.doc(
      cloudBackup.db,
      "artifacts",
      firebaseAppId,
      "public",
      "data",
      "backups",
      "main"
    );

    const cloudSnapshot = await firestoreMod.getDoc(cloudBackup.docRef);
    const localState = store.getState();

    if (cloudSnapshot.exists()) {
      const cloudState = normalizeCloudState(cloudSnapshot.data()?.state);
      if (cloudState.updatedAt > localState.updatedAt) {
        cloudBackup.hydrating = true;
        store.replaceState(cloudState, { backup: false });
        cloudBackup.hydrating = false;
        showToast("Firebase yedeği cihaza aktarıldı.", "success");
      } else if (localState.updatedAt > cloudState.updatedAt) {
        await saveCloudBackupNow();
      }
    } else {
      await saveCloudBackupNow();
    }

    cloudBackup.enabled = true;
    cloudBackup.unsubscribe = firestoreMod.onSnapshot(cloudBackup.docRef, (snapshot) => {
      if (!snapshot.exists() || cloudBackup.hydrating) return;
      const cloudState = normalizeCloudState(snapshot.data()?.state);
      const localNow = store.getState();
      if (cloudState.updatedBy !== clientId && cloudState.updatedAt > localNow.updatedAt) {
        cloudBackup.hydrating = true;
        store.replaceState(cloudState, { backup: false });
        cloudBackup.hydrating = false;
        showToast("Firebase yedeğinden güncel veri alındı.", "info");
      }
    });

    setConnectionState("online", "Firebase yedeği aktif");
  } catch (error) {
    console.error("Firebase backup error:", error);
    cloudBackup.enabled = false;
    setConnectionState("error", "Yerel kayıt modu, Firebase yedeği pasif");
    showToast("Firebase yedeği bağlanamadı. Anonymous Auth ve Firestore ayarlarını kontrol edin.", "error");
  }
}

function normalizeCloudState(state) {
  return cloneState(state || {});
}

function queueCloudBackup() {
  if (!cloudBackup.enabled || cloudBackup.hydrating) return;
  window.clearTimeout(cloudBackup.saveTimer);
  cloudBackup.saveTimer = window.setTimeout(() => {
    saveCloudBackupNow().catch((error) => {
      console.error("Firebase backup save error:", error);
      setConnectionState("error", "Firebase yedeği kaydedilemedi");
    });
  }, 450);
}

async function saveCloudBackupNow() {
  if (!cloudBackup.firestore || !cloudBackup.docRef || !store) return;
  const state = store.getState();
  await cloudBackup.firestore.setDoc(cloudBackup.docRef, {
    state,
    updatedAt: cloudBackup.firestore.serverTimestamp(),
    updatedBy: clientId
  }, { merge: true });
  setConnectionState("online", "Firebase yedeği aktif");
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => window.setTimeout(() => reject(new Error("Firebase bağlantısı zaman aşımına uğradı.")), ms))
  ]);
}

function readJson(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Dosya önizlemelerinde localStorage engellenirse oturum sadece açık sayfa boyunca kalır.
  }
}

function removeJson(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Silme başarısız olsa bile sayfa içi çıkış akışı tamamlanır.
  }
}

function saveSession(session) {
  writeJson(sessionKey, { ...session, savedAt: Date.now() });
}

function clearSession() {
  removeJson(sessionKey);
}

function readSavedLoginUsers() {
  const rows = readJson(savedUsersKey);
  return Array.isArray(rows) ? rows : [];
}

function writeSavedLoginUsers(rows) {
  writeJson(savedUsersKey, rows.slice(0, 12));
}

function rememberLoginUser(user) {
  if (!user?.username) return;

  const normalizedUsername = user.username.trim().toLowerCase();
  const rows = readSavedLoginUsers().filter((row) => row.username !== normalizedUsername);
  rows.unshift({
    username: normalizedUsername,
    userId: user.userId || "",
    name: user.name || normalizedUsername,
    role: user.role || "Personel",
    savedAt: Date.now()
  });

  writeSavedLoginUsers(rows);
  renderRegisteredUsers();
}

function resolveSavedLoginUser(savedUser) {
  if (!savedUser?.username) return null;

  if (savedUser.username === adminCredentials.username) {
    return {
      role: "Yönetici",
      name: "Mesut",
      username: adminCredentials.username,
      icon: "fa-user-tie"
    };
  }

  const person = personnelData.find((item) => item.id === savedUser.userId || item.username === savedUser.username);
  return {
    role: "Personel",
    name: person?.name || savedUser.name || savedUser.username,
    username: person?.username || savedUser.username,
    icon: "fa-helmet-safety"
  };
}

function restoreSession() {
  const session = readJson(sessionKey);
  if (!session || !session.role) return;

  if (session.role === "admin") {
    showAdmin();
    return;
  }

  if (session.role === "worker") {
    const person = personnelData.find((item) => item.id === session.userId || item.username === session.username);
    if (person) {
      showWorker(person);
      return;
    }
  }

  clearSession();
}

async function handleLogin(event) {
  event.preventDefault();
  if (!storeReady || !userSession) {
    showToast("Veri bağlantısı hazırlanıyor. Birazdan tekrar deneyin.", "info");
    return;
  }

  const username = els.loginUsername.value.trim().toLowerCase();
  const password = els.loginPassword.value.trim();
  els.loginError.classList.add("hidden");
  setBusy(els.loginButton, true, "Giriş yapılıyor...");

  await wait(250);

  if (username === adminCredentials.username && password === adminCredentials.password) {
    showAdmin();
    showToast("Yönetici girişi başarılı.", "success");
  } else {
    const person = personnelData.find((item) => item.username === username && item.password === password);
    if (person) {
      showWorker(person);
      showToast(`Hoş geldin, ${person.name}.`, "success");
    } else {
      els.loginError.classList.remove("hidden");
      showToast("Giriş bilgileri hatalı.", "error");
    }
  }

  setBusy(els.loginButton, false);
}

function showAdmin() {
  currentRole = "admin";
  activeMobileUserId = null;
  activeMobileUserName = "";
  els.loginScreen.classList.add("hidden");
  els.appShell.classList.remove("hidden");
  els.adminView.classList.remove("hidden");
  els.workerView.classList.add("hidden");
  els.activeUserLabel.innerHTML = `<i class="fa-solid fa-user-tie"></i> Admin: Mesut`;
  saveSession({ role: "admin", username: adminCredentials.username });
  rememberLoginUser({
    role: "Yönetici",
    name: "Mesut",
    username: adminCredentials.username
  });
  initMaps();
  renderAll();
  setTimeout(() => {
    if (mainMap) mainMap.invalidateSize();
  }, 200);
}

function showWorker(person) {
  currentRole = "worker";
  activeMobileUserId = person.id;
  activeMobileUserName = person.name;
  els.loginScreen.classList.add("hidden");
  els.appShell.classList.remove("hidden");
  els.adminView.classList.add("hidden");
  els.workerView.classList.remove("hidden");
  els.activeUserLabel.innerHTML = `<i class="fa-solid fa-helmet-safety"></i> ${escapeHtml(person.name)}`;
  saveSession({ role: "worker", userId: person.id, username: person.username });
  rememberLoginUser({
    role: "Personel",
    name: person.name,
    username: person.username,
    userId: person.id
  });
  renderMobileApp();
}

function logout() {
  currentRole = null;
  activeMobileUserId = null;
  activeMobileUserName = "";
  els.loginUsername.value = "";
  els.loginPassword.value = "";
  els.loginError.classList.add("hidden");
  els.appShell.classList.add("hidden");
  els.adminView.classList.add("hidden");
  els.workerView.classList.add("hidden");
  els.loginScreen.classList.remove("hidden");
  closeAllModals();
  clearSession();
  showToast("Oturum kapatıldı.", "info");
}

function renderAll() {
  renderPersonnelList();
  renderLiveFeed();
  renderRevenueDashboard();
  renderMobileApp();
  updateStats();
}

function updateStats() {
  const todayKey = getDateKey(new Date());
  const now = new Date();
  const completedTasks = taskData.filter((task) => task.status === "completed");
  const daily = sumRevenue(completedTasks.filter((task) => taskDateKey(task) === todayKey));
  const weekly = sumRevenue(completedTasks.filter((task) => isSameWeek(taskDate(task), now)));
  const monthly = sumRevenue(completedTasks.filter((task) => isSameMonth(taskDate(task), now)));

  $("#statPersonnel").textContent = personnelData.length;
  $("#statOpen").textContent = taskData.filter((task) => task.status === "open").length;
  $("#statDailyRevenue").textContent = formatMoney(daily);
  $("#statMonthlyRevenue").textContent = formatMoney(monthly);
  $("#dailyRevenueTotal").textContent = formatMoney(daily);
  $("#weeklyRevenueTotal").textContent = formatMoney(weekly);
  $("#monthlyRevenueTotal").textContent = formatMoney(monthly);
  $("#statTodayLabel").textContent = formatDateHuman(new Date());
  $("#statMonthLabel").textContent = now.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}

function renderPersonnelList() {
  $("#personnelCountLabel").textContent = `${personnelData.length} kayıt`;
  els.taskAssignee.innerHTML = "";

  if (!personnelData.length) {
    els.personnelList.innerHTML = `<p class="empty-text">Henüz personel eklenmedi.</p>`;
    els.taskAssignee.innerHTML = `<option value="">Önce personel ekleyin</option>`;
    return;
  }

  els.personnelList.innerHTML = personnelData.map((person) => {
    const active = person.status === "Sahada";
    return `
      <div class="person-row">
        <div class="avatar">${escapeHtml(initials(person.name))}</div>
        <div class="person-meta">
          <strong>${escapeHtml(person.name)}</strong>
          <span class="status-tag ${active ? "active" : ""}">${escapeHtml(person.status || "Bekliyor")}</span>
        </div>
        <div class="row-actions">
          <button class="tiny-danger" data-delete-personnel="${escapeAttr(person.id)}" type="button" title="Sil" aria-label="${escapeAttr(person.name)} sil">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
  }).join("");

  els.taskAssignee.innerHTML = personnelData.map((person) => (
    `<option value="${escapeAttr(person.id)}">${escapeHtml(person.name)} (${escapeHtml(person.status || "Bekliyor")})</option>`
  )).join("");
}

function renderRegisteredUsers() {
  if (!els.registeredUsersList) return;

  const rows = readSavedLoginUsers()
    .map(resolveSavedLoginUser)
    .filter(Boolean);

  if (!rows.length) {
    els.registeredUsersList.innerHTML = `<p class="registered-empty">Bu cihazda kayıtlı kullanıcı yok.</p>`;
    return;
  }

  els.registeredUsersList.innerHTML = rows.map((user) => `
    <button class="registered-user" data-login-user="${escapeAttr(user.username)}" type="button">
      <span class="registered-user-icon"><i class="fa-solid ${user.icon}"></i></span>
      <span>
        <strong>${escapeHtml(user.name)}</strong>
        <small>${escapeHtml(user.role)} - ${escapeHtml(user.username)}</small>
      </span>
    </button>
  `).join("");
}

function renderLiveFeed() {
  const feedItems = [
    ...taskData.filter((task) => task.status === "completed" && task.completedAt).map((task) => {
      const person = personnelData.find((item) => item.id === task.pId);
      return {
        type: "success",
        time: task.completedAt,
        title: "Servis tamamlandı",
        desc: `${person ? person.name : "Personel"}, ${task.customer} işlemini bitirdi.`,
        price: task.price || 0
      };
    }),
    ...taskData.filter((task) => task.status === "open" && task.createdAt).map((task) => {
      const person = personnelData.find((item) => item.id === task.pId);
      return {
        type: "new",
        time: task.createdAt,
        title: "Görev atandı",
        desc: `${person ? person.name : "Personel"} personeline ${task.customer} için görev verildi.`,
        price: 0
      };
    })
  ].sort((a, b) => b.time - a.time);

  $("#feedCountLabel").textContent = `${feedItems.length} hareket`;

  if (!feedItems.length) {
    els.liveFeed.innerHTML = `<p class="empty-text">Henüz bir hareket yok.</p>`;
    return;
  }

  els.liveFeed.innerHTML = feedItems.slice(0, 30).map((item) => `
    <article class="feed-item ${item.type}">
      <div class="feed-top">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${formatTime(new Date(item.time))}</span>
      </div>
      <p>${escapeHtml(item.desc)}</p>
      ${item.price > 0 ? `<span class="day-total">${formatMoney(item.price)}</span>` : ""}
    </article>
  `).join("");
}

function renderMobileApp() {
  if (!activeMobileUserId) return;
  const myTasks = taskData
    .filter((task) => task.pId === activeMobileUserId && task.status === "open")
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  els.workerEmptyState.classList.toggle("hidden", myTasks.length > 0);
  els.workerTasks.innerHTML = myTasks.map((task) => {
    const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(task.lat)},${encodeURIComponent(task.lng)}`;
    return `
      <article class="task-card">
        <div class="task-card-head">
          <span>Yeni görev</span>
          <small>${formatTime(new Date(task.createdAt || Date.now()))}</small>
        </div>
        <h3>${escapeHtml(task.customer)}</h3>
        <div class="task-meta">
          ${task.phone ? `<a href="tel:${escapeAttr(task.phone)}"><i class="fa-solid fa-phone"></i>${escapeHtml(task.phone)}</a>` : ""}
          <a href="${mapUrl}" target="_blank" rel="noopener"><i class="fa-solid fa-location-arrow"></i>Yol tarifi</a>
        </div>
        <p>${escapeHtml(task.detail || "Servis detayı yok.")}</p>
        ${task.address ? `<p><i class="fa-solid fa-location-dot"></i> ${escapeHtml(task.address)}</p>` : ""}
        <div class="task-actions">
          <button class="primary-action compact success" data-complete-task="${escapeAttr(task.id)}" type="button">
            <i class="fa-solid fa-check"></i>
            İşi Tamamla
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function renderRevenueDashboard() {
  updateStats();

  $("#calendarMonthLabel").textContent = calendarCursor.toLocaleDateString("tr-TR", {
    month: "long",
    year: "numeric"
  });

  const totalsByDay = new Map();
  taskData.filter((task) => task.status === "completed").forEach((task) => {
    const key = taskDateKey(task);
    totalsByDay.set(key, (totalsByDay.get(key) || 0) + (Number(task.price) || 0));
  });

  const days = buildCalendarDays(calendarCursor);
  els.revenueCalendar.innerHTML = days.map((date) => {
    const key = getDateKey(date);
    const total = totalsByDay.get(key) || 0;
    const classes = [
      "calendar-day",
      isSameMonth(date, calendarCursor) ? "" : "is-muted",
      key === getDateKey(new Date()) ? "is-today" : "",
      key === selectedDateKey ? "is-selected" : ""
    ].filter(Boolean).join(" ");

    return `
      <button class="${classes}" data-date-key="${key}" type="button">
        <b>${date.getDate()}</b>
        <span>${total > 0 ? formatMoney(total) : "0 TL"}</span>
      </button>
    `;
  }).join("");

  renderRevenueDayDetail();
}

function renderRevenueDayDetail() {
  const selectedDate = parseDateKey(selectedDateKey);
  const dayTasks = taskData
    .filter((task) => task.status === "completed" && taskDateKey(task) === selectedDateKey)
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  const total = sumRevenue(dayTasks);

  if (!dayTasks.length) {
    els.revenueDayDetail.innerHTML = `
      <h4>${formatDateHuman(selectedDate)}</h4>
      <span class="day-total">0 TL</span>
      <p class="empty-text">Bu güne kayıtlı tamamlanmış servis yok.</p>
    `;
    return;
  }

  els.revenueDayDetail.innerHTML = `
    <h4>${formatDateHuman(selectedDate)}</h4>
    <span class="day-total">${formatMoney(total)}</span>
    ${dayTasks.map((task) => {
      const person = personnelData.find((item) => item.id === task.pId);
      return `
        <article class="day-job">
          <strong>${escapeHtml(task.customer)}</strong>
          <span>${escapeHtml(person ? person.name : "Personel")} - ${formatTime(new Date(task.completedAt || Date.now()))}</span>
          <p>${escapeHtml(task.note || task.detail || "Açıklama yok.")}</p>
          <span class="day-total">${formatMoney(task.price || 0)}</span>
          ${currentRole === "admin" ? `
            <button class="danger-action small-danger" data-delete-revenue="${escapeAttr(task.id)}" type="button">
              <i class="fa-solid fa-trash-can"></i>
              Ciro kaydını sil
            </button>
          ` : ""}
        </article>
      `;
    }).join("")}
  `;
}

function changeCalendarMonth(offset) {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + offset, 1);
  selectedDateKey = getDateKey(new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1));
  renderRevenueDashboard();
}

function openTaskModal() {
  if (!personnelData.length) {
    showToast("Önce bir saha personeli ekleyin.", "error");
    return;
  }
  openModal("taskModal");
  initMiniMap();
  setTimeout(() => {
    if (miniMap) miniMap.invalidateSize();
  }, 220);
}

async function saveNewPersonnel(event) {
  event.preventDefault();
  const name = $("#newPersonName").value.trim();
  const username = $("#newPersonUsername").value.trim().toLowerCase();
  const password = $("#newPersonPassword").value.trim();
  const button = $("#savePersonnelButton");

  if (!name || !username || !password) {
    showToast("Lütfen tüm alanları doldurun.", "error");
    return;
  }

  if (personnelData.some((person) => person.username === username)) {
    showToast("Bu kullanıcı adı zaten kayıtlı.", "error");
    return;
  }

  setBusy(button, true, "Kaydediliyor...");
  try {
    await store.addPersonnel({
      name,
      username,
      password,
      status: "Bekliyor",
      lat: defaultPosition.lat + (Math.random() * 0.02 - 0.01),
      lng: defaultPosition.lng + (Math.random() * 0.02 - 0.01),
      createdAt: Date.now()
    });
    event.target.reset();
    closeModal("personnelModal");
    showToast(`${name} personel listesine eklendi.`, "success");
  } catch (error) {
    console.error(error);
    showToast("Personel kaydedilemedi.", "error");
  } finally {
    setBusy(button, false);
  }
}

function deletePersonnel(id) {
  const person = personnelData.find((item) => item.id === id);
  if (!person) return;
  showConfirm(`${person.name} silinsin mi? Bu personele ait yerel görev kayıtları da kaldırılabilir.`, async () => {
    try {
      await store.deletePersonnel(id);
      showToast("Personel silindi.", "info");
    } catch (error) {
      console.error(error);
      showToast("Silme işlemi başarısız oldu.", "error");
    }
  });
}

function deleteRevenueTask(taskId) {
  if (currentRole !== "admin") {
    showToast("Ciro kaydını yalnızca admin silebilir.", "error");
    return;
  }

  const task = taskData.find((item) => item.id === taskId && item.status === "completed");
  if (!task) {
    showToast("Silinecek ciro kaydı bulunamadı.", "error");
    return;
  }

  const message = `${task.customer} için ${formatMoney(task.price || 0)} tutarındaki ciro kaydı silinecek. Bu işlem geri alınamaz.`;
  showConfirm(message, async () => {
    try {
      await store.deleteTask(task.id);
      showToast("Ciro kaydı silindi.", "info");
    } catch (error) {
      console.error(error);
      showToast("Ciro kaydı silinemedi.", "error");
    }
  }, {
    confirmText: "SİL",
    inputLabel: "Silmek için SİL yazın",
    okText: "Ciro Kaydını Sil"
  });
}

async function assignTask(event) {
  event.preventDefault();
  const button = $("#assignTaskButton");
  const pId = els.taskAssignee.value;
  const customer = $("#taskCustomer").value.trim();
  const phone = $("#taskPhone").value.trim();
  const detail = $("#taskDetail").value.trim();
  const address = $("#taskAddress").value.trim();
  const lat = Number($("#taskLat").value) || defaultPosition.lat;
  const lng = Number($("#taskLng").value) || defaultPosition.lng;

  if (!pId) {
    showToast("Görev için personel seçin.", "error");
    return;
  }
  if (!customer || !detail) {
    showToast("Müşteri ve işlem detayı zorunlu.", "error");
    return;
  }

  setBusy(button, true, "Gönderiliyor...");
  try {
    await store.addTask({
      pId,
      customer,
      phone,
      detail,
      address,
      lat,
      lng,
      status: "open",
      createdAt: Date.now(),
      createdDateKey: getDateKey(new Date())
    });
    await store.updatePersonnel(pId, { status: "Sahada" });
    event.target.reset();
    resetMiniMapPosition();
    closeModal("taskModal");
    showToast("Görev personele gönderildi.", "success");
  } catch (error) {
    console.error(error);
    showToast("Görev gönderilemedi.", "error");
  } finally {
    setBusy(button, false);
  }
}

function openCompleteModal(taskId) {
  const task = taskData.find((item) => item.id === taskId);
  if (!task) return;
  $("#completeTaskId").value = task.id;
  $("#completeCustomerName").textContent = task.customer;
  $("#completeNote").value = "";
  $("#completePrice").value = "";
  openModal("completeModal");
}

async function submitCompletedTask(event) {
  event.preventDefault();
  const taskId = $("#completeTaskId").value;
  const task = taskData.find((item) => item.id === taskId);
  if (!task) return;

  const button = $("#submitCompleteButton");
  const note = $("#completeNote").value.trim();
  const price = Number($("#completePrice").value) || 0;
  const completedAt = Date.now();
  const completedDateKey = getDateKey(new Date(completedAt));

  setBusy(button, true, "İletiliyor...");
  try {
    await store.updateTask(taskId, {
      status: "completed",
      note,
      price,
      completedAt,
      completedDateKey
    });

    const hasOtherOpenTasks = taskData.some((item) => item.id !== taskId && item.pId === task.pId && item.status === "open");
    if (!hasOtherOpenTasks) {
      await store.updatePersonnel(task.pId, { status: "Bekliyor" });
    }

    closeModal("completeModal");
    showToast("Servis tamamlandı ve ciroya işlendi.", "success");
  } catch (error) {
    console.error(error);
    showToast("Servis tamamlanamadı.", "error");
  } finally {
    setBusy(button, false);
  }
}

function initMaps() {
  if (!window.L) {
    els.mainMap.innerHTML = `<div class="map-placeholder">Harita kutuphanesi yuklenemedi.</div>`;
    return;
  }

  if (!mainMap) {
    mainMap = L.map("mainMap", { zoomControl: true }).setView([defaultPosition.lat, defaultPosition.lng], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap"
    }).addTo(mainMap);
  }

  updateMainMapMarkers();
}

function initMiniMap() {
  if (!window.L) {
    els.miniMap.innerHTML = `<div class="map-placeholder">Harita kutuphanesi yuklenemedi.</div>`;
    return;
  }

  if (!miniMap) {
    miniMap = L.map("miniMap", { zoomControl: true }).setView([defaultPosition.lat, defaultPosition.lng], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap"
    }).addTo(miniMap);
    miniMapMarker = L.marker([defaultPosition.lat, defaultPosition.lng], { draggable: true }).addTo(miniMap);
    miniMapMarker.on("dragend", () => {
      const pos = miniMapMarker.getLatLng();
      setTaskPosition(pos.lat, pos.lng);
    });
    miniMap.on("click", (event) => {
      miniMapMarker.setLatLng(event.latlng);
      setTaskPosition(event.latlng.lat, event.latlng.lng);
    });
  }
}

function updateMainMapMarkers() {
  if (!mainMap || !window.L) return;

  taskMarkers.forEach((marker) => marker.remove());
  personnelMarkers.forEach((marker) => marker.remove());
  taskMarkers = [];
  personnelMarkers = [];

  const taskIcon = L.divIcon({
    className: "",
    html: `<div class="custom-pin task"></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 29]
  });

  const personIcon = L.divIcon({
    className: "",
    html: `<div class="custom-pin person"></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

  taskData.filter((task) => task.status === "open" && isFinite(task.lat) && isFinite(task.lng)).forEach((task) => {
    const marker = L.marker([task.lat, task.lng], { icon: taskIcon }).addTo(mainMap);
    marker.bindPopup(`<strong>${escapeHtml(task.customer)}</strong><br>${escapeHtml(task.detail || "")}`);
    taskMarkers.push(marker);
  });

  personnelData.filter((person) => isFinite(person.lat) && isFinite(person.lng)).forEach((person) => {
    const marker = L.marker([person.lat, person.lng], { icon: personIcon }).addTo(mainMap);
    marker.bindPopup(`<strong>${escapeHtml(person.name)}</strong><br>${escapeHtml(person.status || "Bekliyor")}`);
    personnelMarkers.push(marker);
  });
}

function toggleMiniMapFullscreen() {
  const isFull = els.miniMapWrap.classList.toggle("fullscreen");
  els.closeMiniMapFullscreen.classList.toggle("hidden", !isFull);
  els.toggleMiniMap.innerHTML = isFull
    ? `<i class="fa-solid fa-compress"></i> Küçült`
    : `<i class="fa-solid fa-expand"></i> Büyüt`;
  setTimeout(() => {
    if (miniMap) miniMap.invalidateSize();
  }, 220);
}

async function searchAddress() {
  const query = els.mapSearchInput.value.trim();
  if (!query) return;

  setBusy(els.mapSearchButton, true, "Araniyor...");
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`, {
      headers: { "Accept": "application/json" }
    });
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      showToast("Adres bulunamadi.", "error");
      return;
    }

    const lat = Number(data[0].lat);
    const lng = Number(data[0].lon);
    setTaskPosition(lat, lng);
    if (miniMap && miniMapMarker) {
      miniMap.flyTo([lat, lng], 16);
      miniMapMarker.setLatLng([lat, lng]);
    }
    showToast("Konum secildi.", "success");
  } catch (error) {
    console.error(error);
    showToast("Adres aramasi basarisiz oldu.", "error");
  } finally {
    setBusy(els.mapSearchButton, false);
  }
}

function setTaskPosition(lat, lng) {
  $("#taskLat").value = lat;
  $("#taskLng").value = lng;
}

function resetMiniMapPosition() {
  setTaskPosition(defaultPosition.lat, defaultPosition.lng);
  if (miniMap && miniMapMarker) {
    miniMap.setView([defaultPosition.lat, defaultPosition.lng], 14);
    miniMapMarker.setLatLng([defaultPosition.lat, defaultPosition.lng]);
  }
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove("hidden");
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add("hidden");
  if (id === "taskModal" && els.miniMapWrap.classList.contains("fullscreen")) {
    toggleMiniMapFullscreen();
  }
}

function closeAllModals() {
  $$(".modal").forEach((modal) => modal.classList.add("hidden"));
}

function showConfirm(message, callback, options = {}) {
  confirmCallback = { callback, confirmText: options.confirmText || "" };
  els.confirmText.textContent = message;
  els.confirmOk.textContent = options.okText || "Evet, Sil";

  if (options.confirmText) {
    els.confirmInputLabel.textContent = options.inputLabel || `Onaylamak için ${options.confirmText} yazın`;
    els.confirmInput.value = "";
    els.confirmInput.placeholder = options.confirmText;
    els.confirmExtra.classList.remove("hidden");
    setTimeout(() => els.confirmInput.focus(), 80);
  } else {
    els.confirmExtra.classList.add("hidden");
    els.confirmInput.value = "";
  }

  openModal("confirmModal");
}

els.confirmCancel.addEventListener("click", () => {
  confirmCallback = null;
  els.confirmExtra.classList.add("hidden");
  closeModal("confirmModal");
});

els.confirmOk.addEventListener("click", async () => {
  const confirmAction = confirmCallback;
  if (confirmAction?.confirmText) {
    const typed = els.confirmInput.value.trim().toLocaleUpperCase("tr-TR");
    const expected = confirmAction.confirmText.toLocaleUpperCase("tr-TR");
    if (typed !== expected) {
      showToast(`Devam etmek için ${confirmAction.confirmText} yazın.`, "error");
      return;
    }
  }

  confirmCallback = null;
  els.confirmExtra.classList.add("hidden");
  closeModal("confirmModal");
  if (confirmAction?.callback) await confirmAction.callback();
});

function showMobileNotification() {
  els.mobileNotification.classList.remove("hidden");
  setTimeout(() => els.mobileNotification.classList.add("hidden"), 3500);
}

function setConnectionState(type, text) {
  els.connectionBadge.classList.remove("online", "local", "error");
  if (type !== "connecting") els.connectionBadge.classList.add(type);
  els.connectionText.textContent = text;
}

function setBusy(button, busy, label) {
  if (busy) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${label}`;
  } else {
    button.disabled = false;
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icon = type === "success" ? "fa-circle-check" : type === "error" ? "fa-circle-xmark" : "fa-circle-info";
  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${escapeHtml(message)}</span>`;
  $("#toastRegion").appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 220);
  }, 3200);
}

function updateClock() {
  els.currentTime.textContent = new Date().toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function normalizePersonnel(person) {
  return {
    id: person.id,
    name: person.name || "Isimsiz Personel",
    username: (person.username || "").toLowerCase(),
    password: person.password || "",
    status: person.status || "Bekliyor",
    lat: Number(person.lat) || defaultPosition.lat,
    lng: Number(person.lng) || defaultPosition.lng,
    createdAt: Number(person.createdAt) || 0
  };
}

function normalizeTask(task) {
  return {
    id: task.id,
    pId: task.pId || "",
    customer: task.customer || "Bilinmeyen Müşteri",
    phone: task.phone || "",
    detail: task.detail || "",
    address: task.address || "",
    lat: Number(task.lat) || defaultPosition.lat,
    lng: Number(task.lng) || defaultPosition.lng,
    status: task.status || "open",
    createdAt: Number(task.createdAt) || 0,
    createdDateKey: task.createdDateKey || "",
    completedAt: Number(task.completedAt) || 0,
    completedDateKey: task.completedDateKey || "",
    note: task.note || "",
    price: Number(task.price) || 0
  };
}

function taskDate(task) {
  if (task.completedAt) return new Date(task.completedAt);
  if (task.completedDateKey) return parseDateKey(task.completedDateKey);
  return new Date(0);
}

function taskDateKey(task) {
  if (task.completedDateKey) return task.completedDateKey;
  if (task.completedAt) return getDateKey(new Date(task.completedAt));
  return "";
}

function sumRevenue(tasks) {
  return tasks.reduce((sum, task) => sum + (Number(task.price) || 0), 0);
}

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - day);
  result.setHours(0, 0, 0, 0);
  return result;
}

function isSameWeek(left, right) {
  if (!left || Number.isNaN(left.getTime())) return false;
  return getDateKey(startOfWeek(left)) === getDateKey(startOfWeek(right));
}

function isSameMonth(left, right) {
  if (!left || Number.isNaN(left.getTime())) return false;
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function buildCalendarDays(cursor) {
  const first = startOfMonth(cursor);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function formatMoney(value) {
  return `${Math.round(Number(value) || 0).toLocaleString("tr-TR")} TL`;
}

function formatTime(date) {
  return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateHuman(date) {
  return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function applyLoginParams() {
  const params = new URLSearchParams(window.location.search);
  const username = params.get("username");
  const password = params.get("password");
  if (username) els.loginUsername.value = username;
  if (password) els.loginPassword.value = password;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function setStandaloneMode() {
  if (isStandalone()) {
    document.body.classList.add("is-standalone");
  }
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  });
}
