const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzReMeuhTNzHlzNBA6BvldLcGLNTLsOBf6-zunyHc6cdk1u5Mt3hBkfur8XY9ZPK22n/exec';

const ELEM_ICONS = { Fire: '🔥', Nature: '🌿', Water: '💧', Lightning: '⚡' };

let state = { teacher: null, classes: [], students: [], gachaPool: [], taskRecords: [] };
let uploadedImageData = null;

const toggleLoader = (show) => document.getElementById('loader').classList.toggle('hidden', !show);

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
  state = { teacher: null, classes: [], students: [], gachaPool: [], taskRecords: [] };
  document.getElementById('dashboard-view').classList.add('hidden');
  document.getElementById('login-view').classList.remove('hidden');
});

async function loadDashboardData() {
  const res = await callGAS('getData', { teacherId: state.teacher.id });
  if (res.success) {
    state.classes = res.classes;
    state.students = res.students;
    state.gachaPool = res.gachaPool;
    state.taskRecords = res.taskRecords || [];
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
  renderEClassRecord();
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
        <p class="item-meta">ID: ${s.id} • ${s.points} PTS</p>
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

// --- 3. CUSTOM TASK & POINTS ---
document.getElementById('points-class-filter').addEventListener('change', renderPoints);
document.getElementById('task-name-input').addEventListener('input', renderPoints);
document.getElementById('task-points-input').addEventListener('input', () => {
  const pts = Number(document.getElementById('task-points-input').value) || 0;
  document.getElementById('bulk-award-btn').textContent = `🔥 AWARD ALL (+${pts})`;
  renderPoints();
});

function renderPoints() {
  const classId = document.getElementById('points-class-filter').value;
  const taskName = document.getElementById('task-name-input').value.trim() || 'Task';
  const customPts = Number(document.getElementById('task-points-input').value) || 0;
  const list = state.students.filter(s => s.classId === classId);

  document.getElementById('points-grid').innerHTML = list.map(s => {
    const rec = state.taskRecords.find(
      r => r.classId === classId && r.studentId === s.id && r.taskName.toLowerCase() === taskName.toLowerCase()
    );

    let statusHtml = `<span class="task-status-badge status-pending">Not Graded Yet</span>`;
    if (rec) {
      statusHtml = rec.points > 0
        ? `<span class="task-status-badge status-done">✅ ${taskName}: ${rec.points} pts</span>`
        : `<span class="task-status-badge status-miss">❌ ${taskName}: 0 (Missed)</span>`;
    }

    return `
      <div class="item-card">
        <div>
          <h4>${s.name}</h4>
          <div class="points-score">${s.points} ⭐</div>
          ${statusHtml}
        </div>
        <div class="pt-btn-row">
          <button class="game-btn btn-green btn-sm" onclick="scoreStudentTask('${s.id}', ${customPts})">+${customPts} PTS</button>
          <button class="game-btn btn-red btn-sm" onclick="scoreStudentTask('${s.id}', 0)">0 (MISS)</button>
        </div>
      </div>
    `;
  }).join('');
}

window.scoreStudentTask = (studentId, awardedPoints) => {
  const classId = document.getElementById('points-class-filter').value;
  const taskName = document.getElementById('task-name-input').value.trim() || 'Task';
  const student = state.students.find(s => s.id === studentId);
  if (!student || !classId) return;

  const existing = state.taskRecords.find(
    r => r.classId === classId && r.studentId === studentId && r.taskName.toLowerCase() === taskName.toLowerCase()
  );
  const oldPts = existing ? existing.points : 0;
  const delta = awardedPoints - oldPts;

  student.points = Math.max(0, student.points + delta);

  if (existing) {
    existing.points = awardedPoints;
  } else {
    state.taskRecords.push({ classId, studentId, taskName, points: awardedPoints });
  }

  renderPoints();
  renderStudents();
  renderEClassRecord();

  callGAS('recordTask', { classId, studentId, taskName, points: awardedPoints });
};

window.awardAllStudents = () => {
  const classId = document.getElementById('points-class-filter').value;
  const taskName = document.getElementById('task-name-input').value.trim() || 'Task';
  const customPts = Number(document.getElementById('task-points-input').value) || 0;
  if (!classId) return;

  state.students.forEach(s => {
    if (s.classId === classId) {
      const existing = state.taskRecords.find(
        r => r.classId === classId && r.studentId === s.id && r.taskName.toLowerCase() === taskName.toLowerCase()
      );
      const oldPts = existing ? existing.points : 0;
      s.points = Math.max(0, s.points + (customPts - oldPts));

      if (existing) {
        existing.points = customPts;
      } else {
        state.taskRecords.push({ classId, studentId: s.id, taskName, points: customPts });
      }
    }
  });

  renderPoints();
  renderStudents();
  renderEClassRecord();

  callGAS('bulkRecordTask', { classId, taskName, points: customPts });
};

// --- 4. GACHA POOL (NAME + ELEMENT + AUTO-TRANSPARENT) ---
function removeOuterWhiteBackground(ctx, width, height) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const visited = new Uint8Array(width * height);
  const stack = [];

  const isBackground = (idx) => data[idx] > 235 && data[idx + 1] > 235 && data[idx + 2] > 235;

  for (let x = 0; x < width; x++) stack.push([x, 0], [x, height - 1]);
  for (let y = 0; y < height; y++) stack.push([0, y], [width - 1, y]);

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    if (x < 0 || x >= width || y < 0 || y >= height) continue;

    const pos = y * width + x;
    if (visited[pos]) continue;
    visited[pos] = 1;

    const pixelIdx = pos * 4;
    if (isBackground(pixelIdx)) {
      data[pixelIdx + 3] = 0;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const pos = y * width + x;
      const idx = pos * 4;
      if (data[idx + 3] === 0) continue;

      const hasTransparentNeighbor =
        data[((y - 1) * width + x) * 4 + 3] === 0 ||
        data[((y + 1) * width + x) * 4 + 3] === 0 ||
        data[(y * width + (x - 1)) * 4 + 3] === 0 ||
        data[(y * width + (x + 1)) * 4 + 3] === 0;

      if (hasTransparentNeighbor && data[idx] > 200 && data[idx + 1] > 200 && data[idx + 2] > 200) {
        data[idx + 3] = 90;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

document.getElementById('gacha-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxSize = 200;
      let width = img.width;
      let height = img.height;

      if (width > height && width > maxSize) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      } else if (height > maxSize) {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      removeOuterWhiteBackground(ctx, width, height);
      uploadedImageData = canvas.toDataURL('image/png');

      const preview = document.getElementById('gacha-preview');
      preview.src = uploadedImageData;
      preview.classList.remove('hidden');
      document.getElementById('file-status').textContent = file.name + ' (Transparent Ready!)';
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

window.uploadAndAddGacha = async (rarity) => {
  if (!uploadedImageData) {
    return alert('Click UPLOAD IMAGE first!');
  }

  const nameInput = document.getElementById('gacha-name-input');
  const name = nameInput.value.trim() || `${rarity} Critter`;
  const element = document.getElementById('gacha-element-select').value;

  toggleLoader(true);
  const res = await callGAS('addGacha', {
    teacherId: state.teacher.id,
    name,
    rarity,
    element,
    imageData: uploadedImageData
  });

  if (res.success) {
    state.gachaPool.push(res.data);
    uploadedImageData = null;
    nameInput.value = '';
    document.getElementById('gacha-file').value = '';
    document.getElementById('gacha-preview').classList.add('hidden');
    document.getElementById('file-status').textContent = 'No file chosen';
    renderGacha();
  }
  toggleLoader(false);
};

function renderGacha() {
  document.getElementById('gacha-grid').innerHTML = state.gachaPool.map((item, idx) => {
    const elem = item.element || 'Nature';
    const displayName = item.name || `${item.rarity} Critter`;
    return `
      <div class="item-card">
        <img src="${item.imageUrl}" class="gacha-img" style="animation-delay: -${(idx * 0.4) % 2}s;" alt="${displayName}">
        <div>
          <h4 style="margin-bottom:6px;">${displayName}</h4>
          <span class="badge ${item.rarity}">${item.rarity}</span>
          <p class="item-meta" style="margin-top:6px;">${ELEM_ICONS[elem] || '✨'} ${elem} • ${item.dropRate}% CHANCE</p>
        </div>
        <button class="game-btn btn-red btn-sm" onclick="removeGacha('${item.id}')">DELETE</button>
      </div>
    `;
  }).join('');
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

// --- 5. E-CLASS RECORD (TASK MATRIX) ---
document.getElementById('history-class-filter').addEventListener('change', renderEClassRecord);

function renderEClassRecord() {
  const classId = document.getElementById('history-class-filter').value;
  const classStudents = state.students.filter(s => s.classId === classId);
  const classRecords = state.taskRecords.filter(r => r.classId === classId);

  const thead = document.getElementById('record-thead');
  const tbody = document.getElementById('record-tbody');

  if (!classStudents.length) {
    thead.innerHTML = '';
    tbody.innerHTML = '<tr><td style="text-align:center;padding:24px;">No students in this class yet.</td></tr>';
    return;
  }

  const taskColumns = [];
  classRecords.forEach(r => {
    if (!taskColumns.some(t => t.toLowerCase() === r.taskName.toLowerCase())) {
      taskColumns.push(r.taskName);
    }
  });

  thead.innerHTML = `
    <tr>
      <th>Student Name</th>
      ${taskColumns.map(task => `<th>${task}</th>`).join('')}
      <th>Total Task Score</th>
      <th>Gacha Wallet ⭐</th>
    </tr>
  `;

  tbody.innerHTML = classStudents.map(student => {
    let totalTaskScore = 0;

    const taskCells = taskColumns.map(task => {
      const rec = classRecords.find(
        r => r.studentId === student.id && r.taskName.toLowerCase() === task.toLowerCase()
      );

      if (!rec || rec.points === 0) {
        return `<td class="cell-missing">❌ MISSING (0)</td>`;
      }

      totalTaskScore += rec.points;
      return `<td class="cell-score">✅ ${rec.points}</td>`;
    }).join('');

    return `
      <tr>
        <td>👾 ${student.name}</td>
        ${taskCells}
        <td class="cell-total">${totalTaskScore} pts</td>
        <td>${student.points} ⭐</td>
      </tr>
    `;
  }).join('');
}
