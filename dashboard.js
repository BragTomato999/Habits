const WAKE_HOUR = 6;
const SLEEP_HOUR = 22;
const ANTHROPIC_API_KEY = '';
const SUN_PALETTE = [[255, 216, 158], [255, 205, 121], [255, 227, 143], [255, 183, 106], [255, 149, 89], [243, 111, 79], [226, 93, 122], [123, 91, 176], [47, 58, 102]];

const SUPABASE_URL = 'https://nfbhmjsegpnvlubpcvig.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mYmhtanNlZ3Budmx1YnBjdmlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0ODQ0NjksImV4cCI6MjA5NDA2MDQ2OX0.hdV-KtWlBFPG7T1I6EnO44c_t475YJzE1dBY8y1cwTo';

// State
let tickerItems = [];
let cycleIdx = 0;

// Storage helpers
function storeGet(key) { const val = localStorage.getItem(key); return val ? JSON.parse(val) : null; }
function storeSet(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function storeDelete(key) { localStorage.removeItem(key); }

function getActiveDateString() { const now = new Date(); if (now.getHours() < 6) now.setDate(now.getDate() - 1); return now.toISOString().split('T')[0]; }
function getTomorrowDateString() { const now = new Date(); let result; if (now.getHours() < 6) result = new Date(now); else { result = new Date(now); result.setDate(result.getDate() + 1); } return result.toISOString().split('T')[0]; }

function formatDate(dateStr) { const date = new Date(dateStr + 'T12:00:00'); const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return `{${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}}`; }
function formatTime12(date) { let h = date.getHours(); const ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12; if (h === 0) h = 12; const m = date.getMinutes().toString().padStart(2, '0'); return `${h}:${m} ${ampm}`; }
function formatTimeRemaining(hours) { if (hours <= 0) return '0h 0m'; const h = Math.floor(hours); const m = Math.round((hours - h) * 60); return `${h}h ${m}m`; }

function interpolateColor(percent) { const stops = SUN_PALETTE.length - 1; const pos = (percent / 100) * stops; const idx = Math.floor(pos); const t = pos - idx; const c1 = SUN_PALETTE[Math.min(idx, stops)]; const c2 = SUN_PALETTE[Math.min(idx + 1, stops)]; const r = Math.round(c1[0] + (c2[0] - c1[0]) * t); const g = Math.round(c1[1] + (c2[1] - c1[1]) * t); const b = Math.round(c1[2] + (c2[2] - c1[2]) * t); return `rgb(${r}, ${g}, ${b})`; }

// Day Ring
function updateDayRing() {
  const now = new Date(); const hours = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const ringFill = document.getElementById('ringFill'); const ringPercent = document.getElementById('ringPercent'); const ringPhase = document.getElementById('ringPhase'); const ringStatus = document.getElementById('ringStatus'); const ringRemaining = document.getElementById('ringRemaining'); const ringClock = document.getElementById('ringClock');
  const circumference = 2 * Math.PI * 52; ringFill.style.strokeDasharray = circumference;
  if (hours < WAKE_HOUR) { ringFill.style.stroke = '#4D4B47'; ringFill.style.strokeDashoffset = circumference; ringPercent.textContent = '—'; ringPhase.textContent = 'SLEEPING'; ringStatus.textContent = '😴 Still sleeping'; const wakeTime = new Date(); wakeTime.setHours(WAKE_HOUR, 0, 0); const diff = (wakeTime - now) / (1000 * 60 * 60); ringRemaining.textContent = formatTimeRemaining(diff) + ' until wake-up'; }
  else if (hours < SLEEP_HOUR) { const percent = ((hours - WAKE_HOUR) / (SLEEP_HOUR - WAKE_HOUR)) * 100; ringFill.style.strokeDashoffset = circumference * (1 - percent / 100); ringFill.style.stroke = interpolateColor(percent); ringPercent.textContent = Math.round(percent) + '%'; let phase, status, emoji; if (percent < 25) { phase = 'MORNING'; emoji = '☀️'; status = 'Morning — fresh start'; } else if (percent < 50) { phase = 'MIDDAY'; emoji = '⚡'; status = 'Midday — keep moving'; } else if (percent < 75) { phase = 'AFTERNOON'; emoji = '🔥'; status = 'Afternoon — push it'; } else if (percent < 90) { phase = 'EVENING'; emoji = '⏳'; status = 'Evening — wrap up'; } else { phase = 'BEDTIME'; emoji = '🌙'; status = 'Bedtime soon'; } ringPhase.textContent = phase; ringStatus.textContent = `${emoji} ${status}`; ringRemaining.textContent = formatTimeRemaining(SLEEP_HOUR - hours) + ' awake time left'; }
  else { ringFill.style.stroke = '#E25D7A'; ringFill.style.strokeDashoffset = 0; ringPercent.textContent = '100%'; ringPhase.textContent = 'PAST BEDTIME'; ringStatus.textContent = '⚠️ Past bedtime'; ringRemaining.textContent = 'Sleep!'; }
  ringClock.textContent = formatTime12(now);
  document.getElementById('ringHours').textContent = `${WAKE_HOUR}:00 AM – ${SLEEP_HOUR > 12 ? SLEEP_HOUR - 12 : SLEEP_HOUR}:00 ${SLEEP_HOUR >= 12 ? 'PM' : 'AM'}`;
}

// Goals
function getGoals(dateStr) { return storeGet(`goals:${dateStr}`) || []; }
function setGoals(dateStr, goals) { storeSet(`goals:${dateStr}`, goals); }
function getTodayGoals() { return getGoals(getActiveDateString()); }
function getTomorrowGoals() { return getGoals(getTomorrowDateString()); }
function saveTodayGoals(goals) { setGoals(getActiveDateString(), goals); }
function saveTomorrowGoals(goals) { setGoals(getTomorrowDateString(), goals); }

// Recurring Goals System (now tracked in Habit Tracker tab)
const RECURRING_GOALS = [];

function getDayOfWeek(dateStr) { return new Date(dateStr + 'T12:00:00').getDay(); }

function applyRecurringGoals() {
  const today = getActiveDateString();
  const currentDay = getDayOfWeek(today);
  let goals = getTodayGoals();
  const existingTexts = goals.map(g => g.text);

  RECURRING_GOALS.forEach(rg => {
    if (rg.days.includes(currentDay) && !existingTexts.some(t => t === rg.text)) {
      goals.unshift({ text: rg.text, done: false, recurring: true });
    }
  });

  saveTodayGoals(goals);
}

// Achievement & Progression System (based on Habit Tracker)
const ACHIEVEMENTS = [
  { id: 'streak_3', name: 'Started', desc: '3 day habit streak', icon: '🌱', req: 3, type: 'habit_streak' },
  { id: 'streak_7', name: 'On Fire', desc: '7 day habit streak', icon: '🔥', req: 7, type: 'habit_streak' },
  { id: 'streak_30', name: 'Unstoppable', desc: '30 day habit streak', icon: '🏆', req: 30, type: 'habit_streak' },
  { id: 'streak_100', name: 'Legend', desc: '100 day habit streak', icon: '👑', req: 100, type: 'habit_streak' },
  { id: 'gym_weekly', name: 'Gym Rat', desc: 'Go to gym 10 times this week', icon: '💪', req: 10, type: 'gym' },
  { id: 'water_7', name: 'Hydration Pro', desc: 'Drink 2.5L for 7 days', icon: '💧', req: 7, type: 'water' },
  { id: 'water_30', name: 'Hydration Hero', desc: 'Drink 2.5L for 30 days', icon: '🌊', req: 30, type: 'water' },
  { id: 'reading_7', name: 'Bookworm', desc: 'Read for 7 days', icon: '📚', req: 7, type: 'reading' },
  { id: 'reading_30', name: 'Scholar', desc: 'Read for 30 days', icon: '🎓', req: 30, type: 'reading' },
  { id: 'nofap_7', name: 'Disciplined', desc: 'NoFap for 7 days', icon: '🧘', req: 7, type: 'nofap' },
  { id: 'nofap_30', name: 'Warrior', desc: 'NoFap for 30 days', icon: '⚔️', req: 30, type: 'nofap' }
];

function getStats() {
  let stats = storeGet('user_stats_v1');
  if (!stats) {
    stats = { completedGoalIds: [], gymDays: 0, achievements: [] };
    saveStats(stats);
  }
  return stats;
}
function saveStats(stats) { storeSet('user_stats_v1', stats); }

function resetWeeklyGym() {
  const stats = getStats();
  const lastReset = storeGet('gym_week_reset');
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // Sunday
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().split('T')[0];

  if (!lastReset || lastReset < weekStartStr) {
    stats.gymDays = 0;
    saveStats(stats);
    storeSet('gym_week_reset', weekStartStr);
  }
}

function updateStatsOnGoalComplete(goalText, goalKey) {
  const stats = getStats();

  // Prevent double counting - use unique ID
  if (stats.completedGoalIds.includes(goalKey)) return;

  stats.completedGoalIds.push(goalKey);

  const g = goalText.toLowerCase();
  // Only count "Going to gym" specifically, reset weekly
  const normalizedText = goalText.toLowerCase().trim();
  if (normalizedText === 'going to gym') {
    stats.gymDays++;
    saveStats(stats);
  }
  if (g.includes('water') && g.includes('2.5')) stats.waterDays++;
  if (g.includes('read') || g.includes('page')) {
    const match = goalText.match(/(\d+)\s*pages?/i);
    if (match) stats.totalPages += parseInt(match[1]);
  }

  saveStats(stats);
}

function checkAchievements() {
  const stats = getStats();
  const habits = getHabits();

  // Calculate habit streaks
  const habitStreak = Math.min(
    getHabitStreak('water'),
    getHabitStreak('gym'),
    getHabitStreak('reading'),
    getHabitStreak('nofap')
  );

  ACHIEVEMENTS.forEach(ach => {
    if (stats.achievements.includes(ach.id)) return;

    let earned = false;
    if (ach.type === 'habit_streak' && habitStreak >= ach.req) earned = true;
    if (ach.type === 'gym' && stats.gymDays >= ach.req) earned = true;
    if (ach.type === 'water') {
      const waterDays = (habits.water || []).length;
      if (waterDays >= ach.req) earned = true;
    }
    if (ach.type === 'reading') {
      const readingDays = (habits.reading || []).length;
      if (readingDays >= ach.req) earned = true;
    }
    if (ach.type === 'nofap') {
      const nofapDays = (habits.nofap || []).length;
      if (nofapDays >= ach.req) earned = true;
    }

    if (earned) {
      stats.achievements.push(ach.id);
      saveStats(stats);
      showAchievementToast(ach);
    }
  });
}

function showAchievementToast(ach) {
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML = `<span class="achievement-icon">${ach.icon}</span><div class="achievement-info"><strong>Achievement Unlocked!</strong><span>${ach.name}</span></div>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 100);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 500); }, 4000);
}

function getAchievementRequirement(ach) {
  const stats = getStats();
  const habits = getHabits();
  let current = 0, target = ach.req;

  switch(ach.type) {
    case 'habit_streak':
      current = Math.min(
        getHabitStreak('water'),
        getHabitStreak('gym'),
        getHabitStreak('reading'),
        getHabitStreak('nofap')
      );
      break;
    case 'gym': current = stats.gymDays; break;
    case 'water': current = (habits.water || []).length; break;
    case 'reading': current = (habits.reading || []).length; break;
    case 'nofap': current = (habits.nofap || []).length; break;
  }

  const remaining = Math.max(0, target - current);
  return `${ach.desc} — ${remaining > 0 ? remaining + ' more to go' : 'Complete!'}`;
}

function renderProgression() {
  const stats = getStats();

  // Achievements only
  const unlocked = stats.achievements.map(id => ACHIEVEMENTS.find(a => a.id === id));
  document.getElementById('achCount').textContent = `${unlocked.length}/${ACHIEVEMENTS.length} unlocked`;
  document.getElementById('achList').innerHTML = ACHIEVEMENTS.map(ach => {
    const earned = stats.achievements.includes(ach.id);
    const reqText = getAchievementRequirement(ach);
    return `<div class="ach-item ${earned ? 'earned' : 'locked'}" title="${reqText}"><span class="ach-icon">${ach.icon}</span><span class="ach-name">${ach.name}</span></div>`;
  }).join('');
}

// Weekly Stats
function updateWeeklyStats() {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  const currentDay = today.getDay();
  let totalGoals = 0, totalDone = 0;
  const dayData = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - (currentDay - i));
    const dateStr = d.toISOString().split('T')[0];
    const goals = getGoals(dateStr);
    const done = goals.filter(g => g.done).length;
    const total = goals.length;
    totalGoals += total;
    totalDone += done;
    dayData.push({ day: days[i], done, total, isPast: i < currentDay, isToday: i === currentDay });
  }

  const percent = totalGoals > 0 ? Math.round((totalDone / totalGoals) * 100) : 0;
  document.getElementById('weeklyValue').textContent = `${totalDone}/${totalGoals}`;
  document.getElementById('weeklyPercent').textContent = totalGoals === 0 ? 'Ready?' : `${percent}%`;

  const bar = document.getElementById('weeklyBar');
  bar.innerHTML = '';
  dayData.forEach(d => {
    const div = document.createElement('div');
    div.className = 'stats-week-day';
    let statusClass = 'none';
    if (d.isPast && d.total > 0 && d.done === d.total) statusClass = 'done';
    else if (d.isPast && d.done > 0) statusClass = 'partial';
    else if (d.isToday) statusClass = 'today';

    div.className = `stats-week-day ${statusClass}`;
    const check = statusClass === 'done' ? '✓' : statusClass === 'partial' ? '●' : '';
    div.innerHTML = `<div class="week-day-name">${d.day}</div><div class="week-day-check">${check}</div>`;
    div.title = `${d.day}: ${d.done}/${d.total} goals`;
    bar.appendChild(div);
  });
}

// Render functions
function renderTodayHeader() {
  const goals = getTodayGoals();
  const done = goals.filter(g => g.done).length;
  const total = goals.length;
  document.getElementById('progressNum').textContent = done;
  document.getElementById('progressTotal').textContent = '/ ' + total;
  const label = document.getElementById('progressLabel');
  if (total === 0) label.textContent = 'no goals yet';
  else if (done === total) label.textContent = 'all done — solid day';
  else label.textContent = 'complete';
  const bar = document.getElementById('progressBar');
  bar.innerHTML = '';
  goals.forEach(g => { const seg = document.createElement('div'); seg.className = 'bar-seg' + (g.done ? ' done' : ''); bar.appendChild(seg); });
  const card = document.getElementById('todayCard');
  const pushBtn = document.getElementById('pushBtn');
  if (done === total && total > 0) card.classList.add('gm-all-done');
  else card.classList.remove('gm-all-done');
  pushBtn.style.display = goals.some(g => !g.done) ? 'block' : 'none';
}

function renderStreak() { const streak = storeGet('goal_streak_v1') || { count: 0 }; const pill = document.getElementById('streakPill'); const num = document.getElementById('streakNum'); num.textContent = streak.count; pill.classList.toggle('active', streak.count > 0); }
function updateStreak() { const keys = Object.keys(localStorage).filter(k => k.startsWith('goals:')).sort(); let count = 0; let lastDate = ''; for (const key of keys) { const dateStr = key.replace('goals:', ''); const goals = storeGet(key) || []; if (goals.length === 0) continue; if (goals.every(g => g.done)) { count++; lastDate = dateStr; } else break; } storeSet('goal_streak_v1', { count, lastProcessedDate: lastDate }); }
function renderTomorrowCount() { document.getElementById('tomorrowCount').textContent = getTomorrowGoals().length + ' planned'; }

function buildGoalRow(goal, idx, isReadOnly, listKey, saveFn) {
  const li = document.createElement('li');
  li.className = 'goal-item' + (goal.done ? ' done' : '') + (goal.queued ? ' queued' : '');
  li.dataset.idx = idx;
  const goalKey = `${getActiveDateString()}-${goal.text}`;
  li.innerHTML = `<span class="drag-handle">⋮⋮</span><div class="checkbox ${goal.done ? 'checked' : ''}" data-idx="${idx}"></div><span class="goal-text" contenteditable="false">${goal.text}</span><span class="queue-btn ${goal.queued ? 'active' : ''}" data-idx="${idx}">⚡</span><span class="goal-delete" data-idx="${idx}">×</span>`;
  if (isReadOnly) { li.querySelector('.checkbox').classList.add('disabled'); li.querySelector('.checkbox').title = 'Activates at 6 AM tomorrow'; li.querySelector('.queue-btn').classList.add('disabled'); }
  li.querySelector('.checkbox').addEventListener('click', () => { if (isReadOnly) return; const goals = listKey === 'today' ? getTodayGoals() : getTomorrowGoals(); const wasDone = goals[idx].done; goals[idx].done = !goals[idx].done; if (goals[idx].done) { goals[idx].doneAt = Date.now(); if (!wasDone) updateStatsOnGoalComplete(goals[idx].text, goalKey); } else delete goals[idx].doneAt; saveFn(goals); updateStreak(); render(); renderProgression(); checkAchievements(); renderReview(); });
  const textEl = li.querySelector('.goal-text');
  textEl.addEventListener('click', () => { if (isReadOnly) return; textEl.contentEditable = 'true'; textEl.focus(); });
  textEl.addEventListener('blur', () => { textEl.contentEditable = 'false'; const newText = textEl.textContent.trim(); if (newText && newText !== goal.text) { const goals = listKey === 'today' ? getTodayGoals() : getTomorrowGoals(); goals[idx].text = newText; saveFn(goals); render(); } else textEl.textContent = goal.text; });
  textEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); textEl.blur(); } else if (e.key === 'Escape') { textEl.textContent = goal.text; textEl.blur(); } });
  li.querySelector('.queue-btn').addEventListener('click', () => { if (isReadOnly) return; const goals = listKey === 'today' ? getTodayGoals() : getTomorrowGoals(); goals[idx].queued = !goals[idx].queued; saveFn(goals); li.classList.add('queue-flash'); setTimeout(() => render(), 480); });
  li.querySelector('.goal-delete').addEventListener('click', () => { const goals = listKey === 'today' ? getTodayGoals() : getTomorrowGoals(); goals.splice(idx, 1); saveFn(goals); render(); });
  li.draggable = true;
  li.addEventListener('dragstart', (e) => { li.classList.add('dragging'); e.dataTransfer.setData('text/plain', idx); });
  li.addEventListener('dragend', () => { li.classList.remove('dragging'); });
  li.addEventListener('dragover', (e) => { e.preventDefault(); li.style.borderTop = '2px solid var(--warning)'; });
  li.addEventListener('dragleave', () => { li.style.borderTop = ''; });
  li.addEventListener('drop', (e) => { e.preventDefault(); li.style.borderTop = ''; const fromIdx = parseInt(e.dataTransfer.getData('text/plain')); const toIdx = parseInt(li.dataset.idx); if (fromIdx !== toIdx) { const goals = listKey === 'today' ? getTodayGoals() : getTomorrowGoals(); const [moved] = goals.splice(fromIdx, 1); goals.splice(toIdx, 0, moved); saveFn(goals); render(); } });
  return li;
}

function renderListInto(goals, listEl, emptyEl, key, isReadOnly, saveFn) {
  listEl.innerHTML = '';
  const visibleGoals = goals.slice(0, 5);
  const hasMore = goals.length > 5;
  visibleGoals.forEach((g, i) => { listEl.appendChild(buildGoalRow(g, i, isReadOnly, key, saveFn)); });
  if (hasMore) { const moreEl = document.createElement('div'); moreEl.className = 'show-more'; moreEl.textContent = `Show ${goals.length - 5} more ▾`; moreEl.addEventListener('click', () => { listEl.innerHTML = ''; goals.forEach((g, i) => { listEl.appendChild(buildGoalRow(g, i, isReadOnly, key, saveFn)); }); }); listEl.appendChild(moreEl); }
  emptyEl.style.display = goals.length === 0 ? 'block' : 'none';
}

function makeAddHandlers(inputId, addBtnId, key, statusElId, saveFn, reloadFn) {
  const input = document.getElementById(inputId); const addBtn = document.getElementById(addBtnId); const statusEl = document.getElementById(statusElId);
  const doAdd = () => { const text = input.value.trim(); if (!text) return; const goals = key === 'today' ? getTodayGoals() : getTomorrowGoals(); goals.push({ text, done: false }); saveFn(goals); input.value = ''; reloadFn(); };
  addBtn.addEventListener('click', doAdd); input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });
}

function loadToday() { renderListInto(getTodayGoals(), document.getElementById('goalList'), document.getElementById('emptyState'), 'today', false, saveTodayGoals); }
function loadTomorrow() { renderListInto(getTomorrowGoals(), document.getElementById('tomorrowList'), document.getElementById('tomorrowEmpty'), 'tomorrow', true, saveTomorrowGoals); }
function render() { renderTodayHeader(); loadToday(); loadTomorrow(); renderStreak(); renderTomorrowCount(); updateTicker(); updateWeeklyStats(); renderProgression(); }

function updateTicker() { const goals = getTodayGoals(); const pending = goals.filter(g => !g.done); const done = goals.filter(g => g.done); const total = goals.length; document.getElementById('goalTickerMeta').textContent = `${done.length}/${total}`; if (total === 0) tickerItems = [{ status: 'empty', text: 'No goals set for today — add one to get rolling.' }]; else if (done.length === total) tickerItems = [{ status: 'done', text: '✓ All goals done — solid day.' }]; else tickerItems = pending.map(g => ({ status: 'pending', text: g.text })); cycleIdx = 0; showTickerItem(); }

function showTickerItem() { const stage = document.getElementById('goalTickerStage'); const existing = stage.querySelector('.goal-ticker-row'); if (existing) { existing.classList.add('is-leaving'); setTimeout(() => { existing.remove(); }, 460); } const item = tickerItems[cycleIdx % tickerItems.length]; const row = document.createElement('div'); row.className = 'goal-ticker-row'; row.innerHTML = `<span class="goal-ticker-status" data-status="${item.status}">${item.status === 'done' ? '✓' : item.status === 'pending' ? '○' : '·'}</span><span class="goal-ticker-text">${item.text}</span>`; if (tickerItems.length > 1) row.classList.add('is-entering'); stage.appendChild(row); }
function tick() { cycleIdx++; showTickerItem(); }
function startTicker() { updateTicker(); setInterval(tick, 5000); }

document.getElementById('pushBtn').addEventListener('click', () => { if (!confirm('Move all unchecked goals to tomorrow?')) return; const todayGoals = getTodayGoals(); const tomorrowGoals = getTomorrowGoals(); const unchecked = todayGoals.filter(g => !g.done); const checked = todayGoals.filter(g => g.done); unchecked.forEach(g => { if (!tomorrowGoals.some(tg => tg.text === g.text)) tomorrowGoals.push({ text: g.text, done: false }); }); saveTodayGoals(checked); saveTomorrowGoals(tomorrowGoals); render(); });

function runRollover() { const activeDate = getActiveDateString(); const keys = Object.keys(localStorage).filter(k => k.startsWith('goals:')); for (const key of keys) { const dateStr = key.replace('goals:', ''); if (dateStr < activeDate) { const oldGoals = storeGet(key) || []; const undone = oldGoals.filter(g => !g.done); if (undone.length > 0) { const todayGoals = getTodayGoals(); const todayTexts = todayGoals.map(g => g.text); undone.forEach(g => { if (!todayTexts.includes(g.text)) todayGoals.push({ text: g.text, done: false }); }); saveTodayGoals(todayGoals); } storeDelete(key); } } }

function rollForwardPlannedGoals() {
  const now = new Date();
  const todayDate = now.toISOString().split('T')[0];
  const lastRolledKey = 'last_rollforward_date';
  const lastRolled = storeGet(lastRolledKey);
  if (lastRolled === todayDate) return;
  const currentHour = now.getHours();
  if (currentHour < 6) return;

  const activeDate = getActiveDateString();
  const tomorrowDate = getTomorrowDateString();
  const planned = getGoals(tomorrowDate);

  if (planned.length > 0) {
    const currentToday = getTodayGoals();
    const todayTexts = currentToday.map(g => g.text);
    planned.forEach(g => { if (!todayTexts.includes(g.text)) { currentToday.push({ text: g.text, done: false }); } });
    setGoals(activeDate, currentToday);
    setGoals(tomorrowDate, []);
    storeSet(lastRolledKey, todayDate);
  }
}

// Notes
function initNotes() { const notes = storeGet('quick_notes') || ''; document.getElementById('notes').value = notes; }
document.getElementById('notes').addEventListener('input', (e) => { storeSet('quick_notes', e.target.value); });

// Init
function init() {
  resetWeeklyGym();
  runRollover();
  rollForwardPlannedGoals();
  applyRecurringGoals();
  updateStreak();
  document.getElementById('todayLabel').textContent = 'Today — ' + formatDate(getActiveDateString());
  document.getElementById('tomorrowLabel').textContent = 'Plan tomorrow — ' + formatDate(getTomorrowDateString());
  makeAddHandlers('goalInput', 'addBtn', 'today', 'addStatus', saveTodayGoals, render);
  makeAddHandlers('tomorrowInput', 'tomorrowAddBtn', 'tomorrow', 'tomorrowStatus', saveTomorrowGoals, render);
  updateDayRing();
  setInterval(updateDayRing, 60000);
  startTicker();
  initNotes();
  initTabs();
  renderHabits();
  renderProgression();
  checkAchievements();
  render();
}

// Habit Tracker
const HABITS = [
  { id: 'water', name: 'Drink 2.5L Water', icon: '💧', color: '#7CA5FF' },
  { id: 'gym', name: 'Go to Gym', icon: '💪', color: '#F2C063' },
  { id: 'reading', name: 'Read 20 Pages', icon: '📚', color: '#6BE3A4' },
  { id: 'nofap', name: 'NoFap', icon: '🍆', color: '#E25D7A' }
];

function getHabits() { return storeGet('habits_v1') || {}; }
function saveHabits(habits) { storeSet('habits_v1', habits); }

function getHabitStreak(habitId) {
  const habits = getHabits();
  const habitData = habits[habitId] || [];
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    if (habitData.includes(dateStr)) streak++;
    else if (i > 0) break;
  }
  return streak;
}

function toggleHabit(habitId, dateStr) {
  const habits = getHabits();
  if (!habits[habitId]) habits[habitId] = [];
  const idx = habits[habitId].indexOf(dateStr);
  if (idx > -1) habits[habitId].splice(idx, 1);
  else habits[habitId].push(dateStr);
  saveHabits(habits);
  renderHabits();
  checkAchievements();
}

function renderHabits() {
  const grid = document.getElementById('habitsGrid');
  const weekDates = getWeekDates();
  const todayStr = new Date().toISOString().split('T')[0];
  const habits = getHabits();

  grid.innerHTML = HABITS.map(habit => {
    const habitData = habits[habit.id] || [];
    const streak = getHabitStreak(habit.id);
    const lastIdx = weekDates.length - 1;
    const daysHtml = weekDates.map((date, idx) => {
      const done = habitData.includes(date);
      const isToday = idx === lastIdx;
      const dayName = new Date(date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' });
      return `<div class="habit-day ${done ? 'done' : 'empty'} ${isToday ? 'today' : ''}"
        data-habit="${habit.id}" data-date="${date}" title="${date}">${dayName}</div>`;
    }).join('');

    return `<div class="habit-row">
      <div class="habit-icon">${habit.icon}</div>
      <div class="habit-name">${habit.name}</div>
      <div class="habit-streak">🔥 ${streak}</div>
      <div class="habit-days">${daysHtml}</div>
    </div>`;
  }).join('');

  document.querySelectorAll('.habit-day').forEach(el => {
    el.addEventListener('click', () => {
      toggleHabit(el.dataset.habit, el.dataset.date);
    });
  });

  // Streak info
  const totalStreak = Math.min(...HABITS.map(h => getHabitStreak(h.id)));
  document.getElementById('habitStreakInfo').textContent =
    `Your current streak: ${totalStreak} days (all 4 habits)`;
}

function resetWeekHabits() {
  if (!confirm('Reset all habits for this week?')) return;
  const weekDates = getWeekDates();
  const habits = getHabits();
  HABITS.forEach(habit => {
    if (!habits[habit.id]) return;
    habits[habit.id] = habits[habit.id].filter(d => !weekDates.includes(d));
  });
  saveHabits(habits);
  renderHabits();
}

// Remainder System for Habits
function checkHabitsRemainder() {
  const now = new Date();
  const currentHour = now.getHours();
  const todayStr = now.toISOString().split('T')[0];

  // Check if it's past bedtime warning (9 PM)
  if (currentHour < 21) return null; // Before 9 PM

  // Check if user already dismissed remainder today
  const dismissedDate = storeGet('remainder_dismissed');
  if (dismissedDate === todayStr) return null;

  const habits = getHabits();
  const incomplete = [];

  HABITS.forEach(habit => {
    const habitData = habits[habit.id] || [];
    if (!habitData.includes(todayStr)) {
      incomplete.push(habit);
    }
  });

  return incomplete.length > 0 ? incomplete : null;
}

function renderHabitsRemainder() {
  const container = document.getElementById('habitsRemainder');
  if (!container) return;

  const incomplete = checkHabitsRemainder();

  if (!incomplete) {
    container.style.display = 'none';
    return;
  }

  const habitList = incomplete.map(h => `${h.icon} ${h.name}`).join(', ');

  container.innerHTML = `
    <div class="remainder-banner">
      <div class="remainder-icon">⏰</div>
      <div class="remainder-content">
        <div class="remainder-title">Time's running out!</div>
        <div class="remainder-text">You still have ${incomplete.length} habit${incomplete.length > 1 ? 's' : ''} left: ${habitList}</div>
      </div>
      <button class="remainder-dismiss" id="remainderDismiss">✓</button>
    </div>
  `;

  container.style.display = 'block';

  // Add dismiss handler
  container.querySelector('#remainderDismiss').addEventListener('click', () => {
    container.style.display = 'none';
    storeSet('remainder_dismissed', new Date().toISOString().split('T')[0]);
  });
}

// Tab Navigation
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const savedTab = storeGet('active_tab') || 'dashboard';

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('dashboardTab').style.display = tab === 'dashboard' ? 'block' : 'none';
      document.getElementById('habitsTab').style.display = tab === 'habits' ? 'block' : 'none';
      storeSet('active_tab', tab);
      if (tab === 'habits') renderHabits();
    });
  });

  // Set initial state
  tabBtns.forEach(btn => {
    if (btn.dataset.tab === savedTab) btn.click();
  });
}

document.getElementById('resetWeekBtn').addEventListener('click', resetWeekHabits);

// Check remainder when tab switches to habits
const originalInitTabs = initTabs;
initTabs = function() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const savedTab = storeGet('active_tab') || 'dashboard';

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('dashboardTab').style.display = tab === 'dashboard' ? 'block' : 'none';
      document.getElementById('habitsTab').style.display = tab === 'habits' ? 'block' : 'none';
      document.getElementById('reviewTab').style.display = tab === 'review' ? 'block' : 'none';
      storeSet('active_tab', tab);
      if (tab === 'habits') {
        renderHabits();
        renderHabitsRemainder();
      }
      if (tab === 'review') renderReview();
    });
  });

  // Set initial state
  tabBtns.forEach(btn => {
    if (btn.dataset.tab === savedTab) btn.click();
  });
};

// Review Tab Functions
function getWeekDates() {
  const dates = [];
  const today = new Date();

  // Go back 6 days, then loop forward to today
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 6);

  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function getMonthDates() {
  const dates = [];
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < daysInMonth; i++) {
    const d = new Date(year, month, i + 1);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function getPreviousMonthDates() {
  const dates = [];
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < daysInMonth; i++) {
    const d = new Date(year, month, i + 1);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function calculateWeeklyStats() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Get last 7 days in chronological order
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  // Build day stats in fixed Sun-Sat order
  const dayStats = [];
  let totalGoals = 0;
  let completedGoals = 0;

  dayNames.forEach((dayName, dayIndex) => {
    // Find the date in our 7-day range that matches this day of week
    const matchingDate = dates.find(d => new Date(d + 'T12:00:00').getDay() === dayIndex);
    const goals = matchingDate ? getGoals(matchingDate) : [];
    const done = goals.filter(g => g.done).length;
    const total = goals.length;
    const isToday = matchingDate === todayStr;

    totalGoals += total;
    completedGoals += done;

    dayStats.push({
      day: dayName,
      done,
      total,
      isToday
    });
  });

  const percent = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;
  return { totalGoals, completedGoals, percent, dayStats };
}

function calculateMonthlyStats() {
  const monthDates = getMonthDates();
  const prevMonthDates = getPreviousMonthDates();

  let thisMonthTotal = 0;
  let thisMonthDone = 0;
  let thisMonthDays = 0;
  let perfectDays = 0;
  const dailyStats = [];

  monthDates.forEach(dateStr => {
    const goals = getGoals(dateStr);
    const done = goals.filter(g => g.done).length;
    const total = goals.length;

    if (total > 0) {
      thisMonthTotal += total;
      thisMonthDone += done;
      thisMonthDays++;

      if (done === total && total > 0) {
        perfectDays++;
      }
    }

    dailyStats.push({ date: dateStr, done, total });
  });

  // Previous month
  let lastMonthTotal = 0;
  let lastMonthDone = 0;
  prevMonthDates.forEach(dateStr => {
    const goals = getGoals(dateStr);
    lastMonthTotal += goals.length;
    lastMonthDone += goals.filter(g => g.done).length;
  });

  const percent = thisMonthTotal > 0 ? Math.round((thisMonthDone / thisMonthTotal) * 100) : 0;
  const avgCompletion = thisMonthDays > 0 ? Math.round((thisMonthDone / thisMonthTotal) * 100) : 0;

  // Calculate month comparison
  const lastMonthPercent = lastMonthTotal > 0 ? Math.round((lastMonthDone / lastMonthTotal) * 100) : 0;
  const change = percent - lastMonthPercent;

  return {
    totalGoals: thisMonthTotal,
    completedGoals: thisMonthDone,
    percent,
    perfectDays,
    avgCompletion,
    dailyStats,
    lastMonthTotal: lastMonthTotal,
    lastMonthDone: lastMonthDone,
    lastMonthPercent,
    change
  };
}

function getHabitStats() {
  const habits = getHabits();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartStr = monthStart.toISOString().split('T')[0];

  return HABITS.map(habit => {
    const habitData = habits[habit.id] || [];
    const thisMonth = habitData.filter(d => d >= monthStartStr).length;
    const total = habitData.length;
    return { ...habit, thisMonth, total };
  });
}

function renderWeeklyStats() {
  const stats = calculateWeeklyStats();
  const circumference = 2 * Math.PI * 42;

  // Weekly ring
  const weeklyRing = document.getElementById('weeklyRingFill');
  const weeklyOffset = circumference * (1 - stats.percent / 100);
  weeklyRing.style.strokeDasharray = circumference;
  weeklyRing.style.strokeDashoffset = weeklyOffset;

  document.getElementById('weeklyPercentRing').textContent = stats.percent + '%';
  document.getElementById('weeklyGoalsDetail').textContent = stats.completedGoals + ' / ' + stats.totalGoals;

  // Streaks
  const goalStreak = storeGet('goal_streak_v1') || { count: 0 };
  document.getElementById('goalStreakVal').textContent = goalStreak.count;

  const totalHabitStreak = Math.min(...HABITS.map(h => getHabitStreak(h.id)));
  document.getElementById('habitStreakVal').textContent = totalHabitStreak;

  // Weekly heatmap
  const heatmapContainer = document.getElementById('weeklyHeatmap');
  heatmapContainer.innerHTML = stats.dayStats.map(d => {
    const barHeight = d.total > 0 ? (d.done / d.total) * 100 : 5; // min 5% height
    const barClass = d.total > 0 ? 'done' : 'empty';
    return `
      <div class="heatmap-day ${d.isToday ? 'today' : ''}">
        <span class="day-label">${d.day}</span>
        <div class="day-bar">
          <div class="day-bar-segment ${barClass}" style="height: ${barHeight}%"></div>
        </div>
        <span class="day-stats"><span class="done-count">${d.done}</span>/${d.total}</span>
      </div>
    `;
  }).join('');
}

function renderHabitBreakdown(filter) {
  var container = document.getElementById('habitCards');
  var today = new Date();
  var habits = getHabits();

  var html = '';
  HABITS.forEach(function(habit) {
    var habitData = habits[habit.id] || [];
    var stats = getHabitStatsForPeriod(habitData, filter, today);
    var isExpanded = false;

    html += '<div class="habit-card" data-habit="' + habit.id + '">';
    html += '<div class="habit-card-header">';
    html += '<span class="habit-card-icon">' + habit.icon + '</span>';
    html += '<span class="habit-card-name">' + habit.name + '</span>';
    html += '<span class="habit-card-streak">' + stats.streak + ' day streak</span>';
    html += '</div>';
    html += '<div class="habit-card-stats">';
    html += '<div class="habit-stat"><span class="habit-stat-value">' + stats.completed + '</span><span class="habit-stat-label">Completed</span></div>';
    html += '<div class="habit-stat"><span class="habit-stat-value">' + stats.rate + '%</span><span class="habit-stat-label">Rate</span></div>';
    html += '<div class="habit-stat"><span class="habit-stat-value">' + stats.bestStreak + '</span><span class="habit-stat-label">Best</span></div>';
    html += '</div>';
    html += '<div class="habit-card-bar"><div class="habit-card-bar-fill" style="width: ' + stats.rate + '%; background: ' + habit.color + '"></div></div>';
    html += '</div>';
  });

  container.innerHTML = html;

  // Add click handlers for expand
  var cards = container.querySelectorAll('.habit-card');
  for (var i = 0; i < cards.length; i++) {
    cards[i].addEventListener('click', function() {
      this.classList.toggle('expanded');
    });
  }
}

function getHabitStatsForPeriod(habitData, filter, today) {
  var completed = 0;
  var bestStreak = 0;
  var currentStreak = 0;
  var totalDays = 0;

  if (filter === 'week') {
    totalDays = 7;
    for (var i = 6; i >= 0; i--) {
      var d = new Date(today);
      d.setDate(today.getDate() - i);
      var dateStr = d.toISOString().split('T')[0];
      if (habitData.indexOf(dateStr) > -1) {
        completed++;
        currentStreak++;
        if (currentStreak > bestStreak) bestStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    }
  } else if (filter === 'month') {
    totalDays = today.getDate();
    for (var j = 1; j <= totalDays; j++) {
      var dateObj = new Date(today.getFullYear(), today.getMonth(), j);
      var dateStr2 = dateObj.toISOString().split('T')[0];
      if (habitData.indexOf(dateStr2) > -1) {
        completed++;
        currentStreak++;
        if (currentStreak > bestStreak) bestStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    }
  } else {
    totalDays = habitData.length;
    completed = habitData.length;
    // Calculate best streak from all-time
    var sorted = habitData.slice().sort();
    for (var k = 0; k < sorted.length; k++) {
      if (k === 0 || sorted[k] !== sorted[k-1]) {
        currentStreak = 1;
      } else {
        currentStreak++;
      }
      if (currentStreak > bestStreak) bestStreak = currentStreak;
    }
  }

  var streak = getHabitStreak(HABITS.find(function(h) { return h.id === getCurrentHabitId(habitData); }).id);
  var rate = totalDays > 0 ? Math.round((completed / totalDays) * 100) : 0;

  return { completed: completed, rate: rate, streak: streak, bestStreak: bestStreak };
}

function getCurrentHabitId(habitData) {
  var today = new Date().toISOString().split('T')[0];
  for (var i = 0; i < HABITS.length; i++) {
    var habits = getHabits();
    if ((habits[HABITS[i].id] || []).indexOf(today) > -1) {
      return HABITS[i].id;
    }
  }
  return 'water';
}

function renderMonthlyStats() {
  const stats = calculateMonthlyStats();
  const circumference = 2 * Math.PI * 42;

  // Monthly ring
  const monthlyRing = document.getElementById('monthlyRingFill');
  const monthlyOffset = circumference * (1 - stats.percent / 100);
  monthlyRing.style.strokeDasharray = circumference;
  monthlyRing.style.strokeDashoffset = monthlyOffset;

  document.getElementById('monthlyPercentRing').textContent = stats.percent + '%';
  document.getElementById('monthlyGoalsDetail').textContent = stats.completedGoals + ' / ' + stats.totalGoals;

  // Compare to last month
  document.getElementById('thisMonthVal').textContent = stats.completedGoals;
  document.getElementById('lastMonthVal').textContent = stats.lastMonthDone;

  const compareEl = document.getElementById('compareChange');
  if (stats.change > 0) {
    compareEl.textContent = '+' + stats.change + '%';
    compareEl.className = 'compare-change positive';
  } else if (stats.change < 0) {
    compareEl.textContent = stats.change + '%';
    compareEl.className = 'compare-change negative';
  } else {
    compareEl.textContent = '0%';
    compareEl.className = 'compare-change neutral';
  }

  // Habit Breakdown
  const activeFilter = storeGet('habit_breakdown_filter') || 'week';
  renderHabitBreakdown(activeFilter);

  // Filter button listeners
  document.querySelectorAll('.habit-filter-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.habit-filter-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      storeSet('habit_breakdown_filter', filter);
      renderHabitBreakdown(filter);
    });
  });

  // Monthly chart (all days of current month)
  const chartContainer = document.getElementById('monthlyChart');
  var year = today.getFullYear();
  var month = today.getMonth();

  // Get all days of the month
  var monthData = [];
  for (var day = 1; day <= daysInMonth; day++) {
    var dateObj = new Date(year, month, day);
    var dateStr = dateObj.toISOString().split('T')[0];
    var goals = getGoals(dateStr);
    var doneCount = 0;
    for (var i = 0; i < goals.length; i++) {
      if (goals[i].done) doneCount++;
    }
    monthData.push({
      day: day,
      done: doneCount,
      total: goals.length
    });
  }

  var maxDone = 1;
  for (var j = 0; j < monthData.length; j++) {
    if (monthData[j].done > maxDone) maxDone = monthData[j].done;
  }

  var html = '';
  for (var k = 0; k < monthData.length; k++) {
    var h = monthData[k].total > 0 ? (monthData[k].done / maxDone) * 100 : 0;
    html += '<div class="chart-bar"><div class="chart-bar-fill" style="height: ' + h + '%"></div><span class="chart-bar-label">' + monthData[k].day + '</span></div>';
  }
  chartContainer.innerHTML = html;

  // Quick stats
  document.getElementById('totalGoalsThisMonth').textContent = stats.totalGoals;
  document.getElementById('perfectDays').textContent = stats.perfectDays;
  document.getElementById('avgCompletion').textContent = stats.avgCompletion + '%';
  document.getElementById('consistencyScore').textContent = stats.percent + '%';
}

function renderReview() {
  renderWeeklyStats();
  renderMonthlyStats();
}

init();
