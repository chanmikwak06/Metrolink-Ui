import { createRoot } from 'react-dom/client';
import { html, useEffect, useRef, useState } from './lib.js';
import { applyTokens } from './tokens.js';
import { AppProvider, useApp } from './store.js';
import { BottomNav, StatusBar } from './components.js';
import { screens } from './screens/index.js';

const FIGMA_FILE = 'https://www.figma.com/design/FZu2fhf5iZXyAokFbFM3ec/Mobile_Intro-Ui';
// ?embed shows only the phone, scaled to fit its frame (for embedding in the portfolio site).
const EMBED = new URLSearchParams(location.search).has('embed');

applyTokens();
document.body.classList.toggle('is-embed', EMBED);

function Phone() {
  const { current } = useApp();
  const screen = screens[current];
  const scroller = useRef(null);
  useEffect(() => { scroller.current?.scrollTo(0, 0); }, [current]);
  const Screen = screen.component;
  return html`
    <div class="device">
      <div class="device__scroll" ref=${scroller}>
        <div class="screen-enter" key=${current}><${Screen} /></div>
      </div>
      <${StatusBar} />
      <${BottomNav} active=${screen.tab} />
    </div>`;
}

// Presentation chrome around the phone — not part of the app design.
function Viewer() {
  const { current, stack, go, back, restart } = useApp();
  const [scale, setScale] = useState(1);
  useEffect(() => {
    // Embedded: fit the phone plus its 10px bezel inside the frame on both axes
    const fit = () => setScale(EMBED
      ? Math.min(1, (innerWidth - 24) / 422, (innerHeight - 24) / 894)
      : Math.min(1, (innerHeight - 40) / 874));
    fit();
    addEventListener('resize', fit);
    return () => removeEventListener('resize', fit);
  }, []);
  const meta = screens[current];
  if (EMBED) return html`<div class="embed"><div class="viewer__stage" style=${{ '--scale': scale }}><${Phone} /></div></div>`;
  return html`
    <div class="viewer">
      <aside class="viewer__panel">
        <h1>Mobile Intro <span>Wk14_R.1</span></h1>
        <div class="viewer__actions">
          <button onClick=${back} disabled=${stack.length < 2}>← Back</button>
          <button onClick=${restart}>Restart</button>
        </div>
        <label>Jump to screen
          <select value=${current} onChange=${e => go(e.target.value)}>
            ${Object.entries(screens).map(([id, s]) => html`<option key=${id} value=${id}>${s.title}</option>`)}
          </select>
        </label>
        <p class="viewer__meta">
          <a href=${`${FIGMA_FILE}?node-id=${meta.figma.replace(':', '-')}`} target="_blank" rel="noreferrer">Open frame in Figma ↗</a>
        </p>
        <p class="viewer__meta"><a href="styleguide/">Style guide →</a></p>
      </aside>
      <div class="viewer__stage" style=${{ '--scale': scale }}><${Phone} /></div>
    </div>`;
}

createRoot(document.getElementById('root')).render(html`<${AppProvider} screens=${screens}><${Viewer} /><//>`);
