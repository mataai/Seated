<script setup lang="ts">
/**
 * Live demo of @open-seats/viewer and @open-seats/editor, running from source.
 * The packages touch the DOM, so they're imported on mount only (never during
 * the static build).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Building, Floorplan, Row } from '@open-seats/core';
import type {
  SeatData,
  StatusChanges,
  StatusSink,
  StatusSource,
  TooltipContext,
  ViewerInstance,
} from '@open-seats/viewer';
import type { EditorInstance } from '@open-seats/editor';

type Tab = 'viewer' | 'editor';
interface LogEntry {
  id: number;
  text: string;
  kind: 'info' | 'warn' | 'live';
}

const tab = ref<Tab>('viewer');
const loading = ref(true);
const viewerEl = ref<HTMLDivElement>();
const editorEl = ref<HTMLDivElement>();

let viewer: ViewerInstance | null = null;
let editor: EditorInstance | null = null;
let plan: Floorplan;
let cloneFloorplan: <T>(p: T) => T;

// ---------------------------------------------------------------------------
// A tiny in-memory "booking server". In a real app this is your backend plus
// a Socket.IO server; here a StatusSource talks to it directly.
// ---------------------------------------------------------------------------
const server = {
  rev: 0,
  statuses: {} as Record<string, string>,
  data: {} as Record<string, SeatData>,
  sinks: new Set<StatusSink>(),
  publish(changes: StatusChanges, data?: Record<string, SeatData | null>) {
    for (const [id, s] of Object.entries(changes)) {
      if (s === null) delete this.statuses[id];
      else this.statuses[id] = s;
    }
    for (const [id, d] of Object.entries(data ?? {})) {
      if (d === null) delete this.data[id];
      else this.data[id] = d;
    }
    this.rev += 1;
    for (const sink of this.sinks) sink.patch(changes, this.rev, data);
  },
};

const demoSource: StatusSource = {
  subscribe(sink) {
    server.sinks.add(sink);
    sink.snapshot({ ...server.statuses }, server.rev, { ...server.data });
    sink.connectionState('live');
    return () => server.sinks.delete(sink);
  },
};

// ---------------------------------------------------------------------------
// Viewer state shown next to the map
// ---------------------------------------------------------------------------
const maxSelectable = ref(4);
const simulate = ref(false);
const selected = ref<{ id: string; label: string; price: number }[]>([]);
const counts = ref({ available: 0, reserved: 0, locked: 0, mine: 0 });
const log = ref<LogEntry[]>([]);
const myTickets = new Map<string, SeatData>();
let logId = 0;
let ticketNo = 1000;
let botTimer: ReturnType<typeof setInterval> | undefined;

const total = computed(() =>
  selected.value.reduce((sum, seat) => sum + seat.price, 0)
);

function addLog(text: string, kind: LogEntry['kind'] = 'info') {
  log.value = [{ id: ++logId, text, kind }, ...log.value].slice(0, 6);
}

function basePrice(building: Building, row: Row): number {
  if (building.id.includes('vip')) return 150;
  return row.label === 'A' ? 95 : 65;
}

function allSeats() {
  return plan.buildings.flatMap((building) =>
    building.rows.flatMap((row) =>
      row.seats.map((seat) => ({ seat, row, building }))
    )
  );
}

function priceOf(seatId: string): number {
  const live = viewer?.getSeatData(seatId)?.['price'];
  if (typeof live === 'number') return live;
  const ctx = allSeats().find((c) => c.seat.id === seatId);
  return ctx ? basePrice(ctx.building, ctx.row) : 0;
}

function refreshPanel() {
  if (!viewer) return;
  const c = { available: 0, reserved: 0, locked: 0, mine: 0 };
  const selectedIds = new Set(viewer.getSelectedSeatIds());
  for (const { seat } of allSeats()) {
    if (myTickets.has(seat.id)) c.mine++;
    else if (selectedIds.has(seat.id)) continue;
    else {
      const status = viewer.getStatus(seat.id) as keyof typeof c;
      if (status in c) c[status]++;
    }
  }
  counts.value = c;
  selected.value = viewer.getSelectedSeats().map(({ seat }) => ({
    id: seat.id,
    label: seat.label,
    price: priceOf(seat.id),
  }));
}

// Custom tooltip, rendered with plain DOM through `tooltipRenderer`.
function renderTip(card: HTMLElement, ctx: TooltipContext) {
  const ticket = ctx.data?.['ticket'];
  const livePrice = ctx.data?.['price'];
  const price =
    typeof livePrice === 'number'
      ? livePrice
      : basePrice(ctx.building, ctx.row);
  const title = document.createElement('div');
  title.className = 'os-tip-title';
  title.textContent = ctx.seat.label;
  const status = document.createElement('span');
  status.className = `os-tip-status os-tip-${ticket ? 'mine' : ctx.status}`;
  status.textContent = ticket ? 'yours' : ctx.status;
  title.append(status);
  const body = document.createElement('div');
  body.className = 'os-tip-body';
  body.textContent = ticket
    ? `🎟 Ticket ${String(ticket)}`
    : `$${price}${typeof livePrice === 'number' ? ' · live price' : ''}`;
  card.replaceChildren(title, body);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
function reserveSelected() {
  if (!viewer || selected.value.length === 0) return;
  const seats = selected.value;
  // Clear first, so our own booking isn't reported as "taken by someone else".
  viewer.clearSelection();
  for (const seat of seats) {
    myTickets.set(seat.id, { ticket: `T-${++ticketNo}` });
  }
  viewer.setSeatData(Object.fromEntries(myTickets), { replace: true });
  server.publish(Object.fromEntries(seats.map((s) => [s.id, 'reserved'])));
  addLog(`You booked ${seats.map((s) => s.label).join(', ')}`);
}

function botTick() {
  const seats = allSeats();
  const pick = seats[Math.floor(Math.random() * seats.length)].seat;
  if (myTickets.has(pick.id)) return;
  const current = server.statuses[pick.id];
  if (current === 'locked') return;
  const reprice = seats[Math.floor(Math.random() * seats.length)].seat;
  const price = 40 + 5 * Math.floor(Math.random() * 20);
  server.publish(
    { [pick.id]: current === 'reserved' ? null : 'reserved' },
    { [reprice.id]: { price } }
  );
  addLog(
    current === 'reserved'
      ? `${pick.label} was released`
      : `Another customer booked ${pick.label}`,
    'live'
  );
}

function setSimulate(on: boolean) {
  simulate.value = on;
  clearInterval(botTimer);
  botTimer = on ? setInterval(botTick, 1500) : undefined;
}

function setMax(n: number) {
  maxSelectable.value = n;
  viewer?.setMaxSelectable(n);
}

function resetDemo() {
  setSimulate(false);
  myTickets.clear();
  server.statuses = {
    's-a-1a': 'reserved',
    's-a-2a': 'reserved',
    's-b-5a': 'locked',
  };
  server.data = {};
  server.rev = 0;
  viewer?.setSeatData({}, { replace: true });
  // Reconnecting the source delivers a fresh snapshot.
  viewer?.setStatusSource(demoSource);
  viewer?.clearSelection();
  log.value = [];
  addLog('Demo reset');
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------
const editorTool = ref('select');
const canUndo = ref(false);
const canRedo = ref(false);
const editorMessage = ref('');
let editorModule: typeof import('@open-seats/editor') | null = null;
let buildingCount = 0;

function editorDo(action: string) {
  if (!editor) return;
  switch (action) {
    case 'select':
    case 'pan':
      editor.setTool(action);
      break;
    case 'building':
      editor.startBuildingCreation(`Hall ${++buildingCount}`, 'rectangle');
      editorMessage.value = 'Click two opposite corners.';
      break;
    case 'row':
      editor.startRowCreation({
        side: 'both',
        seatSpacing: 36,
        seatRadius: 13,
        tableWidth: 22,
      });
      editorMessage.value = 'Click two points inside a building.';
      break;
    case 'undo':
      editor.undo();
      break;
    case 'redo':
      editor.redo();
      break;
    case 'delete':
      for (const id of editor.getSelectedNodeIds()) editor.deleteNode(id);
      break;
    case 'sample':
      editor.loadFloorplan(cloneFloorplan(initialPlan));
      break;
  }
}

let initialPlan: Floorplan;

async function showTab(next: Tab) {
  if (next === tab.value) return;
  if (tab.value === 'editor' && editor) {
    // Hand the edited floorplan over to the viewer.
    plan = editor.getFloorplan();
    viewer?.load(plan);
    refreshPanel();
  }
  tab.value = next;
  await nextTick();
  if (next === 'editor' && !editor && editorModule && editorEl.value) {
    editor = editorModule.createEditor(editorEl.value, {
      floorplan: cloneFloorplan(plan),
      gridSnapping: { enabled: true, size: 10 },
    });
    editor.on('toolChange', (t) => {
      editorTool.value = t;
      if (t === 'select') editorMessage.value = '';
    });
    editor.on('change', () => {
      canUndo.value = editor?.canUndo() ?? false;
      canRedo.value = editor?.canRedo() ?? false;
    });
    editor.on(
      'buildingCreationFailed',
      ({ reason }) => (editorMessage.value = reason)
    );
    editor.on(
      'rowCreationFailed',
      ({ reason }) => (editorMessage.value = reason)
    );
    editor.on('buildingCreationCompleted', (building) => {
      editorMessage.value = `${building.label} added. Now add a row inside it.`;
    });
    editor.on('rowCreationCompleted', (row) => {
      editorMessage.value = `Row ${row.label} with ${row.seats.length} seats added.`;
    });
  } else if (next === 'editor' && editor) {
    editor.loadFloorplan(cloneFloorplan(plan));
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
onMounted(async () => {
  const [core, viewerPkg, editorPkg] = await Promise.all([
    import('@open-seats/core'),
    import('@open-seats/viewer'),
    import('@open-seats/editor'),
  ]);
  cloneFloorplan = core.cloneFloorplan;
  editorModule = editorPkg;
  initialPlan = core.cloneFloorplan(core.SAMPLE_FLOORPLAN);
  plan = core.cloneFloorplan(initialPlan);
  server.statuses = {
    's-a-1a': 'reserved',
    's-a-2a': 'reserved',
    's-b-5a': 'locked',
  };
  loading.value = false;
  await nextTick();
  if (!viewerEl.value) return;

  viewer = viewerPkg.createViewer(viewerEl.value, {
    floorplan: plan,
    maxSelectable: maxSelectable.value,
    statusSource: demoSource,
    tooltipDebounceMs: 80,
    tooltipRenderer: (ctx, host) => {
      const card = document.createElement('div');
      card.className = 'os-tip';
      renderTip(card, ctx);
      host.appendChild(card);
      return { update: (next) => renderTip(card, next) };
    },
  });

  viewer.on('selectionChanged', refreshPanel);
  viewer.on('statusesChanged', refreshPanel);
  viewer.on('seatDataChanged', refreshPanel);
  viewer.on('selectionInvalidated', ({ seats }) => {
    addLog(
      `${seats.map((s) => s.seat.label).join(', ')} was taken while selected`,
      'warn'
    );
  });
  refreshPanel();
});

onBeforeUnmount(() => {
  clearInterval(botTimer);
  viewer?.destroy();
  editor?.destroy();
});
</script>

<template>
  <div class="os-demo">
    <div class="os-tabs" role="tablist">
      <button
        role="tab"
        :aria-selected="tab === 'viewer'"
        :class="{ active: tab === 'viewer' }"
        @click="showTab('viewer')"
      >
        Viewer
      </button>
      <button
        role="tab"
        :aria-selected="tab === 'editor'"
        :class="{ active: tab === 'editor' }"
        @click="showTab('editor')"
      >
        Editor
      </button>
    </div>

    <div v-if="loading" class="os-loading">Loading the demo…</div>

    <!-- Viewer -->
    <div v-show="!loading && tab === 'viewer'" class="os-layout">
      <div ref="viewerEl" class="os-canvas" />
      <aside class="os-panel">
        <section>
          <h3>Seats</h3>
          <ul class="os-legend">
            <li>
              <span class="dot available" />Available
              <b>{{ counts.available }}</b>
            </li>
            <li>
              <span class="dot selected" />Selected <b>{{ selected.length }}</b>
            </li>
            <li>
              <span class="dot reserved" />Reserved <b>{{ counts.reserved }}</b>
            </li>
            <li>
              <span class="dot locked" />Locked <b>{{ counts.locked }}</b>
            </li>
            <li>
              <span class="dot mine" />Yours <b>{{ counts.mine }}</b>
            </li>
          </ul>
        </section>

        <section>
          <h3>Max seats</h3>
          <div class="os-segment">
            <button
              v-for="n in [1, 4, 8]"
              :key="n"
              :class="{ active: maxSelectable === n }"
              @click="setMax(n)"
            >
              {{ n }}
            </button>
          </div>
        </section>

        <section>
          <h3>Your selection</h3>
          <p v-if="selected.length === 0" class="os-muted">
            Click seats on the map.
          </p>
          <ul v-else class="os-selection">
            <li v-for="seat in selected" :key="seat.id">
              {{ seat.label }} <span>${{ seat.price }}</span>
            </li>
          </ul>
          <button
            class="os-primary"
            :disabled="selected.length === 0"
            @click="reserveSelected"
          >
            Reserve{{ selected.length ? ` · $${total}` : '' }}
          </button>
        </section>

        <section>
          <label class="os-switch">
            <input
              type="checkbox"
              :checked="simulate"
              @change="setSimulate(($event.target as HTMLInputElement).checked)"
            />
            Simulate other customers
          </label>
          <p class="os-muted">
            Books seats and changes prices live, like a server would.
          </p>
        </section>

        <section class="os-log">
          <h3>Activity</h3>
          <p v-if="log.length === 0" class="os-muted">Nothing yet.</p>
          <ul>
            <li v-for="entry in log" :key="entry.id" :class="entry.kind">
              {{ entry.text }}
            </li>
          </ul>
        </section>

        <button class="os-link" @click="resetDemo">Reset demo</button>
      </aside>
    </div>

    <!-- Editor -->
    <div v-show="!loading && tab === 'editor'" class="os-editor">
      <div class="os-toolbar">
        <button
          :class="{ active: editorTool === 'select' }"
          @click="editorDo('select')"
        >
          Select
        </button>
        <button
          :class="{ active: editorTool === 'pan' }"
          @click="editorDo('pan')"
        >
          Pan
        </button>
        <button
          :class="{ active: editorTool === 'building' }"
          @click="editorDo('building')"
        >
          + Building
        </button>
        <button
          :class="{ active: editorTool === 'row' }"
          @click="editorDo('row')"
        >
          + Row
        </button>
        <span class="os-sep" />
        <button :disabled="!canUndo" @click="editorDo('undo')">Undo</button>
        <button :disabled="!canRedo" @click="editorDo('redo')">Redo</button>
        <button @click="editorDo('delete')">Delete</button>
        <span class="os-sep" />
        <button @click="editorDo('sample')">Load sample</button>
        <span class="os-hint">{{
          editorMessage || 'Drag to move. Switch to Viewer to try your plan.'
        }}</span>
      </div>
      <div ref="editorEl" class="os-canvas os-editor-canvas" />
    </div>
  </div>
</template>

<style scoped>
.os-demo {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}
.os-tabs {
  display: flex;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
}
.os-tabs button,
.os-segment button,
.os-toolbar button {
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  transition:
    background 0.15s,
    color 0.15s;
}
.os-tabs button:hover,
.os-toolbar button:hover:not(:disabled) {
  color: var(--vp-c-text-1);
  background: var(--vp-c-default-soft);
}
.os-tabs button.active,
.os-segment button.active,
.os-toolbar button.active {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}
.os-loading {
  height: 560px;
  display: grid;
  place-items: center;
  color: var(--vp-c-text-2);
}
.os-layout {
  display: grid;
  grid-template-columns: 1fr 280px;
  height: 560px;
}
.os-canvas {
  position: relative;
  min-width: 0;
  height: 100%;
  background: #111114;
}
.os-panel {
  overflow-y: auto;
  padding: 16px;
  border-left: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  display: flex;
  flex-direction: column;
  gap: 18px;
  font-size: 14px;
}
.os-panel h3 {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--vp-c-text-2);
}
.os-legend,
.os-selection,
.os-log ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.os-legend li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
}
.os-legend b {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.dot.available {
  background: #4caf50;
}
.dot.selected {
  background: #2196f3;
}
.dot.reserved {
  background: #9e9e9e;
}
.dot.locked {
  background: #f44336;
}
.dot.mine {
  background: #9e9e9e;
  box-shadow: 0 0 0 2px #a5b4fc;
}
.os-segment {
  display: inline-flex;
  gap: 4px;
  padding: 3px;
  border-radius: 10px;
  background: var(--vp-c-default-soft);
}
.os-selection li {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
}
.os-selection span {
  color: var(--vp-c-text-2);
  font-variant-numeric: tabular-nums;
}
.os-primary {
  width: 100%;
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  font-weight: 600;
  color: #fff;
  background: var(--vp-c-brand-3);
}
.os-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.os-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  cursor: pointer;
}
.os-muted {
  margin: 4px 0 0;
  color: var(--vp-c-text-3);
  font-size: 13px;
  line-height: 1.4;
}
.os-log li {
  padding: 3px 0 3px 8px;
  border-left: 2px solid var(--vp-c-divider);
  font-size: 13px;
  line-height: 1.35;
  margin-bottom: 4px;
}
.os-log li.live {
  border-color: #6366f1;
}
.os-log li.warn {
  border-color: #f59e0b;
}
.os-link {
  align-self: flex-start;
  font-size: 13px;
  color: var(--vp-c-brand-1);
}
.os-editor {
  display: flex;
  flex-direction: column;
  height: 600px;
}
.os-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
}
.os-toolbar button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.os-sep {
  width: 1px;
  height: 20px;
  margin: 0 4px;
  background: var(--vp-c-divider);
}
.os-hint {
  margin-left: auto;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.os-editor-canvas {
  flex: 1;
}
@media (max-width: 760px) {
  .os-layout {
    grid-template-columns: 1fr;
    height: auto;
  }
  .os-layout .os-canvas {
    height: 420px;
  }
  .os-panel {
    border-left: 0;
    border-top: 1px solid var(--vp-c-divider);
  }
}
</style>

<style>
/* Tooltip content lives in the viewer's tooltip host, outside this component. */
.os-tip {
  min-width: 170px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(24, 24, 27, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  color: #fafafa;
  font: 13px/1.4 var(--vp-font-family-base);
}
.os-tip-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-weight: 600;
}
.os-tip-status {
  padding: 0 7px;
  border-radius: 999px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: rgba(76, 175, 80, 0.2);
  color: #86efac;
}
.os-tip-reserved {
  background: rgba(158, 158, 158, 0.2);
  color: #d4d4d8;
}
.os-tip-locked {
  background: rgba(244, 67, 54, 0.2);
  color: #fca5a5;
}
.os-tip-mine {
  background: rgba(99, 102, 241, 0.3);
  color: #c7d2fe;
}
.os-tip-body {
  margin-top: 4px;
  color: #d4d4d8;
}
</style>
