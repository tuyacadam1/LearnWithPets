const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzReMeuhTNzHlzNBA6BvldLcGLNTLsOBf6-zunyHc6cdk1u5Mt3hBkfur8XY9ZPK22n/exec';

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
        'Content-Type': 'text/plain;charset=utf-8' // Avoids CORS preflight issues with GAS
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
  const points = document.getElementById('new-student-points').value;
  if (!classId) return alert('Create a class first.');

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
document.getElementById('add-gacha-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const item = {
    name: document.getElementById('gacha-name').value.trim(),
    rarity: document.getElementById('gacha-rarity').value,
    dropRate: document.getElementById('gacha-rate').value,
    imageUrl: document.getElementById('gacha-img').value.trim()
  };

  toggleLoader(true);
  const res = await callGAS('addGacha', { teacherId: state.teacher.id, item });
  if (res.success) {
    state.gachaPool.push(res.data);
    document.getElementById('add-gacha-form').reset();
    renderGacha();
  }
  toggleLoader(false);
});

function renderGacha() {
  const grid = document.getElementById('gacha-grid');
  let totalRate = 0;

  grid.innerHTML = state.gachaPool.map(item => {
    totalRate += Number(item.dropRate);
    return `
      <div class="item-card">
        <div>
          <span class="badge ${item.rarity}">${item.rarity}</span>
          <h4 style="margin-top:8px;">${item.name}</h4>
          <p class="item-meta">Drop Rate: <strong>${item.dropRate}%</strong></p>
        </div>
        <button class="btn btn-danger" onclick="removeGacha('${item.id}')">Delete Reward</button>
      </div>
    `;
  }).join('');

  const rateSpan = document.getElementById('total-drop-rate');
  rateSpan.textContent = totalRate;
  rateSpan.style.color = totalRate === 100 ? 'var(--success)' : 'var(--danger)';
}

window.removeGacha = async (itemId) => {
  if (!confirm('Delete this reward?')) return;
  toggleLoader(true);
  const res = await callGAS('deleteGacha', { itemId });
  if (res.success) {
    state.gachaPool = state.gachaPool.filter(g => g.id !== itemId);
    renderGacha();
  }
  toggleLoader(false);
};
