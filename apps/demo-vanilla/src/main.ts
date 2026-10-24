import { SAMPLE_FLOORPLAN, type Floorplan } from '@open-seats/core';
import { createViewer, type ViewerInstance } from '@open-seats/viewer';
import {
  createEditor,
  type EditorInstance,
  type ToolType,
} from '@open-seats/editor';

let currentFloorplan: Floorplan = structuredClone(SAMPLE_FLOORPLAN);
let currentMode: 'viewer' | 'editor' = 'viewer';

let viewerInstance: ViewerInstance | null = null;
let editorInstance: EditorInstance | null = null;

const canvasContainer = document.getElementById(
  'canvasContainer'
) as HTMLDivElement;
const editorToolbar = document.getElementById('editorToolbar') as HTMLElement;
const eventFeed = document.getElementById('eventFeed') as HTMLElement;
const selectedPanel = document.getElementById('selectedPanel') as HTMLElement;
const selectedSeatsList = document.getElementById(
  'selectedSeatsList'
) as HTMLElement;
const selectionBadge = document.getElementById('selectionBadge') as HTMLElement;

const btnModeViewer = document.getElementById(
  'btnModeViewer'
) as HTMLButtonElement;
const btnModeEditor = document.getElementById(
  'btnModeEditor'
) as HTMLButtonElement;
const btnUndo = document.getElementById('btnUndo') as HTMLButtonElement;
const btnRedo = document.getElementById('btnRedo') as HTMLButtonElement;
const btnToggleGrid = document.getElementById(
  'btnToggleGrid'
) as HTMLButtonElement;
const btnTogglePreview = document.getElementById(
  'btnTogglePreview'
) as HTMLButtonElement;
const btnZoomIn = document.getElementById('btnZoomIn') as HTMLButtonElement;
const btnZoomOut = document.getElementById('btnZoomOut') as HTMLButtonElement;
const btnResetZoom = document.getElementById(
  'btnResetZoom'
) as HTMLButtonElement;
const btnExport = document.getElementById('btnExport') as HTMLButtonElement;
const btnReserve = document.getElementById('btnReserve') as HTMLButtonElement;
const btnClearSel = document.getElementById('btnClearSel') as HTMLButtonElement;

// Preset sample statuses for realism
const initialStatuses: Record<string, string> = {
  's-a-1a': 'reserved',
  's-a-1b': 'reserved',
  's-a-2a': 'locked',
  's-b-5a': 'reserved',
  's-b-5b': 'reserved',
  's-c-8a': 'reserved',
};

function logEvent(name: string, detail: string) {
  const row = document.createElement('div');
  row.className = 'event-row';
  const time = new Date().toLocaleTimeString().split(' ')[0];

  const prefix = document.createTextNode(`[${time}] `);
  const nameSpan = document.createElement('span');
  nameSpan.className = 'event-name';
  nameSpan.textContent = name;
  const colon = document.createTextNode(': ');
  const detailSpan = document.createElement('span');
  detailSpan.className = 'event-detail';
  detailSpan.textContent = detail;

  row.appendChild(prefix);
  row.appendChild(nameSpan);
  row.appendChild(colon);
  row.appendChild(detailSpan);
  eventFeed.prepend(row);

  if (eventFeed.children.length > 30 && eventFeed.lastChild) {
    eventFeed.removeChild(eventFeed.lastChild);
  }
}

function initViewerMode() {
  if (editorInstance) {
    currentFloorplan = editorInstance.getFloorplan();
    editorInstance.destroy();
    editorInstance = null;
  }

  canvasContainer.innerHTML = '';
  editorToolbar.style.display = 'none';

  viewerInstance = createViewer(canvasContainer, {
    floorplan: currentFloorplan,
    statuses: initialStatuses,
    maxSelectable: 8,
    tooltipProvider: async (ctx) => {
      // Realistic async tooltip data
      const isVip = ctx.row.id.includes('vip') || ctx.row.label === 'A';
      return {
        title: `Seat ${ctx.seat.label}`,
        subtitle: `${ctx.building.label} • Row ${ctx.row.label}`,
        content: `${isVip ? '⭐ VIP Tier - $150' : 'Standard Tier - $65'} • Status: ${viewerInstance?.getStatus(ctx.seat.id)}`,
      };
    },
  });

  viewerInstance.on('ready', () => {
    logEvent('ready', 'Viewer initialized and floorplan loaded');
  });

  viewerInstance.on('seatHovered', (ctx) => {
    logEvent('hover', `${ctx.seat.label} (${ctx.row.label})`);
  });

  viewerInstance.on('seatSelected', (ctx) => {
    logEvent('selected', ctx.seat.label);
  });

  viewerInstance.on('seatDeselected', (ctx) => {
    logEvent('deselected', ctx.seat.label);
  });

  viewerInstance.on(
    'selectionChanged',
    ({ selectedSeatIds, selectedSeats }) => {
      const count = selectedSeatIds.length;
      const countEl = document.getElementById('countSelected');
      if (countEl) {
        countEl.textContent = count.toString();
      }

      if (count > 0) {
        selectedPanel.style.display = 'block';
        selectionBadge.style.display = 'inline-block';
        selectionBadge.textContent = `${count} selected`;
        selectedSeatsList.textContent = selectedSeats
          .map((s) => s.seat.label)
          .join(', ');
      } else {
        selectedPanel.style.display = 'none';
        selectionBadge.style.display = 'none';
        selectedSeatsList.textContent = '';
      }
    }
  );

  logEvent('mode', 'Switched to Viewer Mode');
}

function initEditorMode() {
  if (viewerInstance) {
    currentFloorplan = viewerInstance.getFloorplan() || currentFloorplan;
    viewerInstance.destroy();
    viewerInstance = null;
  }

  canvasContainer.innerHTML = '';
  editorToolbar.style.display = 'flex';
  selectedPanel.style.display = 'none';
  selectionBadge.style.display = 'none';

  editorInstance = createEditor(canvasContainer, {
    floorplan: currentFloorplan,
    gridSnapping: { enabled: false, size: 20 },
  });

  editorInstance.on('change', () => {
    btnUndo.disabled = !editorInstance?.canUndo();
    btnRedo.disabled = !editorInstance?.canRedo();
    logEvent('change', 'Floorplan modified');
  });

  editorInstance.on('toolChange', (tool) => {
    document.querySelectorAll('.tool-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tool') === tool);
    });
    logEvent('tool', tool);
  });

  editorInstance.on('previewToggle', (isPreview) => {
    btnTogglePreview.textContent = isPreview
      ? 'Back to Editor'
      : 'Toggle Preview';
    btnTogglePreview.classList.toggle('btn-primary', !isPreview);
    logEvent('preview', isPreview ? 'ON' : 'OFF');
  });

  btnUndo.disabled = true;
  btnRedo.disabled = true;
  logEvent('mode', 'Switched to Editor Mode');
}

// Mode Buttons
btnModeViewer.addEventListener('click', () => {
  if (currentMode === 'viewer') return;
  currentMode = 'viewer';
  btnModeViewer.classList.add('active');
  btnModeEditor.classList.remove('active');
  initViewerMode();
});

btnModeEditor.addEventListener('click', () => {
  if (currentMode === 'editor') return;
  currentMode = 'editor';
  btnModeEditor.classList.add('active');
  btnModeViewer.classList.remove('active');
  initEditorMode();
});

// Tool Buttons
document.querySelectorAll('.tool-btn').forEach((button) => {
  button.addEventListener('click', () => {
    if (!editorInstance) return;
    const tool = button.getAttribute('data-tool') as ToolType;
    editorInstance.setTool(tool);

    if (tool === 'row') {
      // Programmatic demonstration of row creation
      const bld = editorInstance.getFloorplan().buildings[0];
      if (bld) {
        const row = editorInstance.createRow(bld.id, { x: 160, y: 580 }, 8, {
          side: 'both',
          seatSpacing: 42,
          seatRadius: 13,
          tableWidth: 26,
        });
        if (row) logEvent('create', `Added Row ${row.label}`);
      }
    } else if (tool === 'add-seat') {
      const bld = editorInstance.getFloorplan().buildings[0];
      if (bld && bld.rows.length > 0) {
        const lastRow = bld.rows[bld.rows.length - 1];
        const seat = editorInstance.addSeatToRow(bld.id, lastRow.id, 'a');
        if (seat) logEvent('create', `Added seat to Row ${lastRow.label}`);
      }
    } else if (tool === 'zone') {
      const bld = editorInstance.getFloorplan().buildings[0];
      if (bld) {
        const zone = editorInstance.createZone(
          bld.id,
          [
            { x: 0, y: 0 },
            { x: 120, y: 0 },
            { x: 120, y: 60 },
            { x: 0, y: 60 },
          ],
          '#065f46',
          { x: 50, y: 660 }
        );
        if (zone) logEvent('create', `Added Lounge Zone`);
      }
    }
  });
});

// History & Grid
btnUndo.addEventListener('click', () => editorInstance?.undo());
btnRedo.addEventListener('click', () => editorInstance?.redo());

btnToggleGrid.addEventListener('click', () => {
  if (!editorInstance) return;
  const next = !editorInstance.isGridSnappingEnabled();
  editorInstance.setGridSnapping(next);
  btnToggleGrid.textContent = `Grid Snap: ${next ? 'ON (20px)' : 'OFF'}`;
  btnToggleGrid.classList.toggle('btn-primary', next);
});

btnTogglePreview.addEventListener('click', () => {
  editorInstance?.togglePreview();
});

// Zoom & Pan
btnZoomIn.addEventListener('click', () => {
  if (currentMode === 'viewer') {
    viewerInstance?.zoomIn(1.2);
  } else {
    editorInstance?.zoomIn(1.2);
  }
});

btnZoomOut.addEventListener('click', () => {
  if (currentMode === 'viewer') {
    viewerInstance?.zoomOut(1.2);
  } else {
    editorInstance?.zoomOut(1.2);
  }
});

btnResetZoom.addEventListener('click', () => {
  if (currentMode === 'viewer') {
    viewerInstance?.resetZoom();
  } else {
    editorInstance?.resetZoom();
  }
});

// Export JSON
btnExport.addEventListener('click', () => {
  const plan =
    currentMode === 'viewer'
      ? viewerInstance?.getFloorplan()
      : editorInstance?.getFloorplan();
  const jsonStr = JSON.stringify(plan ?? currentFloorplan, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'floorplan.json';
  a.click();
  URL.revokeObjectURL(url);
  logEvent('export', 'Floorplan downloaded as floorplan.json');
});

// Reservation actions
btnReserve.addEventListener('click', () => {
  if (!viewerInstance) return;
  const selected = viewerInstance.getSelectedSeatIds();
  const updateMap: Record<string, string> = {};
  for (const id of selected) {
    updateMap[id] = 'reserved';
  }
  viewerInstance.setStatuses(updateMap);
  viewerInstance.clearSelection();
  logEvent('reserved', `Successfully reserved ${selected.length} seat(s)`);
});

btnClearSel.addEventListener('click', () => {
  viewerInstance?.clearSelection();
});

// Start in Viewer mode
initViewerMode();
