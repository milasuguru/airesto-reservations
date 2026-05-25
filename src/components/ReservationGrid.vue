<template>
  <div class="grid-outer">

    <!-- ─── TOP-LEFT corner ─── -->
    <div class="corner">
      <span>Время</span>
    </div>

    <!-- ─── TABLES HEADER (sticky top, scrolls horizontally) ─── -->
    <div class="tables-header-wrap" ref="tablesHeaderRef">
      <div class="tables-header" :style="{ width: totalWidth + 'px' }">
        <div
          v-for="table in tables"
          :key="table.id"
          class="th-cell"
          :class="{ selected: selectionMode && selection.tableIds.has(table.id) }"
          :style="{ width: COL_W + 'px' }"
          @click="onTableHeaderClick(table.id)"
        >
          <div class="th-num">#{{ table.number }} <span class="th-cap">{{ table.capacity }}чел</span></div>
          <div class="th-zone">{{ table.zone }}</div>
        </div>
      </div>
    </div>

    <!-- ─── TIME COLUMN (sticky left, scrolls vertically) ─── -->
    <div class="time-col-wrap" ref="timeColRef">
      <div class="time-col" :style="{ height: totalHeight + 'px' }">
        <div
          v-for="slot in timeSlots"
          :key="slot.minutes"
          class="tc-cell"
          :class="{ 'tc-current': isCurrentSlot(slot.minutes) }"
          :style="{ height: ROW_H + 'px' }"
        >
          {{ slot.label }}
        </div>
      </div>
    </div>

    <!-- ─── MAIN SCROLL AREA ─── -->
    <div class="scroll-area" ref="scrollAreaRef" @scroll="onScroll">
      <div
        class="grid-canvas"
        :style="{ width: totalWidth + 'px', height: totalHeight + 'px' }"
      >
        <!-- Grid lines: horizontal (time rows) -->
        <div
          v-for="slot in timeSlots"
          :key="'hline-' + slot.minutes"
          class="h-line"
          :style="{ top: slotTop(slot.minutes) + 'px', width: totalWidth + 'px' }"
        ></div>

        <!-- Grid lines: vertical (table columns) -->
        <div
          v-for="(table, ci) in tables"
          :key="'vline-' + table.id"
          class="v-line"
          :style="{ left: ci * COL_W + 'px', height: totalHeight + 'px' }"
        ></div>

        <!-- Selection cells -->
        <template v-if="selectionMode">
          <div
            v-for="(table, ci) in tables"
            :key="'selcol-' + table.id"
            class="sel-col"
            :style="{ left: ci * COL_W + 'px', width: COL_W + 'px', height: totalHeight + 'px' }"
          >
            <div
              v-for="slot in timeSlots"
              :key="slot.minutes"
              class="sel-cell"
              :class="{ active: isSlotSelected(table.id, slot.minutes) }"
              :style="{ height: ROW_H + 'px' }"
              @click="onCellClick(slot.minutes, table.id)"
            ></div>
          </div>
        </template>

        <!-- Current time horizontal line -->
        <div
          v-if="currentMinutes !== null && currentLineY >= 0"
          class="current-line"
          :style="{ top: currentLineY + 'px', width: totalWidth + 'px' }"
        >
          <div class="current-dot"></div>
        </div>

        <!-- Events -->
        <template v-for="(table, colIndex) in tables" :key="table.id + '-events'">
          <EventBlock
            v-for="(event, ei) in getTableEvents(table, colIndex)"
            :key="event.id"
            :event="event"
            :is-dark="isDark"
          />
        </template>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { isoToMinutes } from '../utils/time.js'
import { processEvents } from '../utils/events.js'
import EventBlock from './EventBlock.vue'

const props = defineProps({
  tables: Array,
  timeSlots: Array,
  openingMinutes: Number,
  currentMinutes: Number,
  selectedDay: String,
  selectionMode: Boolean,
  selection: Object,
  isDark: Boolean
})

const emit = defineEmits(['select-cell', 'select-table'])

const COL_W = 120  // px per table column
const ROW_H = 48   // px per 30-min row

const scrollAreaRef = ref(null)
const tablesHeaderRef = ref(null)
const timeColRef = ref(null)

const totalWidth = computed(() => props.tables.length * COL_W)
const totalHeight = computed(() => props.timeSlots.length * ROW_H)

// Convert minutes to Y position
function minutesToY(minutes) {
  const rel = minutes - props.openingMinutes
  return rel * (ROW_H / 30)
}

function slotTop(slotMinutes) {
  return minutesToY(slotMinutes)
}

// Current time line Y
const currentLineY = computed(() => {
  if (props.currentMinutes === null) return -1
  const y = minutesToY(props.currentMinutes)
  if (y < 0 || y > totalHeight.value) return -1
  return y
})

function isCurrentSlot(slotMinutes) {
  if (props.currentMinutes === null) return false
  return slotMinutes <= props.currentMinutes && props.currentMinutes < slotMinutes + 30
}

// Sync scroll
function onScroll() {
  const sa = scrollAreaRef.value
  if (!sa) return
  if (tablesHeaderRef.value) tablesHeaderRef.value.scrollLeft = sa.scrollLeft
  if (timeColRef.value) timeColRef.value.scrollTop = sa.scrollTop
}

// Events positioned absolutely inside grid-canvas
function getTableEvents(table, colIndex) {
  const events = processEvents(table, props.openingMinutes)

  // Detect overlaps within this column and assign lane
  const positioned = events.map(ev => {
    const startMin = isoToMinutes(ev.startIso)
    const endMin = isoToMinutes(ev.endIso)
    const top = minutesToY(startMin)
    const height = Math.max(20, minutesToY(endMin) - top)
    return { ...ev, top, height, startMin, endMin, colIndex, lane: 0, totalLanes: 1 }
  })

  // Simple overlap detection: assign lanes
  for (let i = 0; i < positioned.length; i++) {
    for (let j = 0; j < i; j++) {
      if (positioned[i].startMin < positioned[j].endMin && positioned[i].endMin > positioned[j].startMin) {
        positioned[i].lane = positioned[j].lane + 1
        positioned[i].totalLanes = Math.max(positioned[j].totalLanes, positioned[i].lane + 1)
        positioned[j].totalLanes = positioned[i].totalLanes
      }
    }
  }

  return positioned.map(ev => {
    const laneW = COL_W / ev.totalLanes
    return {
      ...ev,
      style: {
        position: 'absolute',
        top: ev.top + 1 + 'px',
        height: ev.height - 2 + 'px',
        left: ev.colIndex * COL_W + ev.lane * laneW + 2 + 'px',
        width: laneW - 4 + 'px',
      }
    }
  })
}

function isSlotSelected(tableId, slotMin) {
  const s = props.selection
  return s.tableIds.has(tableId) &&
    s.startMin !== null &&
    slotMin >= s.startMin &&
    slotMin < s.endMin
}

function onCellClick(minutes, tableId) {
  emit('select-cell', { minutes, tableId })
  emit('select-table', { tableId })
}

function onTableHeaderClick(tableId) {
  if (props.selectionMode) emit('select-table', { tableId })
}

// Scroll to current time on mount
onMounted(async () => {
  await nextTick()
  if (scrollAreaRef.value && currentLineY.value > 0) {
    const sa = scrollAreaRef.value
    const scrollTo = Math.max(0, currentLineY.value - sa.clientHeight / 3)
    sa.scrollTop = scrollTo
  }
})
</script>

<style scoped>
/* Outer grid: 2 cols (time-col | main) × 2 rows (header | body) */
.grid-outer {
  display: grid;
  grid-template-columns: 64px 1fr;
  grid-template-rows: 56px 1fr;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bg);
}

/* ── Corner ── */
.corner {
  grid-column: 1; grid-row: 1;
  background: var(--surface);
  border-right: 2px solid var(--border);
  border-bottom: 2px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 600; color: var(--text2);
  z-index: 30;
}

/* ── Tables header ── */
.tables-header-wrap {
  grid-column: 2; grid-row: 1;
  background: var(--surface);
  border-bottom: 2px solid var(--border);
  overflow: hidden;
  z-index: 20;
}
.tables-header {
  display: flex;
  height: 100%;
}
.th-cell {
  flex-shrink: 0;
  height: 100%;
  border-right: 1px solid var(--border);
  padding: 6px 8px;
  display: flex; flex-direction: column; justify-content: center;
  cursor: pointer;
  transition: background 0.15s;
  user-select: none;
}
.th-cell:hover { background: var(--surface2); }
.th-cell.selected { background: rgba(59,110,248,0.15); }
.th-num { font-size: 13px; font-weight: 700; color: var(--text); display: flex; align-items: baseline; gap: 4px; }
.th-cap { font-size: 10px; font-weight: 400; color: var(--text2); }
.th-zone { font-size: 10px; color: var(--text2); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ── Time column ── */
.time-col-wrap {
  grid-column: 1; grid-row: 2;
  background: var(--surface);
  border-right: 2px solid var(--border);
  overflow: hidden;
  z-index: 20;
}
.time-col {
  display: flex; flex-direction: column;
}
.tc-cell {
  flex-shrink: 0;
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 4px;
  font-size: 11px; color: var(--text2);
  font-variant-numeric: tabular-nums;
  border-bottom: 1px solid var(--border);
  transition: color 0.2s;
}
.tc-cell.tc-current {
  color: var(--accent);
  font-weight: 700;
}

/* ── Main scroll area ── */
.scroll-area {
  grid-column: 2; grid-row: 2;
  overflow: auto;
  position: relative;
}

/* ── Canvas ── */
.grid-canvas {
  position: relative;
  background: var(--surface2);
}

/* Grid lines */
.h-line {
  position: absolute;
  left: 0;
  height: 1px;
  background: var(--border);
  pointer-events: none;
}
.v-line {
  position: absolute;
  top: 0;
  width: 1px;
  background: var(--border);
  pointer-events: none;
}

/* Selection */
.sel-col {
  position: absolute;
  top: 0;
}
.sel-cell {
  width: 100%;
  cursor: crosshair;
  transition: background 0.1s;
}
.sel-cell:hover { background: rgba(59,110,248,0.07); }
.sel-cell.active { background: rgba(59,110,248,0.18) !important; }

/* Current time line */
.current-line {
  position: absolute;
  left: 0;
  height: 2px;
  background: #ef4444;
  z-index: 10;
  pointer-events: none;
}
.current-dot {
  position: absolute;
  left: -4px;
  top: -4px;
  width: 10px; height: 10px;
  background: #ef4444;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 0 4px rgba(239,68,68,0.5);
}
</style>
