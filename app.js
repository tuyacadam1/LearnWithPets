const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzReMeuhTNzHlzNBA6BvldLcGLNTLsOBf6-zunyHc6cdk1u5Mt3hBkfur8XY9ZPK22n/exec';

// Built-in game loot icons so you can click-and-add immediately
const PRESET_LOOT = [
  'https://cdn-icons-png.flaticon.com/512/2583/2583344.png', // Gold Medal
  'https://cdn-icons-png.flaticon.com/512/1828/1828884.png', // Star
  'https://cdn-icons-png.flaticon.com/512/616/616490.png',   // Gem
  'https://cdn-icons-png.flaticon.com/512/2583/2583319.png', // Trophy
  'https://cdn-icons-png.flaticon.com/512/3176/3176366.png', // Crown
  'https://cdn-icons-png.flaticon.com/512/869/869869.png',   // Potion
  'https://cdn-icons-png.flaticon.com/512/1067/1067357.png', // Treasure Chest
  'https://cdn-icons-png.flaticon.com/512/3209/3209993.png'  // Gift Box
];

let state = { teacher: null, classes: [], students: [], gachaPool: [] };

const toggleLoader = (show) => document.getElementById('loader').classList.toggle('hidden', !show);

// Initialize preset icon buttons
const iconPicker = document.getElementById('preset-icons');
const urlInput = document.getElementById('gacha-img-url');
urlInput.value = PRESET_LOOT[0];

PRESET_LOOT.forEach((url, idx) => {
  const img = document.createElement('img');
  img.src = url;
  img.className = 'icon-option' + (idx === 0 ? ' selected' : '');
  img.onclick = () => {
    document.querySelectorAll('.icon-option').forEach(el => el.classList.remove('selected'));
    img.classList.add('selected');
    urlInput.value = url;
  };
  iconPicker.appendChild(img);
});

async function callGAS(action, payload = {}) {
  try {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload })
    });
    return await response.json();
  } catch (error) {
    alert('Connection error!');
    return { success: false };
  }
}

// --- LOGIN / LOGOUT ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  toggleLoader(true);
  const res = await callGAS('login', {
    username: document.getElementById('login-username').value.trim(),
    password: document.getElementById('login-password').value.trim()
  });
  
  if (res.success) {
    state.teacher = res.teacher;
    document.getElementById('teacher-display-name').textContent = res.teacher.name;
    await loadDashboardData();
  } else {
    toggleLoader(false);
    document.getElementById('login-error').textContent = res.message;
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  state = { teacher: null, classes: [], students: [], gachaPool: [] };
  document.getElementById('dashboard-view').classList.add('hidden');
  document.getElementById('login-view').classList.remove('hidden');
});

async function loadDashboardData() {
  const res = await callGAS('getData', { teacherId: state.teacher.id });
  if (res.success) {
    state.classes = res.classes;
    state.students = res.students;
    state.gachaPool = res.gachaPool;
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.remove('hidden');
    renderAll();
  }
  toggleLoader(false);
}

// --- BIG MENU NAVIGATION ---
document.querySelectorAll('.menu-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
  });
});

function renderAll() {
  populateDropdowns();
  renderClasses();
  renderStudents();
  renderPoints();
  renderGacha();
}

function populateDropdowns() {
  document.querySelectorAll('.class-selector').forEach(sel => {
    const prev = sel.value;
    sel.innerHTML = state.classes.length
      ? state.classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')
      : '<option value="">No Classes Yet</option>';
    if (state.classes.some(c => c.id === prev)) sel.value = prev;
  });
}

// --- 1. CLASSES ---
document.getElementById('add-class-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('new-class-name');
  toggleLoader(true);
  const res = await callGAS('addClass', { teacherId: state.teacher.id, className: input.value.trim() });
  if (res.success) {
    state.classes.push(res.data);
    input.value = '';
    renderAll();
  }
  toggleLoader(false);
});

function renderClasses() {
  document.getElementById('classes-grid').innerHTML = state.classes.map(c => {
    const count = state.students.filter(s => s.classId === c.id).length;
    return `
      <div class="item-card">
        <div>
          <h4>🏰 ${c.name}</h4>
          <p class="item-meta">${count} Players</p>
        </div>
        <button class="game-btn btn-red btn-sm" onclick="removeClass('${c.id}')">DELETE</button>
      </div>
    `;
  }).join('');
}

window.removeClass = async (classId) => {
  toggleLoader(true);
  const res = await callGAS('deleteClass', { classId });
  if (res.success) {
    state.classes = state.classes.filter(c => c.id !== classId);
    renderAll();
  }
  toggleLoader(false);
};

// --- 2. STUDENTS ---
document.getElementById('student-class-filter').addEventListener('change', renderStudents);

document.getElementById('add-student-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const classId = document.getElementById('student-class-filter').value;
  if (!classId) return alert('Create a class first!');
  const name = document.getElementById('new-student-name').value.trim();
  const points = document.getElementById('new-student-points').value;

  toggleLoader(true);
  const res = await callGAS('addStudent', { classId, name, points });
  if (res.success) {
    state.students.push(res.data);
    document.getElementById('new-student-name').value = '';
    renderAll();
  }
  toggleLoader(false);
});

function renderStudents() {
  const classId = document.getElementById('student-class-filter').value;
  const list = state.students.filter(s => s.classId === classId);
  document.getElementById('students-grid').innerHTML = list.map(s => `
    <div class="item-card">
      <div>
        <h4>👾 ${s.name}</h4>
        <p class="item-meta">${s.points} PTS</p>
      </div>
      <button class="game-btn btn-red btn-sm" onclick="removeStudent('${s.id}')">KICK</button>
    </div>
  `).join('');
}

window.removeStudent = async (studentId) => {
  toggleLoader(true);
  const res = await callGAS('deleteStudent', { studentId });
  if (res.success) {
    state.students = state.students.filter(s => s.id !== studentId);
    renderAll();
  }
  toggleLoader(false);
};

// --- 3. POINTS ---
document.getElementById('points-class-filter').addEventListener('change', renderPoints);

function renderPoints() {
  const classId = document.getElementById('points-class-filter').value;
  const list = state.students.filter(s => s.classId === classId);
  document.getElementById('points-grid').innerHTML = list.map(s => `
    <div class="item-card">
      <div>
        <h4>${s.name}</h4>
        <div class="points-score">${s.points} ⭐</div>
      </div>
      <div class="pt-btn-row">
        <button class="game-btn btn-green btn-sm" onclick="changePoints('${s.id}', 1)">+1</button>
        <button class="game-btn btn-green btn-sm" onclick="changePoints('${s.id}', 5)">+5</button>
        <button class="game-btn btn-red btn-sm" onclick="changePoints('${s.id}', -1)">-1</button>
      </div>
    </div>
  `).join('');
}

window.changePoints = async (studentId, delta) => {
  toggleLoader(true);
  const res = await callGAS('updatePoints', { studentId, delta });
  if (res.success) {
    const s = state.students.find(st => st.id === studentId);
    if (s) s.points = res.newPoints;
    renderStudents();
    renderPoints();
  }
  toggleLoader(false);
};

// --- 4. GACHA POOL (1-CLICK RARITY BUTTONS) ---
window.quickAddGacha = async (rarity) => {
  const imageUrl = document.getElementById('gacha-img-url').value.trim();
  if (!imageUrl) return alert('Pick an icon or paste an image link first!');

  toggleLoader(true);
  const res = await callGAS('addGacha', {
    teacherId: state.teacher.id,
    rarity,
    imageUrl
  });
  if (res.success) {
    state.gachaPool.push(res.data);
    renderGacha();
  }
  toggleLoader(false);
};

function renderGacha() {
  document.getElementById('gacha-grid').innerHTML = state.gachaPool.map(item => `
    <div class="item-card">
      <img src="${item.imageUrl}" class="gacha-img" alt="Loot">
      <div>
        <span class="badge ${item.rarity}">${item.rarity}</span>
        <p class="item-meta" style="margin-top:6px;">${item.dropRate}% CHANCE</p>
      </div>
      <button class="game-btn btn-red btn-sm" onclick="removeGacha('${item.id}')">DELETE</button>
    </div>
  `).join('');
}

window.removeGacha = async (itemId) => {
  toggleLoader(true);
  const res = await callGAS('deleteGacha', { itemId });
  if (res.success) {
    state.gachaPool = state.gachaPool.filter(g => g.id !== itemId);
    renderGacha();
  }
  toggleLoader(false);
};
