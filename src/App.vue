<template>
  <div class="app" :class="{ 'dark': isDark }">
    <header class="app-header">
      <div class="header-left">
        <div class="logo">
          <span class="logo-icon">🍽</span>
          <span class="logo-name">{{ data?.restaurant?.restaurant_name || 'Airesto' }}</span>
        </div>
        <div class="current-time" v-if="data?.restaurant">
          <span class="time-label">Время ресторана:</span>
          <span class="time-value">{{ restaurantTimeStr }}</span>
          <span class="tz-badge">{{ data.restaurant.timezone }}</span>
        </div>
      </div>

      <div class="header-right">
        <button class="theme-btn" @click="isDark = !isDark" :title="isDark ? 'Светлая тема' : 'Тёмная тема'">
          <span v-if="isDark">☀️</span>
          <span v-else>🌙</span>
        </button>
      </div>
    </header>

    <div class="toolbar" v-if="data">
      <!-- Date switcher -->
      <div class="date-switcher">
        <button class="nav-btn" @click="prevDay" :disabled="currentDayIndex <= 0">‹</button>
        <div class="date-tabs">
          <button
            v-for="(day, i) in data.available_days"
            :key="day"
            class="date-tab"
            :class="{ active: day === selectedDay }"
            @click="selectDay(day)"
          >
            {{ formatDateShort(day) }}
          </button>
        </div>
        <button class="nav-btn" @click="nextDay" :disabled="currentDayIndex >= data.available_days.length - 1">›</button>
      </div>

      <!-- Zone filters -->
      <div class="zone-filters">
        <span class="filter-label">Зоны:</span>
        <button
          v-for="zone in allZones"
          :key="zone"
          class="zone-btn"
          :class="{ active: activeZones.has(zone) }"
          @click="toggleZone(zone)"
        >
          {{ zone }}
        </button>
      </div>

      <!-- Selection mode -->
      <div class="selection-toolbar" v-if="selectionMode">
        <span class="sel-info" v-if="selection.tableIds.size > 0 || selection.startMin !== null">
          <span v-if="selection.tableIds.size > 0">Столы: {{ [...selection.tableIds].join(', ') }}</span>
          <span v-if="selection.startMin !== null"> | {{ minToHHMM(selection.startMin) }} – {{ minToHHMM(selection.endMin) }}</span>
        </span>
        <button class="create-btn" @click="createReservation" :disabled="!canCreate">
          Создать
        </button>
        <button class="cancel-sel-btn" @click="cancelSelection">Отмена</button>
      </div>

      <button class="select-mode-btn" :class="{ active: selectionMode }" @click="toggleSelectionMode">
        {{ selectionMode ? '✕ Выход' : '⊞ Выбрать' }}
      </button>

      <!-- Hide content button -->
      <button class="hide-btn" @click="contentHidden = !contentHidden">
        {{ contentHidden ? '👁 Показать' : '🙈 Скрыть' }}
      </button>
    </div>

    <div class="main-content" :class="{ hidden: contentHidden }">
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <span>Загрузка бронирований...</span>
      </div>

      <div v-else-if="error" class="error">
        ⚠️ {{ error }}
      </div>

      <ReservationGrid
        v-else-if="data"
        :tables="filteredTables"
        :time-slots="timeSlots"
        :opening-minutes="openingMinutes"
        :current-minutes="currentMinutes"
        :selected-day="selectedDay"
        :selection-mode="selectionMode"
        :selection="selection"
        :is-dark="isDark"
        @select-cell="onSelectCell"
        @select-table="onSelectTable"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { fetchReservations } from './mockData.js'
import { generateTimeSlots, formatDateShort, getCurrentMinutes, getRestaurantTime, formatTime } from './utils/time.js'
import ReservationGrid from './components/ReservationGrid.vue'

const data = ref(null)
const loading = ref(false)
const error = ref(null)
const selectedDay = ref(null)
const isDark = ref(false)
const contentHidden = ref(false)
const selectionMode = ref(false)
const activeZones = ref(new Set())

const selection = ref({
  tableIds: new Set(),
  startMin: null,
  endMin: null,
  dragging: false
})

// Restaurant time
const restaurantTimeStr = ref('')
let clockTimer = null

function updateClock() {
  if (data.value?.restaurant?.timezone) {
    const t = getRestaurantTime(data.value.restaurant.timezone)
    restaurantTimeStr.value = formatTime(t)
  }
}

const currentMinutes = computed(() => {
  if (!data.value?.restaurant?.timezone) return null
  const t = getRestaurantTime(data.value.restaurant.timezone)
  return t.getHours() * 60 + t.getMinutes()
})

// Time grid
const openingMinutes = computed(() => {
  if (!data.value?.restaurant) return 11 * 60
  const [h, m] = data.value.restaurant.opening_time.split(':').map(Number)
  return h * 60 + m
})

const timeSlots = computed(() => {
  if (!data.value?.restaurant) return []
  return generateTimeSlots(data.value.restaurant.opening_time, data.value.restaurant.closing_time, 30)
})

// Zones
const allZones = computed(() => {
  if (!data.value?.tables) return []
  return [...new Set(data.value.tables.map(t => t.zone))]
})

const filteredTables = computed(() => {
  if (!data.value?.tables) return []
  return data.value.tables.filter(t => activeZones.value.has(t.zone))
})

// Day navigation
const currentDayIndex = computed(() => {
  if (!data.value) return 0
  return data.value.available_days.indexOf(selectedDay.value)
})

function prevDay() {
  if (currentDayIndex.value > 0) {
    selectDay(data.value.available_days[currentDayIndex.value - 1])
  }
}

function nextDay() {
  if (data.value && currentDayIndex.value < data.value.available_days.length - 1) {
    selectDay(data.value.available_days[currentDayIndex.value + 1])
  }
}

async function selectDay(day) {
  selectedDay.value = day
  await loadData(day)
}

function toggleZone(zone) {
  const z = new Set(activeZones.value)
  if (z.has(zone)) {
    z.delete(zone)
  } else {
    z.add(zone)
  }
  activeZones.value = z
}

// Load data
async function loadData(day) {
  loading.value = true
  error.value = null
  try {
    const result = await fetchReservations(day)
    data.value = result
    if (!selectedDay.value) {
      selectedDay.value = result.current_day
    }
    // Init zones
    if (activeZones.value.size === 0) {
      activeZones.value = new Set(result.tables.map(t => t.zone))
    }
    updateClock()
  } catch (e) {
    error.value = 'Не удалось загрузить данные: ' + e.message
  } finally {
    loading.value = false
  }
}

// Selection
function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  if (!selectionMode.value) cancelSelection()
}

function cancelSelection() {
  selection.value = { tableIds: new Set(), startMin: null, endMin: null, dragging: false }
  selectionMode.value = false
}

function onSelectCell({ minutes, tableId }) {
  if (!selectionMode.value) return
  const s = selection.value

  if (s.startMin === null) {
    selection.value = { ...s, startMin: minutes, endMin: minutes + 30 }
  } else {
    const newEnd = minutes + 30
    selection.value = {
      ...s,
      startMin: Math.min(s.startMin, minutes),
      endMin: Math.max(s.endMin, newEnd)
    }
  }
}

function onSelectTable({ tableId }) {
  if (!selectionMode.value) return
  const ids = new Set(selection.value.tableIds)
  if (ids.has(tableId)) ids.delete(tableId)
  else ids.add(tableId)
  selection.value = { ...selection.value, tableIds: ids }
}

const canCreate = computed(() => {
  return selection.value.tableIds.size > 0 && selection.value.startMin !== null
})

function minToHHMM(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

function createReservation() {
  if (!canCreate.value) return
  const s = selection.value
  console.log('=== Новое бронирование ===')
  console.log('ID столов:', [...s.tableIds])
  console.log('Время начала:', minToHHMM(s.startMin))
  console.log('Время окончания:', minToHHMM(s.endMin))
  console.log('=========================')
  alert(`Бронирование создано!\nСтолы: ${[...s.tableIds].join(', ')}\n${minToHHMM(s.startMin)} – ${minToHHMM(s.endMin)}\n(см. консоль)`)
  cancelSelection()
}

onMounted(async () => {
  await loadData(null)
  clockTimer = setInterval(updateClock, 1000)
})

onUnmounted(() => {
  clearInterval(clockTimer)
})

// Export formatDateShort for template
</script>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #f0f2f5;
  --surface: #ffffff;
  --surface2: #f7f8fa;
  --border: #e2e5eb;
  --text: #1a1d23;
  --text2: #5a6072;
  --accent: #3b6ef8;
  --accent2: #6c47ff;
  --header-bg: #1e2130;
  --header-text: #ffffff;
  --shadow: 0 2px 12px rgba(0,0,0,0.08);
  --radius: 10px;
  --cell-h: 56px;
  --col-w: 120px;
  --time-col-w: 60px;
  --table-col-w: 90px;
}

.dark {
  --bg: #0f1117;
  --surface: #1a1d2e;
  --surface2: #141625;
  --border: #2a2d3e;
  --text: #e8eaf0;
  --text2: #8891aa;
  --accent: #4f7eff;
  --header-bg: #0d0f1a;
  --shadow: 0 2px 12px rgba(0,0,0,0.4);
}

body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  transition: background 0.3s, color 0.3s;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

/* HEADER */
.app-header {
  background: var(--header-bg);
  color: var(--header-text);
  padding: 0 20px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  z-index: 100;
}

.header-left { display: flex; align-items: center; gap: 24px; }
.logo { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 18px; }
.logo-icon { font-size: 22px; }

.current-time { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.time-label { color: rgba(255,255,255,0.5); }
.time-value { font-weight: 700; font-size: 16px; font-variant-numeric: tabular-nums; letter-spacing: 0.5px; }
.tz-badge { background: rgba(255,255,255,0.1); border-radius: 4px; padding: 2px 6px; font-size: 11px; color: rgba(255,255,255,0.6); }

.theme-btn {
  background: rgba(255,255,255,0.1);
  border: none;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.2s;
}
.theme-btn:hover { background: rgba(255,255,255,0.2); }

/* TOOLBAR */
.toolbar {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 10px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  flex-shrink: 0;
  z-index: 90;
}

.date-switcher { display: flex; align-items: center; gap: 4px; }
.nav-btn {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 6px;
  width: 28px; height: 28px;
  font-size: 16px;
  cursor: pointer;
  color: var(--text);
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.nav-btn:hover:not(:disabled) { background: var(--accent); color: #fff; border-color: var(--accent); }
.nav-btn:disabled { opacity: 0.3; cursor: default; }

.date-tabs { display: flex; gap: 4px; }
.date-tab {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  color: var(--text2);
  transition: all 0.15s;
  white-space: nowrap;
}
.date-tab:hover { border-color: var(--accent); color: var(--accent); }
.date-tab.active { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }

.zone-filters { display: flex; align-items: center; gap: 6px; }
.filter-label { font-size: 12px; color: var(--text2); white-space: nowrap; }
.zone-btn {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  color: var(--text2);
  transition: all 0.15s;
}
.zone-btn.active { background: var(--accent2); border-color: var(--accent2); color: #fff; }
.zone-btn:hover { border-color: var(--accent2); }

.select-mode-btn {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
  color: var(--text2);
  transition: all 0.15s;
  margin-left: auto;
}
.select-mode-btn.active { background: #e8f0ff; border-color: var(--accent); color: var(--accent); }
.dark .select-mode-btn.active { background: rgba(59,110,248,0.2); }

.hide-btn {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
  color: var(--text2);
  transition: all 0.15s;
}
.hide-btn:hover { border-color: var(--accent); color: var(--accent); }

.selection-toolbar { display: flex; align-items: center; gap: 8px; }
.sel-info { font-size: 12px; color: var(--text2); background: var(--surface2); border-radius: 6px; padding: 4px 10px; border: 1px solid var(--border); }
.create-btn {
  background: #22c55e; border: none; border-radius: 6px;
  padding: 5px 14px; color: #fff; font-size: 12px; font-weight: 600;
  cursor: pointer; transition: background 0.15s;
}
.create-btn:hover:not(:disabled) { background: #16a34a; }
.create-btn:disabled { opacity: 0.4; cursor: default; }
.cancel-sel-btn {
  background: var(--surface2); border: 1px solid var(--border); border-radius: 6px;
  padding: 5px 10px; color: var(--text2); font-size: 12px; cursor: pointer;
}

/* MAIN */
.main-content {
  flex: 1;
  overflow: hidden;
  transition: opacity 0.3s;
}
.main-content.hidden { opacity: 0; pointer-events: none; }

.loading, .error {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100%; gap: 16px; color: var(--text2);
}

.spinner {
  width: 36px; height: 36px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
