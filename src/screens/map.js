import { html, useState, useRef, asset, cx } from '../lib.js';
import { useApp } from '../store.js';
import { trainStatus } from '../data.js';
import { at, CloseButton, LineRibbon } from '../components.js';

// Thin road strokes drawn over the zoomed map in Figma (Map 4683:6852, Vectors 17–22).
const ROUTES = [
  ['v17', 170.71, 38.34, 39.606, 15.139, '-42.95% -16.42% -42.94% -16.41%'],
  ['v18', 55.53, 26.12, 125.326, 26.543, '-24.49% -5.19%'],
  ['v19', 2.69, 25.97, 100.714, 52.058, '-12.49% -6.45%'],
  ['v20', 4.82, 3.52, 20.541, 25.066, '-25.93% -31.64% -25.94% -31.65%'],
  ['v21', 16.19, 3.1, 159.46, 58.263, '-11.16% -4.08%'],
  ['v22', 1.55, 19.53, 43.734, 72.855, '-8.92% -14.98% -8.94% -14.86%'],
];

// Figma: Map (4683:6808) → tap train → Map (6852, zoomed) → drag → Map (6899, train status)
export function MapScreen() {
  const { go } = useApp();
  const [zoomed, setZoomed] = useState(false);
  const drag = useRef(null);
  const onDown = e => { drag.current = { x: e.clientX, y: e.clientY }; };
  const onMove = e => {
    if (!zoomed || !drag.current) return;
    if (Math.hypot(e.clientX - drag.current.x, e.clientY - drag.current.y) > 40) { drag.current = null; go('train-status'); }
  };
  return html`
    <div class=${cx('screen map', zoomed && 'is-zoomed')} onPointerDown=${onDown} onPointerMove=${onMove} onPointerUp=${() => { drag.current = null; }}>
      <img class="map__img" src=${asset('home/map.png')} alt="Metrolink system map" draggable="false" />
      <div class="map__routes" aria-hidden="true">
        ${ROUTES.map(([id, x, y, w, h, inset]) => html`
          <span key=${id} style=${at(x, y, { width: w, height: h })}><img src=${asset(`map/route-${id}.svg`)} alt="" style=${{ position: 'absolute', inset }} /></span>`)}
      </div>
      <button class="map__pin" aria-label="Train A584"
        onClick=${() => (zoomed ? go('train-status') : setZoomed(true))}>
        <img src=${asset('map/pin-zoom-b.svg')} alt="" />
        <span>A584</span>
      </button>
      <div class="map__nav-backing" />
    </div>`;
}

// Figma: Map (4683:6899) — train status
export function TrainStatus() {
  const { back } = useApp();
  const s = trainStatus;
  return html`
    <div class="screen">
      <${CloseButton} onClick=${back} />
      <header style=${at(39, 184, { width: 324, height: 41 })}>
        <${LineRibbon} line=${s.line} style=${at(0, 6)} />
        <span class="t-heading-l text-secondary" style=${at(36, 0)}>${s.train}</span>
        <span class="t-title-m text-secondary" style=${at(null, 1, { right: 0 })}>${s.region}</span>
        <span class="t-caption text-secondary" style=${at(null, 21, { right: 0 })}>${s.route}</span>
      </header>
      ${s.stops.map(([name, time], i) => html`
        <div key=${name} class="stop" style=${at(39, 282 + i * 103, { width: 324 })}>
          <span class="t-caption">Track 1</span><span class="t-caption">Estimated</span>
          <span class="t-heading-l">${name}</span><span class="t-heading-l">${time}</span>
        </div>`)}
    </div>`;
}
