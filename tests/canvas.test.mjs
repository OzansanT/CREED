import test from "node:test";
import assert from "node:assert/strict";
import { fitComponents } from "../canvas-navigation.js";
import { createCreedDocument } from "../creed-document.js";
import { createComponent } from "../component-registry.js";
import { getDescendantIds } from "../component-tree.js";
import { getViewportWorldCenter, localToWorld, worldToLocal } from "../coordinates.js";
import { buildHtmlExport, buildWordPressMapping } from "../export-engine.js";
import { getSelectionBounds } from "../selection-transform.js";
import { snapComponentPosition } from "../snapping.js";
import { createLandingHeroTemplate } from "../templates.js";
import { rebaseWorldIfNeeded } from "../world-origin.js";

test("landing template creates a navigable component tree", () => {
  const components = createLandingHeroTemplate({ x: 100, y: 200, startZ: 10 });
  assert.equal(components.length, 4);
  const parent = components[0];
  assert.equal(getDescendantIds(components, [parent.id]).length - 1, 3);
  const state = createCreedDocument({ components: [...createCreedDocument().components, ...components], selection: components.map((component) => component.id) });
  const bounds = getSelectionBounds(state);
  assert.ok(bounds.width >= parent.width);
  assert.ok(bounds.height >= parent.height);
});

test("grid and component snapping returns guides and bounds", () => {
  const target = createComponent("text", { id: "target", x: 100, y: 120, width: 200, height: 60 });
  const snapped = snapComponentPosition({ x: 104, y: 117, width: 100, height: 40, components: [target], zoom: 1 });
  assert.equal(snapped.x, 100);
  assert.equal(snapped.y, 120);
  assert.equal(snapped.guides.x, 100);
  assert.equal(snapped.bounds.left, 50);
});

test("world rebasing preserves logical coordinates and screen pixels", () => {
  const component = createComponent("text", { id: "moving", x: 600, y: -400 });
  const state = createCreedDocument({ components: [...createCreedDocument().components, component] });
  const moving = state.components.find((candidate) => candidate.id === component.id);
  state.viewport = { x: 300000, y: -280000, zoom: 1.5 };
  const beforeWorld = localToWorld(moving, state);
  const beforeScreen = { x: moving.x * state.viewport.zoom + state.viewport.x, y: moving.y * state.viewport.zoom + state.viewport.y };
  assert.equal(rebaseWorldIfNeeded(state), true);
  const afterWorld = localToWorld(moving, state);
  const afterScreen = { x: moving.x * state.viewport.zoom + state.viewport.x, y: moving.y * state.viewport.zoom + state.viewport.y };
  assert.deepEqual(afterWorld, beforeWorld);
  assert.deepEqual(afterScreen, beforeScreen);
  assert.deepEqual(worldToLocal(afterWorld, state), { x: moving.x, y: moving.y });
  const center = getViewportWorldCenter({ clientWidth: 1000, clientHeight: 600 }, state);
  assert.ok(Number.isFinite(center.x) && Number.isFinite(center.y));
});

test("fit navigation and exports produce usable output", () => {
  const text = createComponent("text", { id: "safe text", x: 400, y: 250, width: 240, height: 80, props: { text: "<hello>" } });
  const state = createCreedDocument({ components: [...createCreedDocument().components, text] });
  const fitted = fitComponents({ components: [text], state, canvas: { clientWidth: 900, clientHeight: 600 }, update: () => {} });
  assert.equal(fitted, true);
  assert.ok(state.viewport.zoom > 0);
  const html = buildHtmlExport(state);
  assert.match(html, /<!doctype html>/i);
  assert.ok(html.includes("&lt;hello&gt;"));
  assert.ok(!html.includes("<hello>"));
  assert.equal(buildWordPressMapping(state).blocks.some((block) => block.clientId === text.id), true);
});
