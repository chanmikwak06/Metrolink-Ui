// Living style guide. Everything here is generated from tokens.js, components.js,
// data.js and the screen registry — edit those and this page updates on reload.
import { createRoot } from 'react-dom/client';
import { html, useState, asset, setAssetBase } from './lib.js';
import { applyTokens, color, type, radius, space, shadow, motion } from './tokens.js';
import { Button, ApplePayButton, Listbox, RadioGroup, BottomNav, StatusCard, ChevronRow, PaymentTile, LineRibbon, CloseButton, InfoButton, StatusBar } from './components.js';
import { stations, ticketTypes, days, lineStatus, lines } from './data.js';
import { screens } from './screens/index.js';

setAssetBase('../assets/');
applyTokens();

const FIGMA = 'https://www.figma.com/design/FZu2fhf5iZXyAokFbFM3ec/Mobile_Intro-Ui';
const LAST_SYNC = 'October 28, 2026 · page Wk14_R.1';
const node = id => `${FIGMA}?node-id=${id.replace(':', '-')}`;
const kebab = s => s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

const SECTIONS = [
  ['colors', 'Color'], ['type', 'Typography'], ['layout', 'Spacing & radius'], ['motion', 'Elevation & motion'],
  ['components', 'Components'], ['assets', 'Icons & assets'], ['flows', 'Screens & flows'], ['audit', 'Figma audit'], ['update', 'How to update'],
];

function copy(text, set) {
  navigator.clipboard?.writeText(text).then(() => { set(text); setTimeout(() => set(null), 1200); }, () => {});
}

const Badge = ({ t }) => {
  const [cls, label] = t.proposed ? ['is-proposed', 'Proposed'] : t.local ? ['is-local', 'Local style'] : ['', 'Library style'];
  return html`<span class=${`sg-badge ${cls}`}>${label}</span>`;
};

function Colors() {
  const [copied, setCopied] = useState(null);
  const groupNames = { primary: 'Primary', neutral: 'Neutral', text: 'Text', accent: 'Accent', label: 'Labels', border: 'Borders', ui: 'System UI', line: 'Route lines' };
  return html`
    <p class="sg-lede"><b>Library style</b> colors come from your shared Figma library. <b>Local style</b> colors were raw hex values on the canvas and now exist as styles in this Figma file. Click a swatch to copy its CSS variable.</p>
    ${Object.entries(color).map(([group, entries]) => html`
      <h3 key=${group} class="sg-h3">${groupNames[group] || group}</h3>
      <div class="sg-swatches">
        ${Object.entries(entries).map(([name, t]) => {
          const cssVar = `--color-${group}-${kebab(name)}`;
          return html`
            <button key=${name} class="sg-swatch" onClick=${() => copy(`var(${cssVar})`, setCopied)}>
              <span class="sg-swatch__chip" style=${{ background: t.value }} />
              <span class="sg-swatch__body">
                <span class="sg-swatch__name">${t.figma}</span>
                <code>${copied === `var(${cssVar})` ? 'Copied!' : cssVar}</code>
                <span class="sg-swatch__hex">${t.value}</span>
                <span class="sg-swatch__usage">${t.usage}</span>
                <${Badge} t=${t} />
              </span>
            </button>`;
        })}
      </div>`)}`;
}

function Typography() {
  return html`
    <p class="sg-lede">Anta for UI, Helvetica Neue for long-form copy. Letter spacing is Figma's percentage of font size. Use the class (<code>.t-body-m</code>) or the variables (<code>font: var(--type-body-m)</code>). The three Helvetica Neue styles are still <b>Proposed</b>: Figma couldn't load that font when the styles were created.</p>
    <div class="sg-type">
      ${Object.entries(type).map(([name, t]) => html`
        <div key=${name} class="sg-type__row">
          <div class="sg-type__meta">
            <span class="sg-swatch__name">${t.figma}</span>
            <code>.t-${name}</code>
            <span>${t.family} · ${t.size}/${t.line} · ${t.tracking}%</span>
            <span class="sg-swatch__usage">${t.usage}</span>
            <${Badge} t=${t} />
          </div>
          <div class=${`sg-type__sample t-${name}`}>${t.sample}</div>
        </div>`)}
    </div>`;
}

const TokenTable = ({ rows, unit = 'px', render }) => html`
  <table class="sg-table"><tbody>
    ${rows.map(([name, t, prefix]) => html`
      <tr key=${name}>
        <td><code>--${prefix}-${name}</code></td>
        <td>${t.value}${typeof t.value === 'number' ? unit : ''}${t.easing ? html`<br /><small>${t.easing}</small>` : ''}</td>
        <td>${render ? render(name, t) : null}</td>
        <td class="sg-swatch__usage">${t.usage}</td>
      </tr>`)}
  </tbody></table>`;

function Layout() {
  return html`
    <p class="sg-lede">Frames are 402 × 874 (iPhone 16 Pro Max). Content screens use a 39px gutter, forms 61px.</p>
    <h3 class="sg-h3">Radius</h3>
    <${TokenTable} rows=${Object.entries(radius).map(([n, t]) => [n, t, 'radius'])}
      render=${n => html`<span class="sg-radius" style=${{ borderRadius: n === 'ticket' ? 'var(--radius-ticket) 0' : `var(--radius-${n})` }} />`} />
    <h3 class="sg-h3">Spacing</h3>
    <${TokenTable} rows=${Object.entries(space).map(([n, t]) => [n, t, 'space'])}
      render=${(n, t) => html`<span class="sg-space" style=${{ width: Math.min(t.value, 120) }} />`} />`;
}

function Motion() {
  const [run, setRun] = useState(0);
  return html`
    <h3 class="sg-h3">Shadow</h3>
    <${TokenTable} rows=${Object.entries(shadow).map(([n, t]) => [n, t, 'shadow'])}
      render=${n => html`<span class="sg-shadow" style=${{ filter: `drop-shadow(var(--shadow-${n}))` }} />`} />
    <h3 class="sg-h3">Motion <button class="sg-link" onClick=${() => setRun(r => r + 1)}>Replay</button></h3>
    <p class="sg-lede">Durations and easings come from your Figma prototype settings.</p>
    <${TokenTable} rows=${Object.entries(motion).map(([n, t]) => [n, t, 'motion'])}
      render=${n => html`<span class="sg-motion"><span key=${run} style=${{ animation: `sg-slide var(--motion-${n}) var(--ease-${n}) both` }} /></span>`} />`;
}

const Demo = ({ title, figma, note, children, code }) => html`
  <div class="sg-demo">
    <div class="sg-demo__head">
      <span class="sg-swatch__name">${title}</span>
      ${figma && html`<span class="sg-demo__figma">Figma: ${figma}</span>`}
    </div>
    <div class="sg-demo__stage">${children}</div>
    ${note && html`<p class="sg-swatch__usage">${note}</p>`}
    ${code && html`<code class="sg-demo__code">${code}</code>`}
  </div>`;

function Components() {
  const [from, setFrom] = useState(null);
  const [day, setDay] = useState('Sat');
  const [tab, setTab] = useState('home');
  const [pay, setPay] = useState('visa');
  const rel = { position: 'relative' };
  return html`
    <p class="sg-lede">These are the live components the prototype uses, so they're always in sync with the code. Try them: dropdowns open, radios switch, tabs move.</p>
    <div class="sg-demos">
      <${Demo} title="Button" figma="Button (library)" code="<Button variant='primary|accent|pressed' disabled size='sm|lg'>">
        <div class="sg-row">
          <${Button} style=${rel}>Buy Tickets<//>
          <${Button} disabled style=${rel}>Buy Tickets<//>
          <${Button} variant="accent" style=${rel}>Service Alerts<//>
          <${Button} variant="pressed" style=${rel}>Get Schedule<//>
        </div>
        <div class="sg-row">
          <${Button} size="lg" style=${{ ...rel, width: 323 }}>Accept & Continue<//>
          <${Button} variant="pressed" size="lg" style=${{ ...rel, width: 323 }}>Go to Ticket Wallet<//>
        </div>
      <//>
      <${Demo} title="Apple Pay Button" figma="Apple Pay Button (library, Apple HIG)" code="<ApplePayButton onClick>">
        <${ApplePayButton} style=${rel} />
      <//>
      <${Demo} title="Listbox" figma="Listbox Component (local set, 10 variants) + Dropdown List + Hover State"
        note="Default → open (click) → option hover turns Primary/Main → selected value replaces the placeholder."
        code="<Listbox placeholder='From' value options onChange>">
        <div class="sg-row sg-row--top" style=${{ minHeight: 240 }}>
          <${Listbox} placeholder="From" value=${from} options=${stations} onChange=${setFrom} style=${rel} />
          <${Listbox} placeholder="Ticket Type" value="One-Way" options=${ticketTypes} onChange=${() => {}} style=${rel} />
        </div>
      <//>
      <${Demo} title="Radio Button" figma="Radio Button (library) · State=Default / Active" code="<RadioGroup options value onChange positions top>">
        <div style=${{ position: 'relative', width: 290, height: 24 }}>
          <${RadioGroup} options=${days} value=${day} onChange=${setDay} positions=${[0, 124, 222]} top=${0} />
        </div>
      <//>
      <${Demo} title="Status Bar" figma="StatusBar (library) · Dark Mode=False, Dynamic Island=False + Notch" note="iPhone 13 notch, centered. Transparent: no fill, so the screen shows through. Pinned to the top of every screen; it never scrolls." code="<StatusBar />">
        <div class="sg-phone-strip sg-phone-strip--status"><${StatusBar} /></div>
      <//>
      <${Demo} title="Bottom Nav" figma="Menu Bar / Home_Menu bar → Bottom Nav" note="Active tab: Primary/Main icon + label, 56×2 indicator." code="<BottomNav active='home' />">
        <div class="sg-phone-strip"><${BottomNav} active=${tab} onSelect=${setTab} /></div>
      <//>
      <${Demo} title="Status card" figma="Selector (library), used for line status" code="<StatusCard item />">
        <div class="sg-col">${lineStatus.map(s => html`<${StatusCard} key=${s.train} item=${s} style=${rel} />`)}</div>
      <//>
      <${Demo} title="Chevron row" figma="Group (text + Chevron)" code="<ChevronRow right='$10.00' chevronX>">
        <div class="sg-col" style=${{ width: 323 }}>
          <${ChevronRow} style=${{ ...rel, width: 323 }} chevronX=${318}>Ticket Wallet<//>
          <${ChevronRow} style=${{ ...rel, width: 323 }} chevronX=${318} right="$10.00">Adult (Regular)<//>
        </div>
      <//>
      <${Demo} title="Payment method" figma="Payment Method/Visa · Mastercard · PayPal · ApplePay (library)" note="Selected state is new in code (not in Figma)." code="<PaymentTile method selected onClick>">
        <div class="sg-row">${['visa', 'mastercard', 'paypal', 'applepay'].map(m => html`
          <${PaymentTile} key=${m} method=${m} selected=${pay === m} onClick=${() => setPay(m)} style=${{ ...rel, width: 73 }} />`)}</div>
      <//>
      <${Demo} title="Route ribbons" figma="Vector (per line)" code="<LineRibbon line='orangeCounty' small? />">
        <div class="sg-row">
          ${Object.entries(lines).map(([id, l]) => html`<figure key=${id} class="sg-figure"><img src=${asset(l.explore)} alt="" width="57.5" height="26.9" /><figcaption>${l.name}</figcaption></figure>`)}
        </div>
        <div class="sg-row">
          ${['orangeCounty', 'antelopeValley', 'riverside', 'perrisValley'].map(id => html`<${LineRibbon} key=${id} line=${id} />`)}
          <${LineRibbon} line="orangeCounty" small />
        </div>
      <//>
      <${Demo} title="Close · Info" figma="Frame 1 (X) · Vector (Stroke)">
        <div class="sg-row">
          <div style=${{ position: 'relative', width: 46, height: 44 }}><div style=${{ position: 'absolute', left: -333, top: -75 }}><${CloseButton} onClick=${() => {}} /></div></div>
          <div style=${{ position: 'relative', width: 35, height: 35 }}><${InfoButton} onClick=${() => {}} style=${{ left: 0, top: 0 }} /></div>
        </div>
      <//>
    </div>`;
}

const ASSETS = {
  Navigation: ['nav/home.svg', 'nav/tickets.svg', 'nav/schedules.svg', 'nav/map.svg', 'nav/explore.svg', 'nav/indicator.svg'],
  Common: ['common/status-bar.svg', 'common/chevron-down.svg', 'common/chevron-down-alt.svg', 'common/arrow-down.svg', 'common/close.svg', 'common/info.svg', 'common/radio-off.svg', 'common/radio-on.svg', 'common/line-orange.svg', 'common/line-green.svg', 'common/line-purple.svg', 'common/line-blue.svg'],
  'Home & Map': ['home/schedules-title.svg', 'home/pin-a584.svg', 'home/pin-a584-large.svg', 'map/pin.svg', 'map/pin-zoom-b.svg', 'home/map.png'],
  Tickets: ['tickets/visa.svg', 'tickets/mastercard.svg', 'tickets/paypal.svg', 'tickets/applepay-mark.svg', 'tickets/ticket.png', 'tickets/applepay-sheet.png'],
  'Schedules & Explore': ['schedules/schedules-title.svg', 'schedules/line-orange-sm.svg', 'schedules/arrow-right.svg', 'explore/carousel-arrows.svg', 'explore/den-1.png', 'explore/muse-1.png'],
};

const Assets = () => html`
  <p class="sg-lede">Exported from Figma into <code>assets/</code>. Tab icons are drawn as CSS masks so they recolor with tokens.</p>
  ${Object.entries(ASSETS).map(([group, files]) => html`
    <h3 key=${group} class="sg-h3">${group}</h3>
    <div class="sg-assets">${files.map(f => html`
      <figure key=${f} class="sg-asset"><span><img src=${asset(f)} alt="" /></span><figcaption>${f}</figcaption></figure>`)}</div>`)}`;

// What each screen links to: Figma links you made, plus gaps filled in code (marked "added").
const FLOWS = [
  ['home', 'Train pin → map zooms to A584 and From = Anaheim (Smart Animate)', 'Pick Anaheim as From or To → map zooms to Anaheim; another station zooms back out', 'Pick L.A. Union Station as To → map pans/zooms to Los Angeles (same zoom as Anaheim, so it is a smooth pan)', 'Info → Why no date picker', 'Buy Tickets (From, To, Type set) → Choose fare', 'Service Alerts → Service Alerts'],
  ['explanation', 'X → back to the previous screen (added: Figma always went Home)'],
  ['alerts', 'X → back'],
  ['tickets', 'Ticket Wallet → Ticket Wallet', 'Mon-Fri / Sat / Sun radios', 'Buy Tickets → Choose fare'],
  ['fares', 'Any fare → Ticket Validity (added: Figma linked Adult only; price carries through)', 'Info → Why no date picker'],
  ['validity', 'Accept & Continue → Payment'],
  ['payment', 'Payment tiles selectable (added)', 'Buy with Apple Pay → Apple Pay'],
  ['applepay', 'Tap anywhere → Transaction Successful'],
  ['success', 'Go to Ticket Wallet → Ticket Wallet'],
  ['wallet', 'Ticket → full-screen ticket'],
  ['ticket', 'Tap → back to wallet'],
  ['schedules', 'Radios + From/To → Get Schedule → results', 'Info → Why no date picker'],
  ['schedule-results', 'Day + stations reflect your selections (added)', 'X → back'],
  ['map', 'Train pin → zoom (Smart Animate 600ms)', 'Zoomed: drag or tap the pin → Train A584'],
  ['train-status', 'X → back to map'],
  ['explore', 'Orange County → region page (other lines have no page in Figma)'],
  ['explore-region', 'Photo arrows scroll the carousel', 'Get Schedule → Home with To = Santa Ana (Figma went to a pre-filled Home)'],
];

const Flows = () => html`
  <p class="sg-lede">Every screen in the prototype, its source frame, and what it links to. Bottom-nav tabs work on every screen.</p>
  <table class="sg-table sg-flows"><thead><tr><th>Screen</th><th>Figma frame</th><th>Interactions</th></tr></thead><tbody>
    ${FLOWS.map(([id, ...links]) => html`
      <tr key=${id}>
        <td><a href=${`../#/${id}`} target="_blank" rel="noreferrer">${screens[id].title}</a><br /><code>#/${id}</code></td>
        <td><a href=${node(screens[id].figma)} target="_blank" rel="noreferrer">${screens[id].figma}</a></td>
        <td><ul>${links.map(l => html`<li key=${l}>${l}</li>`)}</ul></td>
      </tr>`)}
  </tbody></table>`;

const AUDIT = [
  ['Colors and text styles', 'Only some colors used library styles. 17 color styles and 7 Anta text styles were added to this file as local styles (Oct 28, 2026), but existing layers still use raw values until you apply the styles to them. The 3 Helvetica Neue paragraph styles still need creating in Figma desktop, where the font is available.'],
  ['Bottom nav is inconsistent', 'Inactive labels are rgba(72,76,82,0.7) on Home, #484C52 on most screens, and black for Schedules/Tickets on others. The code uses one value: Text/Nav Inactive #484C52.'],
  ['Duplicate Listbox sets', 'Listbox Component exists 3× on the page (4683:7544, 7643, 7743), each with 10 variants named Variant2–Variant10. Suggest one set with named props: State=Default/Open, Filled=true/false.'],
  ['"Body/Bold/S" is not bold', 'The style uses Anta Regular (Anta has one weight). Consider renaming it to Body/Regular/S.'],
  ['Typo', 'Ticket Validity button reads "Accept & Contiinue"; the code says "Accept & Continue".'],
  ['Schedule times', 'Results show "12:20 AM" and "1:36 AM" after 11:36 AM; probably meant PM. Kept as drawn in data.js.'],
  ['Static Apple Pay sheet', 'The sheet is a screenshot, so it always shows $10.00 even for a $5 fare. The ticket price patch in the wallet does update.'],
  ['Unused frames', '"Home Page_OC Line" (4683:7281) is hidden and "Explore_1" (4683:6630) has no links into it. Neither is in the prototype.'],
  ['Logos removed', 'The Metrolink logo is gone from all 24 screens and the Apple Pay merchant tile (Oct 28, 2026). The METROLINK wordmark on the ticket art (Figma 4899:2261) is kept on purpose. Payment marks (Visa, Mastercard, PayPal, Apple Pay) are kept.'],
  ['Timed auto-advance', 'Figma auto-filled forms after 5.6–7s delays (Tickets, Schedules, Home zoom). The code uses real dropdowns instead.'],
];

const Audit = () => html`
  <p class="sg-lede">Found while reading the file. Nothing was changed in Figma.</p>
  <dl class="sg-audit">${AUDIT.map(([k, v]) => html`<div key=${k}><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>`;

const Update = () => html`
  <ol class="sg-steps">
    <li><b>Change a color, type style, radius or timing:</b> edit <code>src/tokens.js</code> and reload. The prototype and this page both read it.</li>
    <li><b>Rename a proposed token:</b> change its <code>figma</code> name in <code>tokens.js</code>. Delete <code>proposed: true</code> once the style exists in Figma.</li>
    <li><b>Change a component:</b> edit <code>src/components.js</code> (markup) and <code>src/styles.css</code> (look). The demos above update with it.</li>
    <li><b>Change copy or data</b> (stations, fares, alerts, schedules): <code>src/data.js</code>.</li>
    <li><b>Add a screen:</b> add a component in <code>src/screens/</code> and register it in <code>src/screens/index.js</code>, then add a row to <code>FLOWS</code> in <code>src/styleguide.js</code>.</li>
    <li><b>Re-sync from Figma:</b> ask Claude to "re-read the Figma page and update tokens.js". It compares the file's styles against this list and reports what changed.</li>
  </ol>`;

const RENDER = { colors: Colors, type: Typography, layout: Layout, motion: Motion, components: Components, assets: Assets, flows: Flows, audit: Audit, update: Update };

function StyleGuide() {
  return html`
    <div class="sg-shell">
      <aside class="sg-nav">
        <div class="sg-nav__brand"><span>Mobile Intro<br /><small>Style guide</small></span></div>
        <nav>${SECTIONS.map(([id, label]) => html`<a key=${id} href=${`#${id}`}>${label}</a>`)}</nav>
        <div class="sg-nav__foot">
          <a href="../">Open prototype →</a>
          <a href=${FIGMA} target="_blank" rel="noreferrer">Figma file ↗</a>
          <span>Last synced ${LAST_SYNC}</span>
        </div>
      </aside>
      <main class="sg-main">
        <header class="sg-header">
          <h1>Mobile Intro style guide</h1>
          <p>Generated from <code>src/tokens.js</code> and the live components. Edit those and reload; this page and the prototype stay in sync.</p>
        </header>
        ${SECTIONS.map(([id, label]) => {
          const Body = RENDER[id];
          return html`<section key=${id} id=${id} class="sg-section"><h2 class="sg-h2">${label}</h2><${Body} /></section>`;
        })}
      </main>
    </div>`;
}

createRoot(document.getElementById('root')).render(html`<${StyleGuide} />`);
