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
  const userEl = document.getElementById('username-input');
  const passEl = document.getElementById('password-input');
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
  renderAwardCheckboxList();
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

// ================= TAB 2: AWARD ACTIVITY POINTS (CHECKBOXES) =================
function updateSelectedCounter() {
  const checked = document.querySelectorAll('.stu-checkbox:checked').length;
  const tag = document.getElementById('selected-count-tag');
  if (tag) tag.textContent = `(${checked} selected)`;
}

function renderAwardCheckboxList(precheckStudentId = null) {
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

  const box = document.getElementById('student-checkbox-box');
  if (!box) return;

  if (!students.length) {
    box.innerHTML = '<p class="helper-text" style="margin:4px;">No students in this class yet.</p>';
    updateSelectedCounter();
    return;
  }

  const currentAct = (document.getElementById('activity-name-input')?.value || '').trim().toLowerCase();

  box.innerHTML = students.map(s => {
    const existing = currentAct
      ? records.find(r => r.studentId === s.id && r.taskName.toLowerCase() === currentAct)
      : null;
    const isChecked = precheckStudentId ? (s.id === precheckStudentId) : false;

    return `
      <label class="stu-check-row">
        <span class="stu-check-left">
          <input type="checkbox" class="stu-checkbox" value="${s.id}" ${isChecked ? 'checked' : ''} onchange="updateSelectedCounter()">
          <span>${s.name} (${s.points} pts)</span>
        </span>
        ${existing ? `<span class="stu-existing-tag">Recorded: ${existing.points}</span>` : ''}
      </label>
    `;
  }).join('');

  updateSelectedCounter();
}

document.getElementById('activity-name-input')?.addEventListener('input', () => {
  const currentAct = (document.getElementById('activity-name-input')?.value || '').trim().toLowerCase();
  const records = state.taskRecords.filter(r => r.classId === state.activeClassId);
  const matchedRec = currentAct ? records.find(r => r.taskName.toLowerCase() === currentAct) : null;

  if (matchedRec && matchedRec.classification) {
    const classifEl = document.getElementById('activity-classif-select');
    if (classifEl) classifEl.value = matchedRec.classification;
  }

  const checkedIds = new Set(
    Array.from(document.querySelectorAll('.stu-checkbox:checked')).map(cb => cb.value)
  );
  renderAwardCheckboxList();
  document.querySelectorAll('.stu-checkbox').forEach(cb => {
    if (checkedIds.has(cb.value)) cb.checked = true;
  });
  updateSelectedCounter();
});

document.getElementById('select-all-students-btn')?.addEventListener('click', () => {
  document.querySelectorAll('.stu-checkbox').forEach(cb => { cb.checked = true; });
  updateSelectedCounter();
});

document.getElementById('clear-students-btn')?.addEventListener('click', () => {
  document.querySelectorAll('.stu-checkbox').forEach(cb => { cb.checked = false; });
  updateSelectedCounter();
});

document.getElementById('award-activity-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.activeClassId) return alert('Select a class first!');

  const taskName = document.getElementById('activity-name-input')?.value.trim();
  const classification = document.getElementById('activity-classif-select')?.value || 'Written Works';
  const points = Number(document.getElementById('activity-points-input')?.value);

  const selectedIds = Array.from(document.querySelectorAll('.stu-checkbox:checked')).map(cb => cb.value);

  if (!taskName) return alert('Please enter or select an Activity Name.');
  if (isNaN(points) || points < 0) return alert('Please enter valid Points to Award.');
  if (selectedIds.length === 0) return alert('Please check at least one student (or click "Select All").');

  const entries = selectedIds.map(studentId => ({ studentId, points }));

  toggleLoader(true);
  const res = await callGAS('batchRecordTasks', {
    classId: state.activeClassId,
    taskName,
    classification,
    entries
  });
  if (res.success) {
    await syncData();
    switchTab('history');
  } else {
    alert(res.message || 'Failed to award points.');
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
        return `<td class="cell-missing" title="Click to award points" onclick="jumpToAwardStudent('${stu.id}', '${safeTask}', '')">MISSING</td>`;
      }
      totalEarned += rec.points;
      if (rec.points === 0) {
        missingCount++;
        return `<td class="cell-zero" title="Click to edit points" onclick="jumpToAwardStudent('${stu.id}', '${safeTask}', 0)">0</td>`;
      }
      return `<td class="cell-scored" title="Click to edit points" onclick="jumpToAwardStudent('${stu.id}', '${safeTask}', ${rec.points})">${rec.points}</td>`;
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

window.jumpToAwardStudent = (studentId, taskName, existingPts) => {
  switchTab('tasks');
  const actInput = document.getElementById('activity-name-input');
  const ptsInput = document.getElementById('activity-points-input');
  if (actInput) actInput.value = taskName;
  if (ptsInput && existingPts !== '') ptsInput.value = existingPts;
  renderAwardCheckboxList(studentId);
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
