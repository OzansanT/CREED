export const LAYOUT_PRESETS = Object.freeze({
  full: Object.freeze({ primaryVisible: true, secondaryVisible: true, terminalVisible: true }),
  canvas: Object.freeze({ primaryVisible: false, secondaryVisible: false, terminalVisible: false }),
  code: Object.freeze({ primaryVisible: true, secondaryVisible: false, terminalVisible: true }),
  compact: Object.freeze({ primaryVisible: true, secondaryVisible: false, terminalVisible: false })
});

export function createLayoutPresets({ panelResize, settingsStore, notify }) {
  function apply(name) {
    const preset = LAYOUT_PRESETS[name];
    if (!preset) throw new Error(`Unknown layout preset: ${name}`);
    panelResize.applyLayout(preset);
    settingsStore.set({ layoutPreset: name });
    notify?.(`Applied ${name} layout`);
    return panelResize.getState();
  }
  return Object.freeze({ apply, list: () => Object.keys(LAYOUT_PRESETS), getActive: () => settingsStore.get().layoutPreset });
}
