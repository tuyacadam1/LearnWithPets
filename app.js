const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzReMeuhTNzHlzNBA6BvldLcGLNTLsOBf6-zunyHc6cdk1u5Mt3hBkfur8XY9ZPK22n/exec';

let state = {
  teacher: null,
  classes: [],
  students: [],
  gachaPool: [],
  taskRecords: [],
  activeClassId: ''
};

const toggleLoader = (show) => document.getElementById('loader').classList.toggle('hidden', !show);

async function callGAS(action, payload = {}) {
  try {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload })
    });
    return await response.json();
  } catch (err) {
    return { success: false, message: 'Network error connecting to server.' };
  }
}

// --- LOGIN / LOGOUT / REFRESH ---
document.getElementById('teacher-login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();

  toggleLoader(true);
  const res = await callGAS('login', { username, password });
  if (res.success) {
    state.teacher = res.teacher;
    document.getElementById('login-error').textContent = '';
    document.getElementById('teacher-welcome').textContent = `Welcome, ${state.teacher.name}!`;
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.remove('hidden');
    await syncTeacherData();
  } else {
    document.getElementById('login-error').textContent = res.message || 'Login failed!';
  }
  toggleLoader(false);
});

document.getElementById('logout-btn').addEventListener('click', () => {
  state.teacher = null;
  state.classes = [];
  state.students = [];
  state.gachaPool = [];
  state.taskRecords = [];
  document.getElementById('dashboard-view').classList.add('hidden');
  document.getElementById('login-view').classList.remove('hidden');
});

async function syncTeacherData() {
  if (!state.teacher) return;
  const res = await callGAS('getData', { teacherId: state.teacher.id });
  if (res && res.success) {
    state.classes = res.classes || [];
    state.students = res.students || [];
    state.gachaPool = res.gachaPool || [];
    state.taskRecords = res.taskRecords || [];

    if (!state.classes.some(c => c.id === state.activeClassId)) {
      state.activeClassId = state.classes[0] ? state.classes[0].id : '';
    }

    renderClassSelectors();
    renderStudents();
    renderTaskStudents();
    renderGachaPool();
  }
}

document.getElementById('refresh-teacher-btn').addEventListener('click', async () => {
  const btn = document.getElementById('refresh-teacher-btn');
  btn.disabled = true;
  btn.textContent = '⏳ SYNCING...';
  toggleLoader(true);
  await syncTeacherData();
  toggleLoader(false);
  btn.disabled = false;
  btn.textContent = '🔄 REFRESH';
});

// --- TABS ---
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
  });
});

// --- CLASSES ---
document.getElementById('add-class-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const className = document.getElementById('new-class-name').value.trim();
  if (!className) return;

  toggleLoader(true);
  const res = await callGAS('addClass', { teacherId: state.teacher.id, className });
  if (res.success) {
    state.classes.push(res.data);
    state.activeClassId = res.data.id;
    document.getElementById('new-class-name').value = '';
    renderClassSelectors();
    renderStudents();
    renderTaskStudents();
  }
  toggleLoader(false);
});

function renderClassSelectors() {
  const selectors = [
    document.getElementById('class-selector'),
    document.getElementById('task-class-selector')
  ];

  const optionsHtml = state.classes.length
    ? state.classes.map(c => `<option value="${c.id}" ${c.id === state.activeClassId ? 'selected' : ''}>${c.name}</option>`).join('')
    : '<option value="">No Classes Yet</option>';

  selectors.forEach(sel => {
    if (!sel) return;
    sel.innerHTML = optionsHtml;
    sel.onchange = (e) => {
      state.activeClassId = e.target.value;
      renderClassSelectors();
      renderStudents();
      renderTaskStudents();
    };
  });
}

// --- STUDENTS ---
document.getElementById('add-student-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.activeClassId) return alert('Create or select a class first!');

  const name = document.getElementById('new-student-name').value.trim();
  const points = Number(document.getElementById('new-student-points').value) || 0;

  toggleLoader(true);
  const res = await callGAS('addStudent', { classId: state.activeClassId, name, points });
  if (res.success) {
    state.students.push(res.data);
    document.getElementById('new-student-name').value = '';
    document.getElementById('new-student-points').value = '0';
    renderStudents();
    renderTaskStudents();
  }
  toggleLoader(false);
});

window.removeStudent = async (studentId) => {
  if (!confirm('Delete this student?')) return;
  toggleLoader(true);
  const res = await callGAS('deleteStudent', { studentId });
  if (res.success) {
    state.students = state.students.filter(s => s.id !== studentId);
    renderStudents();
    renderTaskStudents();
  }
  toggleLoader(false);
};

function renderStudents() {
  const list = document.getElementById('students-list');
  const filtered = state.students.filter(s => s.classId === state.activeClassId);

  if (!filtered.length) {
    list.innerHTML = '<p class="hint-text">No students in this class yet.</p>';
    return;
  }

  list.innerHTML = filtered.map(s => `
    <div class="list-row">
      <div>
        <strong>${s.name}</strong>
        <span class="id-pill">${s.id}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="pts-badge">${s.points} ⭐</span>
        <button class="btn btn-danger btn-sm" onclick="removeStudent('${s.id}')">DELETE</button>
      </div>
    </div>
  `).join('');
}

// --- TASK POINTS ---
document.getElementById('bulk-task-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.activeClassId) return alert('Select a class first!');

  const taskName = document.getElementById('task-name-input').value.trim();
  const points = Number(document.getElementById('task-points-input').value) || 0;

  toggleLoader(true);
  const res = await callGAS('bulkRecordTask', {
    classId: state.activeClassId,
    taskName,
    points
  });
  if (res.success) {
    await syncTeacherData();
    alert(`Awarded "${taskName}" (${points} ⭐) to the class!`);
  }
  toggleLoader(false);
});

window.awardSingleStudent = async (studentId) => {
  const taskName = document.getElementById('task-name-input').value.trim() || 'Bonus Task';
  const inputEl = document.getElementById(`pts-input-${studentId}`);
  const points = Number(inputEl.value) || 0;

  toggleLoader(true);
  const res = await callGAS('recordTask', {
    classId: state.activeClassId,
    studentId,
    taskName,
    points
  });
  if (res.success) {
    const stu = state.students.find(s => s.id === studentId);
    if (stu) stu.points = res.newBalance;
    renderStudents();
    renderTaskStudents();
  }
  toggleLoader(false);
};

function renderTaskStudents() {
  const list = document.getElementById('task-students-list');
  const filtered = state.students.filter(s => s.classId === state.activeClassId);

  if (!filtered.length) {
    list.innerHTML = '<p class="hint-text">No students in this class yet.</p>';
    return;
  }

  list.innerHTML = filtered.map(s => `
    <div class="list-row">
      <div>
        <strong>${s.name}</strong>
        <span class="pts-badge" style="margin-left:8px;">${s.points} ⭐</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <input type="number" id="pts-input-${s.id}" value="10" min="0" style="width:90px;padding:6px 10px;">
        <button class="btn btn-success btn-sm" onclick="awardSingleStudent('${s.id}')">SAVE SCORE</button>
      </div>
    </div>
  `).join('');
}

// --- GACHA POOL ---
function compressImage(file, maxSize = 180) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

document.getElementById('add-gacha-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('gacha-name').value.trim();
  const rarity = document.getElementById('gacha-rarity').value;
  const element = document.getElementById('gacha-element').value;
  const file = document.getElementById('gacha-image-file').files[0];
  if (!file) return;

  toggleLoader(true);
  const imageData = await compressImage(file, 180);
  const res = await callGAS('addGacha', {
    teacherId: state.teacher.id,
    name,
    rarity,
    element,
    imageData
  });

  if (res.success) {
    state.gachaPool.push(res.data);
    document.getElementById('add-gacha-form').reset();
    renderGachaPool();
  }
  toggleLoader(false);
});

window.removeGachaItem = async (itemId) => {
  if (!confirm('Remove this creature from the Gacha Pool?')) return;
  toggleLoader(true);
  const res = await callGAS('deleteGacha', { itemId });
  if (res.success) {
    state.gachaPool = state.gachaPool.filter(g => g.id !== itemId);
    renderGachaPool();
  }
  toggleLoader(false);
};

function renderGachaPool() {
  document.getElementById('pool-count').textContent = state.gachaPool.length;
  const grid = document.getElementById('gacha-pool-grid');

  if (!state.gachaPool.length) {
    grid.innerHTML = '<p class="hint-text">No creatures in pool yet.</p>';
    return;
  }

  grid.innerHTML = state.gachaPool.map(item => `
    <div class="gacha-card">
      <img src="${item.imageUrl}" alt="${item.name}">
      <strong>${item.name}</strong>
      <span class="badge ${item.rarity}">${item.rarity} (${item.dropRate}%)</span>
      <span class="sub-text">${item.element}</span>
      <button class="btn btn-danger btn-sm full-width" onclick="removeGachaItem('${item.id}')">REMOVE</button>
    </div>
  `).join('');
}
