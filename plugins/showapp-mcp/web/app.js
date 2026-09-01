const EMOJI_FAVORITES = ['✨', '🚀', '💎', '❤️', '🔥', '⭐️', '✅', '🎯', '📱', '🔒', '🌍', '⚡️', '🏆', '🎉', '💡', '🪄', '👀', '🤩', '💬', '📈', '🧠', '🎨', '🛍️', '☁️'];
const LAYER_ICONS = { text: '🔤', image: '🖼️', shape: '🔷', emoji: '✨' };
const COMPOSITION_PRESETS = {
  editorial: { label: 'Editorial', note: 'Bold copy, angled device', layout: { backgroundMode: 'shared', device: { frame: 'iphone', scale: 64, x: 50, y: 65, tilt: -4, rotateX: 0, rotateY: 0, radius: 68 } } },
  showcase: { label: 'Showcase', note: 'Centered product hero', layout: { backgroundMode: 'shared', device: { frame: 'iphone', scale: 72, x: 50, y: 62, tilt: 0, rotateX: 0, rotateY: 0, radius: 68 } } },
  perspective: { label: 'Perspective', note: 'Lightweight 3D depth', layout: { backgroundMode: 'shared', device: { frame: 'iphone', scale: 70, x: 52, y: 64, tilt: 1, rotateX: 4, rotateY: -14, radius: 68 } } },
  fullbleed: { label: 'Full bleed', note: 'Screenshot fills the canvas', layout: { backgroundMode: 'own', device: { frame: 'none', scale: 108, x: 50, y: 55, tilt: 0, rotateX: 0, rotateY: 0, radius: 0, fit: 'cover' } } },
};

const state = {
  projects: [],
  project: null,
  selectedScreenId: null,
  selectedLayerId: null,
  locale: null,
  mode: new URLSearchParams(location.search).get('mode') === 'canvas' ? 'canvas' : 'focus',
  inspectorTab: 'design',
  zoom: 0.22,
  renderMode: new URLSearchParams(location.search).get('render') === '1',
  pendingUploadKind: null,
  patchTimers: new Map(),
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function toast(message, type = 'success') {
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.textContent = message;
  $('#toast-region').append(item);
  setTimeout(() => item.remove(), 3200);
}

function deepMerge(target, patch) {
  const result = { ...(target || {}) };
  for (const [key, value] of Object.entries(patch || {})) {
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? deepMerge(result[key], value)
      : value;
  }
  return result;
}

function setByPath(object, path, value) {
  const keys = path.split('.');
  let cursor = object;
  for (const key of keys.slice(0, -1)) cursor = cursor[key] ||= {};
  cursor[keys.at(-1)] = value;
}

function valueFromInput(input) {
  if (input.type === 'checkbox') return input.checked;
  if (input.type === 'number' || input.type === 'range') return Number(input.value);
  return input.value;
}

function selectedScreen() {
  return state.project?.screens.find((screen) => screen.id === state.selectedScreenId) || state.project?.screens[0] || null;
}

function selectedLayer() {
  return selectedScreen()?.layers.find((layer) => layer.id === state.selectedLayerId) || null;
}

function defaultLocale() {
  return state.project?.locales.find((item) => item.isDefault)?.locale || state.project?.locales[0]?.locale || 'en-US';
}

function localizedValue(layer, locale = state.locale) {
  return layer?.localizations?.[locale]
    || layer?.localizations?.[defaultLocale()]
    || Object.values(layer?.localizations || {})[0]
    || {};
}

function screenAsset(screen, locale = state.locale) {
  return screen?.assets?.[locale]
    || screen?.assets?.[defaultLocale()]
    || Object.values(screen?.assets || {})[0]
    || null;
}

async function loadProjects(preferredProjectId) {
  const { projects } = await api('/api/projects');
  state.projects = projects;
  renderProjectSelect();
  const queryId = new URLSearchParams(location.search).get('project');
  const nextId = preferredProjectId || queryId || state.project?.id || projects[0]?.id;
  if (nextId) await loadProject(nextId);
  else if (!state.renderMode) $('#project-dialog').showModal();
}

async function loadProject(projectId, { preserveSelection = true } = {}) {
  const previousScreen = preserveSelection ? state.selectedScreenId : null;
  const previousLayer = preserveSelection ? state.selectedLayerId : null;
  const { project } = await api(`/api/projects/${encodeURIComponent(projectId)}`);
  state.project = project;
  state.selectedScreenId = project.screens.some((screen) => screen.id === previousScreen) ? previousScreen : project.screens[0]?.id || null;
  state.selectedLayerId = selectedScreen()?.layers.some((layer) => layer.id === previousLayer) ? previousLayer : null;
  state.locale = project.locales.some((locale) => locale.locale === state.locale) ? state.locale : defaultLocale();
  renderAll();
}

function renderProjectSelect() {
  const select = $('#project-select');
  select.innerHTML = state.projects.map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join('');
  if (state.project) select.value = state.project.id;
}

function renderAll() {
  if (!state.project) return;
  renderProjectSelect();
  renderLocaleSelect();
  renderModeButtons();
  renderScreenList();
  renderWorkspace();
  renderInspector();
}

function renderLocaleSelect() {
  const select = $('#locale-select');
  select.innerHTML = state.project.locales.map((locale) => `<option value="${escapeHtml(locale.locale)}">${escapeHtml(locale.label)} · ${escapeHtml(locale.locale)}</option>`).join('');
  select.value = state.locale;
}

function renderModeButtons() {
  $$('.mode-button').forEach((button) => button.classList.toggle('active', button.dataset.mode === state.mode));
}

function thumbnailBackground(screen, index) {
  const settings = screen.layout.backgroundMode === 'shared' ? state.project.settings.sharedBackground : screen.layout.background;
  if (settings?.type === 'gradient') {
    const colors = settings.colors?.length ? settings.colors : ['#f5f5f7', '#e8eefc'];
    return `linear-gradient(${Number(settings.angle) || 135}deg, ${colors.join(',')})`;
  }
  if (settings?.type === 'image' && settings.assetId) return `url(/api/assets/${settings.assetId}) center/cover`;
  return settings?.color || '#f5f5f7';
}

function renderScreenList() {
  const list = $('#screen-list');
  $('#screen-count').textContent = state.project.screens.length;
  list.innerHTML = '';
  state.project.screens.forEach((screen, index) => {
    const row = document.createElement('div');
    row.className = `screen-row ${screen.id === state.selectedScreenId ? 'selected' : ''}`;
    row.dataset.screenId = screen.id;
    row.innerHTML = `
      <span class="screen-index">${index + 1}</span>
      <div class="screen-meta">
        <div class="screen-thumb" style="background:${escapeHtml(thumbnailBackground(screen, index))}"></div>
        <div><strong>${escapeHtml(screen.name)}</strong><small>${screen.layers.length} layers · ${Object.keys(screen.assets).length} images</small></div>
      </div>
      <button class="row-menu" data-delete-screen="${screen.id}" title="Delete screen">×</button>`;
    row.addEventListener('click', (event) => {
      if (event.target.closest('[data-delete-screen]')) return;
      state.selectedScreenId = screen.id;
      state.selectedLayerId = null;
      renderAll();
    });
    list.append(row);
  });
  $$('[data-delete-screen]', list).forEach((button) => button.addEventListener('click', async () => {
    if (!confirm('Delete this screen and all its layers?')) return;
    await api(`/api/screens/${button.dataset.deleteScreen}`, { method: 'DELETE' });
    state.selectedScreenId = null;
    state.selectedLayerId = null;
    await loadProject(state.project.id, { preserveSelection: false });
    toast('Screen deleted.');
  }));
}

function backgroundStyle(screen, index) {
  const isShared = screen.layout.backgroundMode === 'shared';
  const background = isShared ? state.project.settings.sharedBackground : screen.layout.background;
  if (background?.type === 'image' && background.assetId) {
    const count = Math.max(1, state.project.screens.length);
    return {
      backgroundImage: `url(/api/assets/${background.assetId})`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: isShared ? `${count * (Number(background.scale) || 100)}% auto` : `${Number(background.scale) || 100}% auto`,
      backgroundPosition: isShared && count > 1 ? `${index * 100 / (count - 1)}% ${Number(background.positionY) || 50}%` : `${Number(background.positionX) || 50}% ${Number(background.positionY) || 50}%`,
    };
  }
  if (background?.type === 'gradient') {
    const colors = background.colors?.length ? background.colors : ['#f5f5f7', '#e8eefc'];
    const count = Math.max(1, state.project.screens.length);
    return {
      backgroundImage: `linear-gradient(${Number(background.angle) || 135}deg, ${colors.join(', ')})`,
      backgroundSize: isShared ? `${count * 100}% 100%` : '100% 100%',
      backgroundPosition: isShared && count > 1 ? `${index * 100 / (count - 1)}% 50%` : '50% 50%',
    };
  }
  return { background: background?.color || '#f5f5f7' };
}

function applyStyles(element, styles) {
  Object.assign(element.style, styles);
}

function createSourceDevice(screen) {
  const device = screen.layout.device || {};
  const asset = screenAsset(screen);
  const width = state.project.width * (Number(device.scale) || 72) / 100;
  const aspect = asset?.width && asset?.height ? asset.height / asset.width : 932 / 430;
  const height = Math.min(state.project.height * 0.89, width * aspect);
  const frame = device.frame || 'iphone';
  const element = document.createElement('div');
  element.className = `source-device frame-${frame}`;
  applyStyles(element, {
    left: `${Number(device.x) || 50}%`, top: `${Number(device.y) || 61}%`, width: `${width}px`, height: `${height}px`,
    padding: frame === 'none' ? '0' : `${Math.max(8, width * .028)}px`,
    borderRadius: frame === 'none' ? '0' : `${Number(device.radius) || Math.max(28, width * .08)}px`,
    transform: `translate(-50%, -50%) perspective(2200px) rotateX(${Number(device.rotateX) || 0}deg) rotateY(${Number(device.rotateY) || 0}deg) rotateZ(${Number(device.tilt) || 0}deg)`,
  });
  if (asset) {
    const image = document.createElement('img');
    image.src = asset.url;
    image.alt = '';
    image.style.objectFit = device.fit || 'cover';
    element.append(image);
  } else {
    const empty = document.createElement('div');
    empty.className = 'source-empty';
    empty.textContent = '📱';
    element.append(empty);
  }
  return element;
}

function applyLayerStyle(element, layer) {
  const props = layer.props || {};
  const widthPercent = Number(props.width) || (layer.type === 'text' ? 84 : 24);
  applyStyles(element, {
    left: `${Number(props.x) || 50}%`, top: `${Number(props.y) || 50}%`, width: `${widthPercent}%`,
    height: layer.type === 'text' || layer.type === 'emoji' ? 'auto' : `${Number(props.height) || 16}%`,
    transform: `translate(-50%, -50%) rotate(${Number(props.rotation) || 0}deg)`, opacity: String(props.opacity ?? 1),
    zIndex: String(20 + Number(layer.zIndex || 0)), display: layer.visible ? '' : 'none',
  });
}

function createLayerElement(layer, interactive) {
  const props = layer.props || {};
  const content = localizedValue(layer);
  const element = document.createElement('div');
  element.className = `design-layer layer-${layer.type} ${layer.id === state.selectedLayerId ? 'selected' : ''}`;
  element.dataset.layerId = layer.id;
  applyLayerStyle(element, layer);

  if (layer.type === 'text') {
    element.textContent = content.text || '';
    applyStyles(element, {
      color: props.color || '#111', fontFamily: props.fontFamily || '-apple-system, sans-serif', fontSize: `${Number(props.fontSize) || 96}px`,
      fontWeight: String(props.fontWeight || 700), lineHeight: String(props.lineHeight || 1.05), textAlign: props.align || 'center',
      justifyContent: ({ left: 'flex-start', center: 'center', right: 'flex-end' })[props.align] || 'center',
      letterSpacing: `${Number(props.letterSpacing) || 0}px`,
    });
  } else if (layer.type === 'emoji') {
    element.textContent = content.text || '✨';
    element.style.fontSize = `${Number(props.fontSize) || 180}px`;
  } else if (layer.type === 'shape') {
    applyStyles(element, { background: props.color || '#007aff', borderRadius: `${Number(props.cornerRadius) || 0}px` });
  } else if (layer.type === 'image') {
    const assetId = content.assetId || props.assetId;
    if (assetId) {
      const image = document.createElement('img');
      image.src = `/api/assets/${assetId}`;
      image.alt = '';
      image.style.objectFit = props.fit || 'contain';
      element.style.borderRadius = `${Number(props.cornerRadius) || 0}px`;
      element.append(image);
    }
  }

  if (interactive) {
    element.addEventListener('pointerdown', (event) => beginLayerDrag(event, layer, element));
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      state.selectedLayerId = layer.id;
      renderWorkspace();
      renderInspector();
    });
  }
  return element;
}

function createArtboard(screen, index, scale, renderOnly = false) {
  const wrapper = document.createElement('div');
  wrapper.className = `artboard-wrap ${screen.id === state.selectedScreenId ? 'selected' : ''}`;
  wrapper.style.width = `${state.project.width * scale}px`;
  wrapper.style.height = `${state.project.height * scale}px`;
  if (!renderOnly) wrapper.innerHTML = `<div class="artboard-label">${escapeHtml(screen.name)} <span>${index + 1} · ${escapeHtml(state.locale)}</span></div>`;

  const artboard = document.createElement('div');
  artboard.className = `artboard ${renderOnly ? 'render-artboard' : ''}`;
  applyStyles(artboard, {
    width: `${state.project.width}px`, height: `${state.project.height}px`, transform: `scale(${scale})`,
    borderRadius: renderOnly ? '0' : `${Math.max(20, 42 / Math.max(scale, .1))}px`,
  });
  const background = document.createElement('div');
  background.className = 'artboard-background';
  applyStyles(background, backgroundStyle(screen, index));
  artboard.append(background, createSourceDevice(screen));
  for (const layer of [...screen.layers].sort((a, b) => a.zIndex - b.zIndex)) artboard.append(createLayerElement(layer, !renderOnly));

  if (!renderOnly) artboard.addEventListener('click', () => {
    state.selectedScreenId = screen.id;
    state.selectedLayerId = null;
    renderAll();
  });
  wrapper.append(artboard);
  return wrapper;
}

function renderWorkspace() {
  const host = $('#artboard-host');
  host.innerHTML = '';
  const query = new URLSearchParams(location.search);
  if (state.renderMode) {
    document.body.classList.add('render-mode');
    const screenId = query.get('screen');
    const screen = state.project.screens.find((item) => item.id === screenId) || state.project.screens[0];
    if (query.get('locale')) state.locale = query.get('locale');
    if (screen) host.append(createArtboard(screen, state.project.screens.indexOf(screen), 1, true));
    Promise.all($$('img', host).map((image) => image.complete ? Promise.resolve() : image.decode().catch(() => {})))
      .then(() => document.fonts?.ready)
      .then(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      .then(() => { window.__SHOWAPP_RENDER_READY = true; });
    return;
  }

  host.className = `artboard-host ${state.mode}-mode`;
  const screens = state.mode === 'canvas' ? state.project.screens : [selectedScreen()].filter(Boolean);
  screens.forEach((screen) => host.append(createArtboard(screen, state.project.screens.indexOf(screen), state.zoom)));
  $('#zoom-label').textContent = `${Math.round(state.zoom * 100)}%`;
}

function beginLayerDrag(event, layer, element) {
  if (layer.locked || state.renderMode) return;
  event.stopPropagation();
  event.preventDefault();
  state.selectedLayerId = layer.id;
  const artboard = element.closest('.artboard');
  const rect = artboard.getBoundingClientRect();
  const start = { x: event.clientX, y: event.clientY, layerX: Number(layer.props.x) || 50, layerY: Number(layer.props.y) || 50 };
  element.setPointerCapture?.(event.pointerId);

  const move = (moveEvent) => {
    layer.props.x = Math.max(-20, Math.min(120, start.layerX + ((moveEvent.clientX - start.x) / rect.width) * 100));
    layer.props.y = Math.max(-20, Math.min(120, start.layerY + ((moveEvent.clientY - start.y) / rect.height) * 100));
    applyLayerStyle(element, layer);
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    schedulePatch('layer', layer.id, { props: { x: layer.props.x, y: layer.props.y } });
    renderInspector();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once: true });
}

function schedulePatch(kind, id, patch) {
  const key = `${kind}:${id}`;
  const pending = state.patchTimers.get(key) || { patch: {}, timer: null };
  pending.patch = deepMerge(pending.patch, patch);
  clearTimeout(pending.timer);
  pending.timer = setTimeout(async () => {
    state.patchTimers.delete(key);
    try {
      const route = kind === 'layer' ? `/api/layers/${id}` : kind === 'screen' ? `/api/screens/${id}` : `/api/projects/${id}`;
      await api(route, { method: 'PATCH', body: pending.patch });
    } catch (error) { toast(error.message, 'error'); }
  }, 180);
  state.patchTimers.set(key, pending);
}

function rangeField(label, path, value, min, max, step = 1, kind = 'layer') {
  const attribute = kind === 'project-setting' ? 'data-project-setting' : `data-${kind}-prop`;
  return `<label class="field"><span>${label}</span><div class="range-row"><input type="range" min="${min}" max="${max}" step="${step}" value="${Number(value) || 0}" ${attribute}="${path}"><input type="number" min="${min}" max="${max}" step="${step}" value="${Number(value) || 0}" ${attribute}="${path}"></div></label>`;
}

function colorField(label, path, value, kind = 'layer') {
  const color = /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000';
  const attribute = kind === 'project-setting' ? 'data-project-setting' : `data-${kind}-prop`;
  return `<label class="field"><span>${label}</span><div class="color-row"><input type="color" value="${color}" ${attribute}="${path}"><input value="${escapeHtml(value || color)}" ${attribute}="${path}"></div></label>`;
}

function renderInspector() {
  if (!state.project) return;
  $$('.inspector-tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === state.inspectorTab));
  if (state.inspectorTab === 'layers') return renderLayersInspector();
  if (state.inspectorTab === 'locales') return renderLocalesInspector();
  const screen = selectedScreen();
  const layer = selectedLayer();
  if (!screen) return $('#inspector-content').innerHTML = '<div class="inspector-empty">Create a screen to start designing.</div>';
  if (layer) renderLayerInspector(layer);
  else renderScreenInspector(screen);
  bindInspectorInputs();
}

function renderScreenInspector(screen) {
  const own = screen.layout.background || {};
  const shared = state.project.settings.sharedBackground || {};
  const background = screen.layout.backgroundMode === 'shared' ? shared : own;
  const device = screen.layout.device || {};
  $('#inspector-content').innerHTML = `
    <section class="inspector-section">
      <div class="section-title"><span>Composition presets</span><span>🪄</span></div>
      <div class="preset-grid">${Object.entries(COMPOSITION_PRESETS).map(([id, preset]) => `<button class="preset-button" data-preset="${id}"><strong>${preset.label}</strong><small>${preset.note}</small></button>`).join('')}</div>
      <button class="secondary-button" style="width:100%;margin-top:8px" data-apply-layout-all>Apply layout to every screen</button>
    </section>
    <section class="inspector-section">
      <div class="section-title"><span>Screenshot</span><span>📱</span></div>
      <label class="field"><span>Name</span><input value="${escapeHtml(screen.name)}" data-screen-name></label>
      <label class="field"><span>Source for ${escapeHtml(state.locale)}</span><button class="secondary-button" data-upload-localized>↑ Upload localized image</button></label>
    </section>
    <section class="inspector-section">
      <div class="section-title"><span>Background</span><span>🎨</span></div>
      <label class="field"><span>Scope</span><select data-screen-prop="layout.backgroundMode"><option value="shared" ${screen.layout.backgroundMode === 'shared' ? 'selected' : ''}>Shared canvas</option><option value="own" ${screen.layout.backgroundMode !== 'shared' ? 'selected' : ''}>This screen only</option></select></label>
      <label class="field"><span>Type</span><select data-${screen.layout.backgroundMode === 'shared' ? 'project-setting' : 'screen-prop'}="${screen.layout.backgroundMode === 'shared' ? 'sharedBackground.type' : 'layout.background.type'}"><option value="solid" ${background.type === 'solid' ? 'selected' : ''}>Solid</option><option value="gradient" ${background.type === 'gradient' ? 'selected' : ''}>Gradient</option><option value="image" ${background.type === 'image' ? 'selected' : ''}>Image</option></select></label>
      ${background.type === 'solid' ? colorField('Color', screen.layout.backgroundMode === 'shared' ? 'sharedBackground.color' : 'layout.background.color', background.color || '#f5f5f7', screen.layout.backgroundMode === 'shared' ? 'project-setting' : 'screen') : ''}
      ${background.type === 'gradient' ? `${colorField('Start', screen.layout.backgroundMode === 'shared' ? 'sharedBackground.colors.0' : 'layout.background.colors.0', background.colors?.[0] || '#f5f5f7', screen.layout.backgroundMode === 'shared' ? 'project-setting' : 'screen')}${colorField('End', screen.layout.backgroundMode === 'shared' ? 'sharedBackground.colors.1' : 'layout.background.colors.1', background.colors?.[1] || '#dfe8ff', screen.layout.backgroundMode === 'shared' ? 'project-setting' : 'screen')}${rangeField('Angle', screen.layout.backgroundMode === 'shared' ? 'sharedBackground.angle' : 'layout.background.angle', background.angle || 135, 0, 360, 1, screen.layout.backgroundMode === 'shared' ? 'project-setting' : 'screen')}` : ''}
      ${background.type === 'image' ? '<button class="secondary-button" data-upload-background>↑ Choose background image</button>' : ''}
    </section>
    <section class="inspector-section">
      <div class="section-title"><span>Device</span><span>⌁</span></div>
      <label class="field"><span>Frame</span><select data-screen-prop="layout.device.frame"><option value="none" ${device.frame === 'none' ? 'selected' : ''}>None / full bleed</option><option value="iphone" ${device.frame === 'iphone' ? 'selected' : ''}>iPhone</option><option value="ipad" ${device.frame === 'ipad' ? 'selected' : ''}>iPad</option><option value="android" ${device.frame === 'android' ? 'selected' : ''}>Android</option></select></label>
      <label class="field"><span>Image fit</span><select data-screen-prop="layout.device.fit"><option value="cover" ${device.fit !== 'contain' && device.fit !== 'fill' ? 'selected' : ''}>Crop / cover</option><option value="contain" ${device.fit === 'contain' ? 'selected' : ''}>Fit</option><option value="fill" ${device.fit === 'fill' ? 'selected' : ''}>Stretch</option></select></label>
      ${rangeField('Scale', 'layout.device.scale', device.scale || 72, 20, 130, 1, 'screen')}
      <div class="field-grid">${rangeField('X', 'layout.device.x', device.x || 50, -20, 120, 1, 'screen')}${rangeField('Y', 'layout.device.y', device.y || 61, -20, 120, 1, 'screen')}</div>
      ${rangeField('Tilt', 'layout.device.tilt', device.tilt || 0, -45, 45, 1, 'screen')}
      <div class="field-grid">${rangeField('Depth X', 'layout.device.rotateX', device.rotateX || 0, -35, 35, 1, 'screen')}${rangeField('Depth Y', 'layout.device.rotateY', device.rotateY || 0, -35, 35, 1, 'screen')}</div>
    </section>`;
}

function renderLayerInspector(layer) {
  const props = layer.props || {};
  const content = localizedValue(layer);
  $('#inspector-content').innerHTML = `
    <section class="inspector-section">
      <div class="section-title"><span>${escapeHtml(layer.name)}</span><span>${LAYER_ICONS[layer.type]}</span></div>
      <label class="field"><span>Name</span><input value="${escapeHtml(layer.name)}" data-layer-name></label>
      <div class="field-grid"><label class="checkbox-label"><input type="checkbox" data-layer-visible ${layer.visible ? 'checked' : ''}> Visible</label><label class="checkbox-label"><input type="checkbox" data-layer-locked ${layer.locked ? 'checked' : ''}> Locked</label></div>
    </section>
    ${layer.type === 'text' || layer.type === 'emoji' ? `<section class="inspector-section"><div class="section-title"><span>Content · ${escapeHtml(state.locale)}</span><span>🌍</span></div><label class="field"><textarea rows="${layer.type === 'text' ? 4 : 2}" data-layer-text>${escapeHtml(content.text || '')}</textarea></label></section>` : ''}
    ${layer.type === 'text' ? `<section class="inspector-section"><div class="section-title"><span>Typography</span><span>🔤</span></div>
      <label class="field"><span>Font</span><input value="${escapeHtml(props.fontFamily || '-apple-system, sans-serif')}" data-layer-prop="fontFamily"></label>
      ${rangeField('Size', 'fontSize', props.fontSize || 96, 12, 360)}${rangeField('Weight', 'fontWeight', props.fontWeight || 700, 100, 900, 10)}
      ${colorField('Color', 'color', props.color || '#111111')}
      <label class="field"><span>Align</span><select data-layer-prop="align"><option ${props.align === 'left' ? 'selected' : ''}>left</option><option ${props.align === 'center' ? 'selected' : ''}>center</option><option ${props.align === 'right' ? 'selected' : ''}>right</option></select></label>
    </section>` : ''}
    ${layer.type === 'shape' ? `<section class="inspector-section"><div class="section-title"><span>Shape</span><span>🔷</span></div>${colorField('Color', 'color', props.color || '#007aff')}${rangeField('Corner radius', 'cornerRadius', props.cornerRadius || 0, 0, 300)}</section>` : ''}
    ${layer.type === 'image' ? `<section class="inspector-section"><div class="section-title"><span>Image</span><span>🖼️</span></div><button class="secondary-button" data-replace-layer-image>↑ Replace image</button><label class="field"><span>Fit</span><select data-layer-prop="fit"><option ${props.fit === 'contain' ? 'selected' : ''}>contain</option><option ${props.fit === 'cover' ? 'selected' : ''}>cover</option><option ${props.fit === 'fill' ? 'selected' : ''}>fill</option></select></label>${rangeField('Corner radius', 'cornerRadius', props.cornerRadius || 0, 0, 300)}</section>` : ''}
    <section class="inspector-section"><div class="section-title"><span>Position & size</span><span>⌖</span></div>
      <div class="field-grid">${rangeField('X', 'x', props.x || 50, -20, 120)}${rangeField('Y', 'y', props.y || 50, -20, 120)}</div>
      ${rangeField('Width', 'width', props.width || 50, 2, 140)}${layer.type !== 'text' && layer.type !== 'emoji' ? rangeField('Height', 'height', props.height || 20, 2, 140) : ''}
      ${rangeField('Rotation', 'rotation', props.rotation || 0, -180, 180)}${rangeField('Opacity', 'opacity', props.opacity ?? 1, 0, 1, .01)}
      <div class="layer-actions"><button class="secondary-button" data-move-layer="down">Move down</button><button class="secondary-button" data-move-layer="up">Move up</button></div>
      <button class="danger-button" data-delete-layer>Delete layer</button>
    </section>`;
}

function renderLayersInspector() {
  const screen = selectedScreen();
  if (!screen) return $('#inspector-content').innerHTML = '<div class="inspector-empty">No screen selected.</div>';
  const rows = [...screen.layers].sort((a, b) => b.zIndex - a.zIndex).map((layer) => `
    <div class="layer-row ${layer.id === state.selectedLayerId ? 'selected' : ''}" data-select-layer="${layer.id}">
      <button data-toggle-layer="${layer.id}" title="Toggle visibility">${layer.visible ? '◉' : '○'}</button>
      <span class="layer-name">${LAYER_ICONS[layer.type]} &nbsp;${escapeHtml(layer.name)}</span>
      <span>${layer.locked ? '🔒' : ''}</span>
    </div>`).join('');
  $('#inspector-content').innerHTML = `<section class="inspector-section"><div class="section-title"><span>${escapeHtml(screen.name)}</span><span>${screen.layers.length}</span></div>${rows || '<div class="inspector-empty">Use the toolbar to add a layer.</div>'}</section>`;
  $$('[data-select-layer]').forEach((row) => row.addEventListener('click', (event) => {
    if (event.target.closest('[data-toggle-layer]')) return;
    state.selectedLayerId = row.dataset.selectLayer;
    state.inspectorTab = 'design';
    renderWorkspace();
    renderInspector();
  }));
  $$('[data-toggle-layer]').forEach((button) => button.addEventListener('click', async () => {
    const layer = screen.layers.find((item) => item.id === button.dataset.toggleLayer);
    layer.visible = !layer.visible;
    await api(`/api/layers/${layer.id}`, { method: 'PATCH', body: { visible: layer.visible } });
    renderAll();
  }));
}

function renderLocalesInspector() {
  const screen = selectedScreen();
  const textLayers = screen?.layers.filter((layer) => ['text', 'emoji'].includes(layer.type)) || [];
  const completed = state.project.locales.filter((locale) => textLayers.every((layer) => layer.localizations[locale.locale]?.text)).length;
  const percentage = state.project.locales.length ? Math.round(completed / state.project.locales.length * 100) : 0;
  const rows = state.project.locales.map((locale) => `
    <div class="locale-row">
      <span class="locale-code">${escapeHtml(locale.locale)}</span>
      <div><strong>${escapeHtml(locale.label)}</strong><small>${locale.isDefault ? 'Default' : `${textLayers.filter((layer) => layer.localizations[locale.locale]?.text).length}/${textLayers.length} localized layers`}</small></div>
      ${locale.isDefault ? '<span>✓</span>' : `<button data-remove-locale="${escapeHtml(locale.locale)}" title="Remove locale">×</button>`}
    </div>`).join('');
  $('#inspector-content').innerHTML = `
    <section class="inspector-section"><div class="section-title"><span>Localization coverage</span><span>${completed}/${state.project.locales.length}</span></div><div class="localized-progress"><span style="width:${percentage}%"></span></div><small class="muted-label">${percentage}% complete on this screen</small></section>
    <section class="inspector-section"><div class="section-title"><span>Project locales</span><button class="mini-button" data-open-locales>＋</button></div><div class="locale-list">${rows}</div></section>`;
  $('[data-open-locales]')?.addEventListener('click', () => $('#locale-dialog').showModal());
  $$('[data-remove-locale]').forEach((button) => button.addEventListener('click', async () => {
    if (!confirm(`Remove ${button.dataset.removeLocale} and its localized content?`)) return;
    await api(`/api/projects/${state.project.id}/locales/${encodeURIComponent(button.dataset.removeLocale)}`, { method: 'DELETE' });
    await loadProject(state.project.id);
  }));
}

function bindInspectorInputs() {
  const screen = selectedScreen();
  const layer = selectedLayer();
  $('[data-screen-name]')?.addEventListener('change', (event) => {
    screen.name = event.target.value;
    schedulePatch('screen', screen.id, { name: screen.name });
    renderScreenList();
  });
  $('[data-layer-name]')?.addEventListener('change', (event) => {
    layer.name = event.target.value;
    schedulePatch('layer', layer.id, { name: layer.name });
  });
  $('[data-layer-visible]')?.addEventListener('change', (event) => {
    layer.visible = event.target.checked;
    schedulePatch('layer', layer.id, { visible: layer.visible });
    renderWorkspace();
  });
  $('[data-layer-locked]')?.addEventListener('change', (event) => {
    layer.locked = event.target.checked;
    schedulePatch('layer', layer.id, { locked: layer.locked });
  });
  $('[data-layer-text]')?.addEventListener('input', (event) => {
    layer.localizations[state.locale] = { ...(layer.localizations[state.locale] || {}), text: event.target.value };
    schedulePatch('layer', layer.id, { localizations: { [state.locale]: layer.localizations[state.locale] } });
    renderWorkspace();
  });
  $$('[data-layer-prop]').forEach((input) => input.addEventListener('input', () => {
    setByPath(layer.props, input.dataset.layerProp, valueFromInput(input));
    schedulePatch('layer', layer.id, { props: layer.props });
    syncTwinInputs(input, 'layerProp');
    renderWorkspace();
  }));
  $$('[data-screen-prop]').forEach((input) => input.addEventListener('input', () => {
    const path = input.dataset.screenProp;
    setByPath(screen, path, valueFromInput(input));
    schedulePatch('screen', screen.id, { layout: screen.layout });
    syncTwinInputs(input, 'screenProp');
    renderWorkspace();
    if (input.tagName === 'SELECT') renderInspector();
  }));
  $$('[data-project-setting]').forEach((input) => input.addEventListener('input', () => {
    const path = input.dataset.projectSetting;
    setByPath(state.project.settings, path, valueFromInput(input));
    schedulePatch('project', state.project.id, { settings: state.project.settings });
    syncTwinInputs(input, 'projectSetting');
    renderWorkspace();
    if (input.tagName === 'SELECT') renderInspector();
  }));
  $('[data-delete-layer]')?.addEventListener('click', deleteSelectedLayer);
  $$('[data-move-layer]').forEach((button) => button.addEventListener('click', () => moveSelectedLayer(button.dataset.moveLayer)));
  $('[data-upload-localized]')?.addEventListener('click', () => beginFileUpload('localized-screen'));
  $('[data-upload-background]')?.addEventListener('click', () => beginFileUpload(screen.layout.backgroundMode === 'shared' ? 'shared-background' : 'screen-background'));
  $('[data-replace-layer-image]')?.addEventListener('click', () => beginFileUpload('replace-layer-image'));
  $$('[data-preset]').forEach((button) => button.addEventListener('click', () => applyCompositionPreset(button.dataset.preset)));
  $('[data-apply-layout-all]')?.addEventListener('click', applyLayoutToAll);
}

async function applyCompositionPreset(presetId) {
  const screen = selectedScreen();
  const preset = COMPOSITION_PRESETS[presetId];
  if (!screen || !preset) return;
  screen.layout = deepMerge(screen.layout, preset.layout);
  await api(`/api/screens/${screen.id}`, { method: 'PATCH', body: { layout: screen.layout } });
  await loadProject(state.project.id);
  toast(`${preset.label} composition applied.`);
}

async function applyLayoutToAll() {
  const screen = selectedScreen();
  if (!screen) return;
  await api(`/api/screens/${screen.id}/apply-layout`, { method: 'POST', body: {} });
  await loadProject(state.project.id);
  toast('Layout applied to every screen.');
}

function syncTwinInputs(source, dataKey) {
  const selector = `[data-${dataKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}="${CSS.escape(source.dataset[dataKey])}"]`;
  $$(selector).forEach((input) => { if (input !== source) input.value = source.value; });
}

async function addLayer(type, extra = {}) {
  const screen = selectedScreen();
  if (!screen) return toast('Create a screen first.', 'error');
  const localizations = type === 'text' ? { [state.locale]: { text: 'A headline people remember.' } }
    : type === 'emoji' ? { [state.locale]: { text: extra.emoji || '✨' } } : {};
  const { layer } = await api(`/api/screens/${screen.id}/layers`, { method: 'POST', body: { type, props: extra.props || {}, localizations } });
  await loadProject(state.project.id);
  state.selectedLayerId = layer.id;
  state.inspectorTab = 'design';
  renderAll();
}

async function deleteSelectedLayer() {
  const layer = selectedLayer();
  if (!layer || !confirm(`Delete “${layer.name}”?`)) return;
  await api(`/api/layers/${layer.id}`, { method: 'DELETE' });
  state.selectedLayerId = null;
  await loadProject(state.project.id);
}

async function moveSelectedLayer(direction) {
  const screen = selectedScreen();
  const layer = selectedLayer();
  const ordered = [...screen.layers].sort((a, b) => a.zIndex - b.zIndex);
  const index = ordered.findIndex((item) => item.id === layer.id);
  const target = direction === 'up' ? index + 1 : index - 1;
  if (target < 0 || target >= ordered.length) return;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  await api(`/api/screens/${screen.id}/layers/order`, { method: 'PUT', body: { layerIds: ordered.map((item) => item.id) } });
  await loadProject(state.project.id);
}

function beginFileUpload(kind) {
  state.pendingUploadKind = kind;
  $('#layer-file-input').click();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadAsset(file, kind) {
  const dataUrl = await fileToDataUrl(file);
  return (await api('/api/assets', { method: 'POST', body: { projectId: state.project.id, dataUrl, name: file.name, kind } })).asset;
}

async function handleLayerFile(file) {
  const kind = state.pendingUploadKind;
  state.pendingUploadKind = null;
  if (!file || !kind) return;
  try {
    const asset = await uploadAsset(file, kind);
    const screen = selectedScreen();
    if (kind === 'localized-screen') await api(`/api/screens/${screen.id}/asset`, { method: 'PUT', body: { locale: state.locale, assetId: asset.id } });
    else if (kind === 'shared-background') await api(`/api/projects/${state.project.id}`, { method: 'PATCH', body: { settings: { sharedBackground: { ...state.project.settings.sharedBackground, type: 'image', assetId: asset.id } } } });
    else if (kind === 'screen-background') await api(`/api/screens/${screen.id}`, { method: 'PATCH', body: { layout: { background: { ...screen.layout.background, type: 'image', assetId: asset.id } } } });
    else if (kind === 'replace-layer-image') await api(`/api/layers/${selectedLayer().id}`, { method: 'PATCH', body: { props: { assetId: asset.id } } });
    else if (kind === 'image-layer') {
      const result = await api(`/api/screens/${screen.id}/layers`, { method: 'POST', body: { type: 'image', name: file.name, props: { assetId: asset.id, width: 50, height: 34 } } });
      state.selectedLayerId = result.layer.id;
    }
    await loadProject(state.project.id);
    toast('Image added.');
  } catch (error) { toast(error.message, 'error'); }
}

async function uploadScreens(files) {
  if (!files.length) return;
  try {
    for (const file of files) {
      const asset = await uploadAsset(file, 'screenshot');
      const { screen } = await api(`/api/projects/${state.project.id}/screens`, { method: 'POST', body: { name: file.name.replace(/\.[^.]+$/, ''), assetId: asset.id, locale: state.locale } });
      state.selectedScreenId = screen.id;
    }
    await loadProject(state.project.id);
    toast(`${files.length} screen${files.length === 1 ? '' : 's'} imported.`);
  } catch (error) { toast(error.message, 'error'); }
}

function fitZoom() {
  if (!state.project) return;
  const workspace = $('#workspace-scroll').getBoundingClientRect();
  const count = state.mode === 'canvas' ? Math.max(1, state.project.screens.length) : 1;
  const horizontal = (workspace.width - 150 - (count - 1) * 48) / (state.project.width * count);
  const vertical = (workspace.height - 180) / state.project.height;
  state.zoom = Math.max(.06, Math.min(.55, state.mode === 'canvas' ? Math.min(vertical, horizontal) : Math.min(vertical, horizontal)));
  renderWorkspace();
}

function bindGlobalEvents() {
  $('#project-select').addEventListener('change', (event) => loadProject(event.target.value, { preserveSelection: false }));
  $('#new-project-btn').addEventListener('click', () => $('#project-dialog').showModal());
  $('#add-locale-btn').addEventListener('click', () => $('#locale-dialog').showModal());
  $('#capture-btn').addEventListener('click', () => $('#capture-dialog').showModal());
  $('#locale-select').addEventListener('change', (event) => { state.locale = event.target.value; renderAll(); });
  $$('.mode-button').forEach((button) => button.addEventListener('click', () => { state.mode = button.dataset.mode; renderAll(); requestAnimationFrame(fitZoom); }));
  $$('.inspector-tab').forEach((button) => button.addEventListener('click', () => { state.inspectorTab = button.dataset.tab; renderInspector(); }));
  $$('[data-add-layer]').forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.addLayer === 'image') beginFileUpload('image-layer');
    else addLayer(button.dataset.addLayer);
  }));
  $('#emoji-tool').addEventListener('click', () => { $('#emoji-palette').hidden = !$('#emoji-palette').hidden; });
  $('#emoji-palette').innerHTML = EMOJI_FAVORITES.map((emoji) => `<button title="Add ${emoji}">${emoji}</button>`).join('');
  $$('#emoji-palette button').forEach((button) => button.addEventListener('click', () => { addLayer('emoji', { emoji: button.textContent }); $('#emoji-palette').hidden = true; }));
  $('#add-screen-btn').addEventListener('click', async () => {
    const { screen } = await api(`/api/projects/${state.project.id}/screens`, { method: 'POST', body: { name: `Screen ${state.project.screens.length + 1}` } });
    state.selectedScreenId = screen.id;
    await loadProject(state.project.id);
  });
  $('#upload-screens-btn').addEventListener('click', () => $('#screen-file-input').click());
  $('#screen-file-input').addEventListener('change', (event) => { uploadScreens([...event.target.files]); event.target.value = ''; });
  $('#layer-file-input').addEventListener('change', (event) => { handleLayerFile(event.target.files[0]); event.target.value = ''; });
  $('#zoom-in').addEventListener('click', () => { state.zoom = Math.min(.8, state.zoom + .03); renderWorkspace(); });
  $('#zoom-out').addEventListener('click', () => { state.zoom = Math.max(.05, state.zoom - .03); renderWorkspace(); });
  $('#zoom-fit').addEventListener('click', fitZoom);
  $('#export-btn').addEventListener('click', exportProject);

  $('#project-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target));
    try {
      const { project } = await api('/api/projects', { method: 'POST', body: { name: values.name, width: Number(values.width), height: Number(values.height), defaultLocale: values.locale, seed: true } });
      $('#project-dialog').close();
      await loadProjects(project.id);
      requestAnimationFrame(fitZoom);
      toast('Project created.');
    } catch (error) { toast(error.message, 'error'); }
  });

  $('#locale-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target));
    const locales = String(values.locales).split(/\n+/).map((line) => {
      const [locale, ...label] = line.split(',');
      return { locale: locale.trim(), label: label.join(',').trim() || undefined };
    }).filter((entry) => entry.locale);
    try {
      await api(`/api/projects/${state.project.id}/locales/bulk`, { method: 'POST', body: { locales } });
      $('#locale-dialog').close();
      event.target.reset();
      await loadProject(state.project.id);
      toast(`${locales.length} language${locales.length === 1 ? '' : 's'} added.`);
    } catch (error) { toast(error.message, 'error'); }
  });
  $$('.locale-suggestions button').forEach((button) => button.addEventListener('click', () => {
    const area = $('#locale-form textarea');
    const existing = area.value.trim();
    if (!existing.split(/\n/).some((line) => line.startsWith(button.dataset.locale))) area.value = `${existing}${existing ? '\n' : ''}${button.dataset.locale}`;
  }));

  $('#capture-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target));
    const button = $('#capture-form .primary-button');
    button.disabled = true;
    button.textContent = 'Capturing…';
    try {
      const result = await api('/api/capture', { method: 'POST', body: {
        projectId: state.project.id, url: values.url, name: values.name, locale: state.locale,
        width: Number(values.width), height: Number(values.height), visible: values.visible === 'on',
      } });
      $('#capture-dialog').close();
      state.selectedScreenId = result.screen.id;
      await loadProject(state.project.id);
      toast('Chrome capture added as an editable screen.');
    } catch (error) { toast(error.message, 'error'); }
    finally { button.disabled = false; button.innerHTML = 'Open and capture'; }
  });

  window.addEventListener('keydown', async (event) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedLayer()) { event.preventDefault(); await deleteSelectedLayer(); }
    if (event.key === '1') { state.mode = 'focus'; renderAll(); fitZoom(); }
    if (event.key === '2') { state.mode = 'canvas'; renderAll(); fitZoom(); }
    const layer = selectedLayer();
    if (layer && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) && !layer.locked) {
      event.preventDefault();
      const amount = event.shiftKey ? 5 : .5;
      if (event.key === 'ArrowLeft') layer.props.x -= amount;
      if (event.key === 'ArrowRight') layer.props.x += amount;
      if (event.key === 'ArrowUp') layer.props.y -= amount;
      if (event.key === 'ArrowDown') layer.props.y += amount;
      schedulePatch('layer', layer.id, { props: { x: layer.props.x, y: layer.props.y } });
      renderWorkspace();
      renderInspector();
    }
  });
}

async function exportProject() {
  if (!state.project) return;
  const button = $('#export-btn');
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<span>◌</span> Rendering…';
  try {
    const result = await api(`/api/projects/${state.project.id}/export`, { method: 'POST', body: { locales: 'all', zip: true } });
    const link = document.createElement('a');
    link.href = result.downloadUrl;
    link.download = '';
    link.click();
    toast(`${result.count} localized screenshots exported.`);
  } catch (error) { toast(error.message, 'error'); }
  finally { button.disabled = false; button.innerHTML = original; }
}

async function init() {
  if (!state.renderMode) bindGlobalEvents();
  await loadProjects();
  if (!state.renderMode) {
    requestAnimationFrame(fitZoom);
    const events = new EventSource('/api/events');
    let refreshTimer;
    events.addEventListener('project-changed', (event) => {
      const payload = JSON.parse(event.data || '{}');
      if (payload.projectId !== state.project?.id) return;
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => loadProject(state.project.id).catch(() => {}), 220);
    });
  }
}

init().catch((error) => {
  console.error(error);
  toast(error.message, 'error');
  if (state.renderMode) window.__SHOWAPP_RENDER_READY = true;
});
