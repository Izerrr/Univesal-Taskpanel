import { auth, db, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where } from "./firebase.js";

// Global State
let currentUser = null;
let tasks = [];
let unsubscribeTasks = null;

let calendarInstance = null;
let chartCompletion = null;
let chartPriority = null;

// Elements
const authScreen = document.getElementById("auth-screen");
const authForm = document.getElementById("auth-form");
const authError = document.getElementById("auth-error");
const btnLogout = document.getElementById("btn-logout");
const modal = document.getElementById("task-modal");
const modalContent = document.getElementById("task-modal-content");
const form = document.getElementById("task-form");

// Toast Notification
window.showToast = function (message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  const toastMsg = document.getElementById("toast-message");
  if (toastMsg) toastMsg.textContent = message;
  toast.classList.remove("translate-y-20", "opacity-0");
  setTimeout(() => toast.classList.add("translate-y-20", "opacity-0"), 3000);
};

// Pantau Status Login (Auth Listener)
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Berhasil Login
    currentUser = user;
    if (authScreen) authScreen.classList.add("hidden");

    // Update UI Profil
    const email = user.email || "Pengguna";
    const userEmailDisplay = document.getElementById("user-email-display");
    const userAvatar = document.getElementById("user-avatar");
    if (userEmailDisplay) userEmailDisplay.textContent = email;
    if (userAvatar) userAvatar.textContent = email.charAt(0).toUpperCase();

    // Mulai ambil data dari Firestore (Real-time)
    listenToTasks(user.uid);
  } else {
    // Logout / Belum Login
    currentUser = null;
    if (authScreen) authScreen.classList.remove("hidden");

    // Matikan listener data agar tidak bocor memory
    if (unsubscribeTasks) unsubscribeTasks();
    tasks = [];
    renderBoard();
  }
});

// Handle Login/Daftar
if (authForm) {
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("auth-email").value;
    const password = document.getElementById("auth-password").value;
    const btn = document.getElementById("auth-submit-btn");

    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Memproses...`;
    btn.disabled = true;
    if (authError) authError.classList.add("hidden");

    try {
      // Coba masuk dulu
      await signInWithEmailAndPassword(auth, email, password);
      window.showToast("Berhasil masuk!");
    } catch (error) {
      // Jika error "User not found" atau invalid credentials pada akun baru, coba daftarkan
      if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found") {
        try {
          await createUserWithEmailAndPassword(auth, email, password);
          window.showToast("Akun baru berhasil dibuat & masuk!");
        } catch (regError) {
          if (authError) {
            authError.textContent = "Gagal: " + regError.message;
            authError.classList.remove("hidden");
          }
        }
      } else {
        if (authError) {
          authError.textContent = "Error: " + error.message;
          authError.classList.remove("hidden");
        }
      }
    } finally {
      btn.innerHTML = `<span>Masuk / Daftar</span>`;
      btn.disabled = false;
    }
  });
}

if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.showToast("Anda telah keluar");
    } catch (err) {
      console.error(err);
    }
  });
}

// Real-time Firestore Listener
function listenToTasks(userId) {
  const q = query(collection(db, "tasks"), where("userId", "==", userId));

  unsubscribeTasks = onSnapshot(
    q,
    (snapshot) => {
      tasks = [];
      snapshot.forEach((docSnap) => {
        tasks.push({ id: docSnap.id, ...docSnap.data() });
      });

      // Urutkan berdasarkan waktu di memori (terbaru di bawah)
      tasks.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

      renderBoard();
      const calendarView = document.getElementById("view-calendar");
      if (calendarView && !calendarView.classList.contains("hidden")) updateCalendarEvents();
      const analyticsView = document.getElementById("view-analytics");
      if (analyticsView && !analyticsView.classList.contains("hidden")) renderCharts();
    },
    (error) => {
      console.error("Error fetching data: ", error);
      window.showToast("Gagal menyinkronkan data");
    },
  );
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const title = document.getElementById("input-title").value.trim();
    const subject = document.getElementById("input-subject").value.trim();
    const priority = document.getElementById("input-priority").value;
    const deadline = document.getElementById("input-date").value || null;

    window.closeModal();

    try {
      await addDoc(collection(db, "tasks"), {
        userId: currentUser.uid,
        title: title,
        subject: subject,
        type: priority,
        completed: false,
        deadline: deadline,
        createdAt: Date.now(),
      });
      window.showToast("Tugas ditambahkan");
    } catch (error) {
      console.error("Gagal menambah:", error);
      window.showToast("Gagal menyimpan tugas");
    }
  });
}

window.toggleComplete = async function (id) {
  if (!currentUser) return;
  const task = tasks.find((t) => t.id === id);
  if (task) {
    try {
      await updateDoc(doc(db, "tasks", id), { completed: !task.completed });
    } catch (err) {
      console.error(err);
    }
  }
};

window.deleteTask = async function (id) {
  if (!currentUser) return;
  try {
    await deleteDoc(doc(db, "tasks", id));
    window.showToast("Tugas dihapus");
  } catch (err) {
    console.error(err);
  }
};

window.togglePriority = async function (id) {
  if (!currentUser) return;
  const task = tasks.find((t) => t.id === id);
  if (task && !task.completed) {
    const newType = task.type === "urgent" ? "relaxed" : "urgent";
    try {
      await updateDoc(doc(db, "tasks", id), { type: newType });
    } catch (err) {
      console.error(err);
    }
  }
};

window.updateTaskStatus = async function (id, newStatusColumn) {
  if (!currentUser) return;
  const task = tasks.find((t) => t.id === id);
  if (!task) return;

  let updates = {};
  if (newStatusColumn === "completed") updates = { completed: true };
  else if (newStatusColumn === "urgent") updates = { completed: false, type: "urgent" };
  else if (newStatusColumn === "relaxed") updates = { completed: false, type: "relaxed" };

  try {
    await updateDoc(doc(db, "tasks", id), updates);
  } catch (err) {
    console.error(err);
  }
};

// UI Helpers
window.switchView = function (viewName) {
  document.querySelectorAll(".view-section").forEach((el) => el.classList.add("hidden"));
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.remove("bg-izer-accent/10", "text-izer-accent");
    btn.classList.add("text-izer-muted");
  });
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    targetView.classList.remove("hidden", "animate-fade-in");
    void targetView.offsetWidth;
    targetView.classList.add("animate-fade-in");
  }

  const activeBtn = document.querySelector(`.nav-btn[data-target="${viewName}"]`);
  if (activeBtn) {
    activeBtn.classList.remove("text-muted");
    activeBtn.classList.add("bg-izer-accent/10", "text-izer-accent");
  }

  const titles = { board: "Dashboard Tugas", calendar: "Kalender Tugas", analytics: "Analitik Produktivitas" };
  const headerTitle = document.getElementById("header-title");
  if (headerTitle && titles[viewName]) {
    headerTitle.textContent = titles[viewName];
  }

  if (viewName === "calendar") setTimeout(initCalendar, 100);
  if (viewName === "analytics") renderCharts();
  if (window.innerWidth < 768) window.toggleSidebar(true);
};

window.toggleSidebar = function (forceClose = false) {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("mobile-overlay");
  if (!sidebar) return;
  if (forceClose) {
    sidebar.classList.add("-translate-x-full");
    if (overlay) overlay.classList.add("hidden");
  } else {
    sidebar.classList.toggle("-translate-x-full");
    if (overlay) overlay.classList.toggle("hidden");
  }
};

window.openModal = function (presetDate = null) {
  if (!modal || !modalContent) return;
  modal.classList.remove("hidden");
  setTimeout(() => modalContent.classList.replace("scale-95", "scale-100"), 10);
  if (presetDate) {
    const inputDate = document.getElementById("input-date");
    if (inputDate) inputDate.value = presetDate;
  }
  const inputTitle = document.getElementById("input-title");
  if (inputTitle) inputTitle.focus();
};

window.closeModal = function () {
  if (!modal || !modalContent) return;
  modalContent.classList.replace("scale-100", "scale-95");
  setTimeout(() => {
    modal.classList.add("hidden");
    if (form) form.reset();
  }, 200);
};

function renderBoard() {
  const columns = document.querySelectorAll(".kanban-column");
  columns.forEach((col) => (col.innerHTML = ""));
  let counts = { urgent: 0, relaxed: 0, completed: 0, total: tasks.length };

  tasks.forEach((task) => {
    let targetColSelector = "";
    if (task.completed) {
      targetColSelector = '[data-status="completed"]';
      counts.completed++;
    } else if (task.type === "urgent") {
      targetColSelector = '[data-status="urgent"]';
      counts.urgent++;
    } else {
      targetColSelector = '[data-status="relaxed"]';
      counts.relaxed++;
    }

    const columnEl = document.querySelector(targetColSelector);
    const isDone = task.completed;

    const typeStyles = {
      urgent: { badge: "bg-urgent-bg text-urgent-main border-urgent-main/20", border: "border-l-urgent-main" },
      relaxed: { badge: "bg-relaxed-bg text-relaxed-main border-relaxed-main/20", border: "border-l-relaxed-main" },
      completed: { badge: "bg-slate-800 text-izer-muted border-slate-700", border: "border-l-done-main bg-slate-800/50" },
    };

    const style = isDone ? typeStyles.completed : typeStyles[task.type] || typeStyles.relaxed;

    let dateHtml = "";
    if (task.deadline) {
      const d = new Date(task.deadline);
      const formattedDate = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
      const isOverdue = !isDone && new Date(task.deadline).getTime() < new Date().setHours(0, 0, 0, 0);
      dateHtml = `<span class="text-xs ${isOverdue ? "text-red-400 font-bold" : "text-izer-muted"} flex items-center gap-1.5"><i class="fa-regular fa-calendar"></i> ${formattedDate}</span>`;
    }

    const card = document.createElement("div");
    card.className = `task-card bg-izer-card border border-slate-700 border-l-[3px] ${style.border} rounded-xl p-4 shadow-lg hover:shadow-xl flex flex-col gap-3 group`;
    card.draggable = true;
    card.dataset.id = task.id;

    card.innerHTML = `
      <div class="flex justify-between items-start">
          <button onclick="${isDone ? "" : `togglePriority('${task.id}')`}" 
                  class="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${style.badge} transition-all ${isDone ? "" : "hover:scale-105 cursor-pointer"}">
              ${task.subject || "Umum"}
          </button>
          <button onclick="deleteTask('${task.id}')" class="text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1">
              <i class="fa-solid fa-trash-can text-sm"></i>
          </button>
      </div>
      <h4 class="font-semibold text-white leading-snug ${isDone ? "line-through text-slate-500" : ""}">${task.title}</h4>
      <div class="flex justify-between items-end mt-auto pt-2 border-t border-slate-700/50">
          ${dateHtml}
          <div class="ml-auto flex items-center gap-2">
              <span class="text-[10px] text-izer-muted font-medium uppercase tracking-wide">${isDone ? "Selesai" : "Tandai"}</span>
              <input type="checkbox" class="custom-checkbox" ${isDone ? "checked" : ""} onchange="toggleComplete('${task.id}')">
          </div>
      </div>
    `;

    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", e.currentTarget.dataset.id);
      e.currentTarget.classList.add("dragging");
    });
    card.addEventListener("dragend", (e) => e.currentTarget.classList.remove("dragging"));
    if (columnEl) columnEl.appendChild(card);
  });

  const statTotal = document.getElementById("stat-total");
  const statUrgent = document.getElementById("stat-urgent");
  const statRelaxed = document.getElementById("stat-relaxed");
  const statDone = document.getElementById("stat-done");
  const countUrgent = document.getElementById("count-urgent");
  const countRelaxed = document.getElementById("count-relaxed");
  const countDone = document.getElementById("count-done");

  if (statTotal) statTotal.textContent = counts.total;
  if (statUrgent) statUrgent.textContent = counts.urgent;
  if (statRelaxed) statRelaxed.textContent = counts.relaxed;
  if (statDone) statDone.textContent = counts.completed;
  if (countUrgent) countUrgent.textContent = counts.urgent;
  if (countRelaxed) countRelaxed.textContent = counts.relaxed;
  if (countDone) countDone.textContent = counts.completed;
}

// Drag & Drop event untuk kolom Kanban
document.querySelectorAll(".kanban-column").forEach((col) => {
  col.addEventListener("dragover", (e) => {
    e.preventDefault();
    col.classList.add("drag-over");
  });
  col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
  col.addEventListener("drop", (e) => {
    e.preventDefault();
    col.classList.remove("drag-over");
    const id = e.dataTransfer.getData("text/plain");
    if (id) window.updateTaskStatus(id, col.dataset.status);
  });
});

function initCalendar() {
  if (calendarInstance) {
    calendarInstance.render();
    return;
  }
  const calendarEl = document.getElementById("calendar-el");
  if (!calendarEl || typeof FullCalendar === "undefined") return;

  calendarInstance = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "id",
    headerToolbar: { left: "prev,next today", center: "title", right: "dayGridMonth,dayGridWeek" },
    height: "100%",
    dateClick: function (info) {
      window.openModal(info.dateStr);
    },
    eventClick: function (info) {
      window.toggleComplete(info.event.id);
    },
  });
  calendarInstance.render();
  updateCalendarEvents();
}

function updateCalendarEvents() {
  if (!calendarInstance) return;
  calendarInstance.removeAllEvents();
  const events = tasks
    .filter((t) => t.deadline)
    .map((t) => {
      let color = "#3b82f6";
      if (t.completed) color = "#10b981";
      else if (t.type === "urgent") color = "#f43f5e";
      return { id: t.id, title: t.title, start: t.deadline, backgroundColor: color, borderColor: color, textColor: "#ffffff" };
    });
  calendarInstance.addEventSource(events);
}

function renderCharts() {
  if (typeof Chart === "undefined") return;
  Chart.defaults.color = "#94a3b8";
  Chart.defaults.font.family = '"Plus Jakarta Sans", sans-serif';

  const doneCount = tasks.filter((t) => t.completed).length;
  const pendingCount = tasks.length - doneCount;
  const urgentCount = tasks.filter((t) => !t.completed && t.type === "urgent").length;
  const relaxedCount = tasks.filter((t) => !t.completed && t.type === "relaxed").length;

  const canvasCompletion = document.getElementById("chart-completion");
  if (canvasCompletion) {
    const ctxCompletion = canvasCompletion.getContext("2d");
    if (chartCompletion) chartCompletion.destroy();
    chartCompletion = new Chart(ctxCompletion, {
      type: "doughnut",
      data: {
        labels: ["Selesai", "Belum Selesai"],
        datasets: [{ data: [doneCount, pendingCount], backgroundColor: ["#10b981", "#334155"], borderWidth: 0 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "75%",
        plugins: { legend: { position: "bottom" } },
      },
    });
  }

  const canvasPriority = document.getElementById("chart-priority");
  if (canvasPriority) {
    const ctxPriority = canvasPriority.getContext("2d");
    if (chartPriority) chartPriority.destroy();
    chartPriority = new Chart(ctxPriority, {
      type: "bar",
      data: {
        labels: ["Mendesak", "Bisa Nanti"],
        datasets: [{ label: "Jumlah Tugas", data: [urgentCount, relaxedCount], backgroundColor: ["#f43f5e", "#3b82f6"], borderRadius: 6 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } },
          x: { grid: { display: false } },
        },
      },
    });
  }
}
