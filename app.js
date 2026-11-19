const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzReMeuhTNzHlzNBA6BvldLcGLNTLsOBf6-zunyHc6cdk1u5Mt3hBkfur8XY9ZPK22n/exec';

const RARITY_CHANCES = {
  Common: 45,
  Uncommon: 28,
  Rare: 15,
  Epic: 8,
  Mythic: 3,
  Legend: 1
};

let state = {
  teacher: null,
  classes: [],
  students: [],
  gachaPool: []
};

const toggleLoader = (show) => {
  document.getElementById('loader').classList.toggle('hidden', !show);
};

// --- API HELPER ---
async function callGAS(action, payload = {}) {
  try {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({ action, payload })
    });
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    alert('Network error communicating with Google Sheets.');
    return { success: false };
  }
}

// --- LOGIN & LOGOUT ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();
  
  toggleLoader(true);
  const res = await callGAS('login', { username, password });
  
  if (res.success) {
    state.teacher = res.teacher;
    document.getElementById('teacher-display-name').textContent = res.teacher.name;
    document.getElementById('login-error').textContent = '';
    await loadDashboardData();
  } else {
    toggleLoader(false);
    document.getElementById('login-error').textContent = res.message || 'Login failed.';
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  state = { teacher: null, classes: [], students: [], gachaPool: [] };
  document.getElementById('dashboard-view').classList.add('hidden');
  document.getElementById('login-view').classList.remove('hidden');
  document.getElementById('login-form').reset();
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

// --- NAVIGATION ---
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
  });
});

function renderAll() {
  populateClassDropdowns();
  renderClasses();
  renderStudents();
  renderPoints();
  renderGacha();
}

function populateClassDropdowns() {
  const selectors = document.querySelectorAll('.class-selector');
  selectors.forEach(sel => {
    const currentVal = sel.value;
    sel.innerHTML = state.classes.length 
      ? state.classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')
      : '<option value="">No classes available</option>';
    if (state.classes.some(c => c.id === currentVal)) sel.value = currentVal;
  });
}

// --- 1. MANAGE CLASSES ---
document.getElementById('add-class-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('new-class-name');
  const className = input.value.trim();
  
  toggleLoader(true);
  const res = await callGAS('addClass', { teacherId: state.teacher.id, className });
  if (res.success) {
    state.classes.push(res.data);
    input.value = '';
    renderAll();
  }
  toggleLoader(false);
});

function renderClasses() {
  const grid = document.getElementById('classes-grid');
  grid.innerHTML = state.classes.map(c => {
    const count = state.students.filter(s => s.classId === c.id).length;
    return `
      <div class="item-card">
        <div>
          <h4>${c.name}</h4>
          <p class="item-meta">ID: ${c.id} • ${count} Students</p>
        </div>
        <button class="btn btn-danger" onclick="removeClass('${c.id}')">Delete Class</button>
      </div>
    `;
  }).join('');
}

window.removeClass = async (classId) => {
  if (!confirm('Delete this class?')) return;
  toggleLoader(true);
  const res = await callGAS('deleteClass', { classId });
  if (res.success) {
    state.classes = state.classes.filter(c => c.id !== classId);
    renderAll();
  }
  toggleLoader(false);
};

// --- 2. MANAGE STUDENTS ---
document.getElementById('student-class-filter').addEventListener('change', renderStudents);

document.getElementById('add-student-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const classId = document.getElementById('add-student-class').value;
  const name = document.getElementById('new-student-name').value.trim();
  const pts = document.getElementById('new-student-points').value;
  if (!classId) return alert('Create a class first.');

  toggleLoader(true);
  const res = await callGAS('addStudent', { classId, name, points: pts });
  if (res.success) {
    state.students.push(res.data);
    document.getElementById('new-student-name').value = '';
    renderAll();
  }
  toggleLoader(false);
});

function renderStudents() {
  const selectedClass = document.getElementById('student-class-filter').value;
  const filtered = state.students.filter(s => s.classId === selectedClass);
  const tbody = document.getElementById('students-table-body');

  tbody.innerHTML = filtered.map(s => {
    const cls = state.classes.find(c => c.id === s.classId);
    return `
      <tr>
        <td>${s.id}</td>
        <td><strong>${s.name}</strong></td>
        <td>${cls ? cls.name : '-'}</td>
        <td>${s.points} pts</td>
        <td><button class="btn btn-danger" onclick="removeStudent('${s.id}')">Remove</button></td>
      </tr>
    `;
  }).join('');
}

window.removeStudent = async (studentId) => {
  if (!confirm('Remove this student?')) return;
  toggleLoader(true);
  const res = await callGAS('deleteStudent', { studentId });
  if (res.success) {
    state.students = state.students.filter(s => s.id !== studentId);
    renderAll();
  }
  toggleLoader(false);
};

// --- 3. MANAGE POINTS ---
document.getElementById('points-class-filter').addEventListener('change', renderPoints);

function renderPoints() {
  const selectedClass = document.getElementById('points-class-filter').value;
  const filtered = state.students.filter(s => s.classId === selectedClass);
  const grid = document.getElementById('points-grid');

  grid.innerHTML = filtered.map(s => `
    <div class="item-card">
      <div>
        <h4>${s.name}</h4>
        <div class="points-display" id="pts-${s.id}">${s.points} pts</div>
      </div>
      <div class="points-actions">
        <button class="btn-pt btn-plus" onclick="changePoints('${s.id}', 1)">+1</button>
        <button class="btn-pt btn-plus" onclick="changePoints('${s.id}', 5)">+5</button>
        <button class="btn-pt btn-plus" onclick="changePoints('${s.id}', 10)">+10</button>
        <button class="btn-pt btn-minus" onclick="changePoints('${s.id}', -1)">-1</button>
        <button class="btn-pt btn-minus" onclick="changePoints('${s.id}', -5)">-5</button>
      </div>
    </div>
  `).join('');
}

window.changePoints = async (studentId, delta) => {
  toggleLoader(true);
  const res = await callGAS('updatePoints', { studentId, delta });
  if (res.success) {
    const student = state.students.find(s => s.id === studentId);
    if (student) student.points = res.newPoints;
    renderStudents();
    renderPoints();
  }
  toggleLoader(false);
};

// --- 4. MANAGE GACHA POOL ---
document.getElementById('gacha-rarity').addEventListener('change', (e) => {
  const chance = RARITY_CHANCES[e.target.value] || 45;
  document.getElementById('auto-chance-display').textContent = `Auto Chance: ${chance}%`;
});

document.getElementById('gacha-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  const preview = document.getElementById('gacha-preview');
  if (file) {
    preview.src = URL.createObjectURL(file);
    preview.classList.remove('hidden');
  } else {
    preview.classList.add('hidden');
  }
});

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

document.getElementById('add-gacha-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById('gacha-file');
  const file = fileInput.files[0];
  if (!file) return alert('Please select an image first.');

  const rarity = document.getElementById('gacha-rarity').value;

  toggleLoader(true);
  try {
    const imageBase64 = await readFileAsBase64(file);
    const res = await callGAS('addGacha', {
      teacherId: state.teacher.id,
      rarity,
      imageBase64,
      mimeType: file.type,
      fileName: file.name
    });

    if (res.success) {
      state.gachaPool.push(res.data);
      document.getElementById('add-gacha-form').reset();
      document.getElementById('gacha-preview').classList.add('hidden');
      document.getElementById('auto-chance-display').textContent = 'Auto Chance: 45%';
      renderGacha();
    }
  } catch (err) {
    console.error(err);
    alert('Failed to upload image.');
  }
  toggleLoader(false);
});

function renderGacha() {
  const grid = document.getElementById('gacha-grid');
  document.getElementById('gacha-count').textContent = state.gachaPool.length;

  grid.innerHTML = state.gachaPool.map(item => `
    <div class="item-card">
      <img src="${item.imageUrl}" alt="${item.rarity} reward" class="gacha-card-img">
      <div class="gacha-card-footer">
        <div>
          <span class="badge ${item.rarity}">${item.rarity}</span>
          <p class="item-meta" style="margin-top:6px;">Chance: <strong>${item.dropRate}%</strong></p>
        </div>
        <button class="btn btn-danger" onclick="removeGacha('${item.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

window.removeGacha = async (itemId) => {
  if (!confirm('Delete this reward from the pool?')) return;
  toggleLoader(true);
  const res = await callGAS('deleteGacha', { itemId });
  if (res.success) {
    state.gachaPool = state.gachaPool.filter(g => g.id !== itemId);
    renderGacha();
  }
  toggleLoader(false);
};
