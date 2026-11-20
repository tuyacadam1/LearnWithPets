const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzReMeuhTNzHlzNBA6BvldLcGLNTLsOBf6-zunyHc6cdk1u5Mt3hBkfur8XY9ZPK22n/exec';

let state = {
  teacher: null,
  classes: [],
  students: [],
  gachaPool: [],
  taskRecords: [],
  activeClassId: ''
};

const toggleLoader = (show) => {
  const el = document.getElementById('loader');
  if (el) el.classList.toggle('hidden', !show);
};

async function callGAS(action, payload = {}) {
  try {
    const res = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload })
    });
    return await res.json();
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function compressImage(file, maxSize = 360) {
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

// --- LOGIN / LOGOUT / REFRESH ---
document.getElementById('teacher-login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const userEl = document.getElementById('username-input') || e.target.querySelector('input[type="text"]');
  const passEl = document.getElementById('password-input') || e.target.querySelector('input[type="password"]');
  const username = userEl ? userEl.value.trim() : '';
  const password = passEl ? passEl.value.trim() : '';

  toggleLoader(true);
  const res = await callGAS('login', { username, password });
  if (res.success) {
    state.teacher = res.teacher;
    const greetEl = document.getElementById('teacher-greeting');
    if (greetEl) greetEl.textContent = `Welcome, ${res.teacher.name}!`;
    document.getElementById('login-view')?.classList.add('hidden');
    document.getElementById('dashboard-view')?.classList.remove('hidden');
    await syncData();
  } else {
    const errEl = document.getElementById('login-error');
    if (errEl) errEl.textContent = res.message || 'Login failed!';
  }
  toggleLoader(false);
});

document.getElementById('logout-btn')?.addEventListener('click', () => {
  state.teacher = null;
  document.getElementById('dashboard-view')?.classList.add('hidden');
  document.getElementById('login-view')?.classList.remove('hidden');
});

document.getElementById('refresh-teacher-btn')?.addEventListener('click', async () => {
  toggleLoader(true);
  await syncData();
  toggleLoader(false);
});

async function syncData() {
  if (!state.teacher) return;
  const res = await callGAS('getData', { teacherId: state.teacher.id });
  if (!res.success) return;

  state.classes = res.classes || [];
  state.students = res.students || [];
  state.gachaPool = res.gachaPool || [];
  state.taskRecords = res.taskRecords || [];

  if (!state.activeClassId || !state.classes.some(c => c.id === state.activeClassId)) {
    state.activeClassId = state.classes.length > 0 ? state.classes[0].id : '';
  }

  renderAll();
}

// --- NAVIGATION TABS ---
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('hidden', p.id !== `tab-${tabName}`);
  });
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function renderAll() {
  renderClassDropdowns();
  renderClassesAndStudents();
  renderTaskPointsList();
  renderHistoryMatrix();
  renderGachaPool();
}

function renderClassDropdowns() {
  const opts = state.classes.length
    ? state.classes.map(c => `<option value="${c.id}" ${c.id === state.activeClassId ? 'selected' : ''}>${c.name}</option>`).join('')
    : '<option value="">No Classes</option>';

  ['students-class-filter', 'tasks-class-filter', 'history-class-filter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}

['students-class-filter', 'tasks-class-filter', 'history-class-filter'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', (e) => {
    state.activeClassId = e.target.value;
    renderAll();
  });
});

// ================= TAB 1: CLASSES & STUDENTS =================
function renderClassesAndStudents() {
  const chipsWrap = document.getElementById('class-chips-list');
  if (chipsWrap) {
    chipsWrap.innerHTML = state.classes.map(c => `
      <div class="class-chip">
        <span>${c.name}</span>
        <button type="button" class="chip-del" title="Delete Class" onclick="deleteClass('${c.id}')">✕</button>
      </div>
    `).join('');
  }

  const classStudents = state.students.filter(s => s.classId === state.activeClassId);
  const stuList = document.getElementById('students-list');
  if (!stuList) return;

  if (!classStudents.length) {
    stuList.innerHTML = '<p class="helper-text">No students in this class yet.</p>';
    return;
  }

  stuList.innerHTML = classStudents.map(s => `
    <div class="entity-row">
      <div class="entity-left">
        <strong>${s.name}</strong>
        <span class="id-pill">${s.id}</span>
      </div>
      <div class="entity-right">
        <span class="pts-pill">${s.points} ⭐</span>
        <button type="button" class="btn btn-red btn-sm" onclick="deleteStudent('${s.id}')">DELETE</button>
      </div>
    </div>
  `).join('');
}

document.getElementById('add-class-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('new-class-name');
  const className = input ? input.value.trim() : '';
  if (!className) return;
  toggleLoader(true);
  const res = await callGAS('addClass', { teacherId: state.teacher.id, className });
  if (res.success) {
    if (input) input.value = '';
    state.activeClassId = res.data.id;
    await syncData();
  }
  toggleLoader(false);
});

window.deleteClass = async (classId) => {
  if (!confirm('Delete this class?')) return;
  toggleLoader(true);
  await callGAS('deleteClass', { classId });
  await syncData();
  toggleLoader(false);
};

document.getElementById('add-student-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.activeClassId) return alert('Create a class first!');
  const nameEl = document.getElementById('new-student-name');
  const ptsEl = document.getElementById('new-student-points');
  const name = nameEl ? nameEl.value.trim() : '';
  const points = ptsEl ? (Number(ptsEl.value) || 0) : 0;
  if (!name) return;

  toggleLoader(true);
  const res = await callGAS('addStudent', { classId: state.activeClassId, name, points });
  if (res.success) {
    if (nameEl) nameEl.value = '';
    if (ptsEl) ptsEl.value = '0';
    await syncData();
  }
  toggleLoader(false);
});

window.deleteStudent = async (studentId) => {
  if (!confirm('Delete this student?')) return;
  toggleLoader(true);
  await callGAS('deleteStudent', { studentId });
  await syncData();
  toggleLoader(false);
};

// ================= TAB 2: TASK POINTS =================
function renderTaskPointsList() {
  const classId = state.activeClassId;
  const students = state.students.filter(s => s.classId === classId);
  const records = state.taskRecords.filter(r => r.classId === classId);

  const taskNames = [];
  records.forEach(r => {
    if (!taskNames.some(t => t.toLowerCase() === r.taskName.toLowerCase())) {
      taskNames.push(r.taskName);
    }
  });
  const datalist = document.getElementById('task-names-datalist');
  if (datalist) {
    datalist.innerHTML = taskNames.map(t => `<option value="${t}">`).join('');
  }

  const indList = document.getElementById('individual-task-list');
  if (!indList) return;

  if (!students.length) {
    indList.innerHTML = '<p class="helper-text">No students in this class yet.</p>';
    return;
  }

  indList.innerHTML = students.map(s => `
    <div class="entity-row">
      <div class="entity-left">
        <strong>${s.name}</strong>
        <span class="pts-pill">${s.points} ⭐</span>
      </div>
      <div class="entity-right">
        <input type="number" id="score-input-${s.id}" value="10" min="0" style="width: 110px;">
        <button type="button" class="btn btn-green btn-sm" onclick="saveSingleStudentScore('${s.id}')">SAVE SCORE</button>
      </div>
    </div>
  `).join('');
}

window.saveSingleStudentScore = async (studentId) => {
  const taskInput = document.getElementById('bulk-task-name');
  const taskName = taskInput ? taskInput.value.trim() : '';
  if (!taskName) {
    taskInput?.focus();
    return alert('Please enter a Task Name (e.g. Quiz #1) at the top first!');
  }
  const points = Number(document.getElementById(`score-input-${studentId}`)?.value) || 0;

  toggleLoader(true);
  const res = await callGAS('recordTask', {
    classId: state.activeClassId,
    studentId,
    taskName,
    points
  });
  if (res.success) {
    await syncData();
  }
  toggleLoader(false);
};

document.getElementById('award-whole-class-btn')?.addEventListener('click', async () => {
  if (!state.activeClassId) return alert('Select a class first!');
  const taskInput = document.getElementById('bulk-task-name');
  const taskName = taskInput ? taskInput.value.trim() : '';
  const points = Number(document.getElementById('bulk-task-points')?.value) || 0;

  if (!taskName) {
    taskInput?.focus();
    return alert('Please enter a Task Name (e.g. Quiz #1) first!');
  }

  toggleLoader(true);
  const res = await callGAS('bulkRecordTask', {
    classId: state.activeClassId,
    taskName,
    points
  });
  if (res.success) {
    await syncData();
  }
  toggleLoader(false);
});

// ================= TAB 3: HISTORY (E-CLASS RECORD MATRIX) =================
function renderHistoryMatrix() {
  const thead = document.getElementById('eclass-thead');
  const tbody = document.getElementById('eclass-tbody');
  if (!thead || !tbody) return;

  const classId = state.activeClassId;
  const students = state.students.filter(s => s.classId === classId);
  const records = state.taskRecords.filter(r => r.classId === classId);

  const taskNames = [];
  records.forEach(r => {
    if (!taskNames.some(t => t.toLowerCase() === r.taskName.toLowerCase())) {
      taskNames.push(r.taskName);
    }
  });

  if (!students.length) {
    thead.innerHTML = '';
    tbody.innerHTML = '<tr><td style="padding:18px;color:#94a3b8;">No students enrolled in this class yet.</td></tr>';
    return;
  }

  thead.innerHTML = `
    <tr>
      <th style="text-align:left;">Student</th>
      ${taskNames.map(t => `<th>${t}</th>`).join('')}
      <th>Missing</th>
      <th>Task Total</th>
      <th>Wallet ⭐</th>
    </tr>
  `;

  tbody.innerHTML = students.map(stu => {
    let missingCount = 0;
    let totalEarned = 0;

    const taskCells = taskNames.map(tName => {
      const rec = records.find(r => r.studentId === stu.id && r.taskName.toLowerCase() === tName.toLowerCase());
      const safeTask = tName.replace(/'/g, "\\'");
      if (!rec) {
        missingCount++;
        return `<td class="cell-missing" title="Click to enter score" onclick="jumpToEditScore('${stu.id}', '${safeTask}', 10)">MISSING</td>`;
      }
      totalEarned += rec.points;
      if (rec.points === 0) {
        missingCount++;
        return `<td class="cell-zero" title="Click to edit score" onclick="jumpToEditScore('${stu.id}', '${safeTask}', 0)">0</td>`;
      }
      return `<td class="cell-scored" title="Click to edit score" onclick="jumpToEditScore('${stu.id}', '${safeTask}', ${rec.points})">${rec.points}</td>`;
    }).join('');

    const statusHtml = taskNames.length === 0
      ? '—'
      : (missingCount > 0
          ? `<span class="badge-missing">${missingCount} Missing</span>`
          : `<span class="badge-clear">All Clear</span>`);

    return `
      <tr>
        <td class="stu-cell">${stu.name}</td>
        ${taskCells}
        <td>${statusHtml}</td>
        <td><strong>${totalEarned}</strong></td>
        <td style="color:#fbbf24;font-weight:800;">${stu.points} ⭐</td>
      </tr>
    `;
  }).join('');
}

window.jumpToEditScore = (studentId, taskName, suggestedPts) => {
  switchTab('tasks');
  const taskInput = document.getElementById('bulk-task-name');
  if (taskInput) taskInput.value = taskName;
  const rowInput = document.getElementById(`score-input-${studentId}`);
  if (rowInput) {
    rowInput.value = suggestedPts;
    rowInput.focus();
    rowInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

// ================= TAB 4: GACHA POOL =================
function renderGachaPool() {
  const countEl = document.getElementById('pool-count');
  if (countEl) countEl.textContent = state.gachaPool.length;
  const grid = document.getElementById('gacha-pool-grid');
  if (!grid) return;

  grid.innerHTML = state.gachaPool.map(item => `
    <div class="gacha-card">
      <img src="${item.imageUrl}" alt="${item.name}">
      <strong>${item.name}</strong>
      <span class="r-badge ${item.rarity}">${item.rarity} (${item.dropRate}%)</span>
      <span style="font-size:12px;color:#94a3b8;">${item.element}</span>
      <button type="button" class="btn btn-red btn-sm full-width" onclick="deleteGachaItem('${item.id}')">REMOVE</button>
    </div>
  `).join('');
}

document.getElementById('add-gacha-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nameEl = document.getElementById('gacha-name-input');
  const rarityEl = document.getElementById('gacha-rarity-select');
  const elemEl = document.getElementById('gacha-element-select');
  const fileInput = document.getElementById('gacha-image-input');
  const file = fileInput?.files?.[0];
  if (!file) return;

  toggleLoader(true);
  const imageData = await compressImage(file, 360);
  const res = await callGAS('addGacha', {
    teacherId: state.teacher.id,
    name: nameEl ? nameEl.value.trim() : '',
    rarity: rarityEl ? rarityEl.value : 'Common',
    element: elemEl ? elemEl.value : 'Nature',
    imageData
  });
  if (res.success) {
    if (nameEl) nameEl.value = '';
    if (fileInput) fileInput.value = '';
    await syncData();
  }
  toggleLoader(false);
});

window.deleteGachaItem = async (itemId) => {
  if (!confirm('Remove this creature from the Gacha pool?')) return;
  toggleLoader(true);
  await callGAS('deleteGacha', { itemId });
  await syncData();
  toggleLoader(false);
};
