<template>
  <div
    class="event-block"
    :style="[event.style, blockColor]"
    @mouseenter="showTip = true"
    @mouseleave="showTip = false"
    @mousemove="onMove"
  >
    <div class="eb-inner">
      <div class="eb-title">{{ displayTitle }}</div>
      <div class="eb-sub" v-if="displaySub">{{ displaySub }}</div>
      <div class="eb-time">{{ startStr }}–{{ endStr }}</div>
    </div>

    <!-- Tooltip -->
    <Teleport to="body">
      <div
        v-if="showTip"
        class="ev-tooltip"
        :class="{ dark: isDark }"
        :style="{ top: tipY + 'px', left: tipX + 'px' }"
      >
        <div class="tip-head" :style="{ background: config.color }">
          <span>{{ config.label }}</span>
          <span class="tip-time-range">{{ startStr }} – {{ endStr }}</span>
        </div>
        <div class="tip-body">
          <template v-if="event.type === 'reservation'">
            <div class="tip-row"><span>Имя</span><strong>{{ event.name }}</strong></div>
            <div class="tip-row"><span>Гостей</span><strong>{{ event.numPeople }}</strong></div>
            <div class="tip-row"><span>Телефон</span><strong>{{ event.phone }}</strong></div>
            <div class="tip-row"><span>Статус</span><strong>{{ event.status }}</strong></div>
          </template>
          <template v-else>
            <div class="tip-row"><span>Тип</span><strong>{{ config.label }}</strong></div>
            <div class="tip-row"><span>Стол</span><strong>№{{ event.table.number }}</strong></div>
          </template>
          <div class="tip-dur">Длительность: {{ durationStr }}</div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { isoToMinutes } from '../utils/time.js'
import { getEventConfig } from '../utils/events.js'

const props = defineProps({
  event: Object,
  isDark: Boolean
})

const showTip = ref(false)
const tipX = ref(0)
const tipY = ref(0)

function onMove(e) {
  tipX.value = Math.min(e.clientX + 14, window.innerWidth - 220)
  tipY.value = Math.min(e.clientY + 14, window.innerHeight - 160)
}

const config = computed(() => getEventConfig(props.event))

const blockColor = computed(() => ({
  background: config.value.color + 'CC', // CC = ~80% opacity
  borderLeft: `3px solid ${config.value.borderColor}`,
}))

function isoToHHMM(iso) {
  const match = iso.match(/T(\d{2}:\d{2})/)
  return match ? match[1] : '??:??'
}

const startStr = computed(() => isoToHHMM(props.event.startIso))
const endStr = computed(() => isoToHHMM(props.event.endIso))

const durationStr = computed(() => {
  const diff = isoToMinutes(props.event.endIso) - isoToMinutes(props.event.startIso)
  if (diff <= 0) return '?'
  const h = Math.floor(diff / 60)
  const m = diff % 60
  if (h === 0) return `${m}мин`
  if (m === 0) return `${h}ч`
  return `${h}ч ${m}мин`
})

const displayTitle = computed(() => {
  if (props.event.type === 'reservation') return props.event.name
  return config.value.label
})

const displaySub = computed(() => {
  if (props.event.type === 'reservation' && props.event.numPeople) {
    return `${props.event.numPeople} гост.`
  }
  return null
})
</script>

<style scoped>
.event-block {
  position: absolute;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  transition: filter 0.15s, box-shadow 0.15s, transform 0.15s;
  z-index: 5;
}
.event-block:hover {
  filter: brightness(1.12);
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  transform: scaleX(1.02);
  z-index: 20;
}

.eb-inner {
  padding: 3px 6px;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.eb-title {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
  line-height: 1.2;
}
.eb-sub {
  font-size: 9px;
  color: rgba(255,255,255,0.85);
  line-height: 1.2;
  margin-top: 1px;
}
.eb-time {
  font-size: 9px;
  color: rgba(255,255,255,0.7);
  margin-top: 1px;
  font-variant-numeric: tabular-nums;
}

/* Tooltip */
.ev-tooltip {
  position: fixed;
  z-index: 9999;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  overflow: hidden;
  min-width: 200px;
  max-width: 240px;
  pointer-events: none;
  font-family: 'Segoe UI', system-ui, sans-serif;
  border: 1px solid #e2e5eb;
}
.ev-tooltip.dark {
  background: #1a1d2e;
  border-color: #2a2d3e;
}

.tip-head {
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.tip-head span { font-size: 12px; font-weight: 700; color: #fff; }
.tip-time-range { font-size: 11px; font-weight: 400; color: rgba(255,255,255,0.8); }

.tip-body { padding: 8px 12px; }
.tip-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 2px 0;
  gap: 8px;
}
.tip-row span { color: #888; }
.ev-tooltip.dark .tip-row span { color: #8891aa; }
.tip-row strong { color: #1a1d23; font-weight: 600; }
.ev-tooltip.dark .tip-row strong { color: #e8eaf0; }
.tip-dur {
  font-size: 11px;
  color: #aaa;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #f0f0f0;
}
.ev-tooltip.dark .tip-dur {
  color: #8891aa;
  border-top-color: #2a2d3e;
}
</style>
