import { html, useState, useEffect, asset, cx } from '../lib.js';
import { useApp } from '../store.js';
import { stations, ticketTypes, lineStatus, serviceAlerts } from '../data.js';
import { at, Listbox, Button, InfoButton, CloseButton, StatusCard, LineRibbon } from '../components.js';

// Shared trip form (Figma: From / To / Ticket Type listboxes + Buy Tickets).
// `y` = top of the From field in screen coordinates; spacing matches the Figma frames.
export function TripForm({ y, withType = true, cta = 'Buy Tickets', onSubmit, gap = 108, typeGap = 82, ctaGap = 82 }) {
  const { trip, update } = useApp();
  const ready = trip.from && trip.to && trip.from !== trip.to && (!withType || trip.ticketType);
  const toY = y + gap;
  const lastY = withType ? toY + typeGap : toY;
  return html`
    <${Listbox} placeholder="From" value=${trip.from} options=${stations} onChange=${v => update({ from: v })} style=${at(61, y)} />
    <img src=${asset('common/arrow-down.svg')} alt="" width="12" height="12" style=${at(78, y + 71)} />
    <${Listbox} placeholder="To" value=${trip.to} options=${stations.filter(s => s !== trip.from)} onChange=${v => update({ to: v })} style=${at(61, toY)} />
    ${withType && html`<${Listbox} placeholder="Ticket Type" value=${trip.ticketType} options=${ticketTypes} onChange=${v => update({ ticketType: v })} style=${at(61, lastY)} />`}
    <${Button} disabled=${!ready} onClick=${onSubmit} style=${at(222, lastY + ctaGap)}>${cta}<//>`;
}

// Figma: Home Page (4683:6974) → 0.1-h-z1.1 (7068, map zoomed on train A584) → 7178 (form filled).
// The map follows the form: To = L.A. Union Station zooms onto Los Angeles; Anaheim (A584's next stop)
// as From or To zooms onto the train; anything else zooms back out. Anaheim ↔ LA share one zoom level,
// so switching between them is a straight pan.
const mapViewFor = trip => (trip.to === 'L.A. Union Station' ? 'la'
  : trip.from === 'Anaheim' || trip.to === 'Anaheim' ? 'anaheim' : null);

export function Home() {
  const { go, trip, update } = useApp();
  const target = mapViewFor(trip);
  const [view, setView] = useState(target);
  useEffect(() => setView(target), [target]);
  const toggleTrain = () => {
    setView(v => (v ? null : 'anaheim'));
    if (!view && !trip.from) update({ from: 'Anaheim' }); // Figma 7068 pre-selects the train's next stop
  };
  return html`
    <div class="screen" style=${{ height: 1253 }}>
      <div class=${cx('home-map', view && 'is-zoomed', view === 'la' && 'is-la')}>
        <img class="home-map__img" src=${asset('home/map.png')} alt="Metrolink system map" />
        <button class="home-map__pin" onClick=${toggleTrain} aria-label="Train A584">
          <img src=${asset('home/pin-a584-large.svg')} alt="" />
          <span>A584</span>
        </button>
        <span class="home-map__pin home-map__pin--la" aria-hidden="true">
          <img src=${asset('home/pin-a584-la.svg')} alt="" />
          <span>A584</span>
        </span>
      </div>

      <div class="home-panel">
        <img src=${asset('home/schedules-title.svg')} alt="Schedules" width="69.053" height="9.93" style=${at(60, 10)} />
        <${InfoButton} onClick=${() => go('explanation')} style=${at(297, -2)} />
        <div class="frame-coords" style=${{ top: -395 }}>
          <${TripForm} y=${443} onSubmit=${() => go('fares')} />
          ${lineStatus.map((item, i) => html`<${StatusCard} key=${item.train} item=${item} style=${at(60, [788, 856, 920, 984][i])} />`)}
          <${Button} variant="accent" onClick=${() => go('alerts')} style=${at(222, 1066)}>Service Alerts<//>
        </div>
      </div>
    </div>`;
}

const Paragraphs = ({ blocks, className }) => html`
  <div class=${className}>
    ${blocks.map((b, i) => (Array.isArray(b) && b.list
      ? html`<ul key=${i}>${b.items.map((li, j) => html`<li key=${j}><b>${li[0]}</b>${li[1]}</li>`)}</ul>`
      : html`<p key=${i}>${b.map((seg, j) => (j % 2 ? html`<b key=${j}>${seg}</b>` : seg))}</p>`))}
  </div>`;
const list = items => Object.assign([], { list: true, items });

// Figma: Home Page_Explanation (4683:6413). Also reached from the info icons on Tickets/Schedules.
export function Explanation() {
  const { back } = useApp();
  return html`
    <div class="screen" style=${{ height: 1311 }}>
      <${CloseButton} onClick=${back} />
      <${Paragraphs} className="paragraph" blocks=${[
        ['On the ', 'Metrolink mobile app', ', there is no explicit ', 'day selection interface', ' (such as a calendar picker) when purchasing tickets. Instead, the app is structured around a ', 'ticket-first workflow', ', where users select their ', 'origin, destination, and ticket type,', ' rather than a specific travel date.'],
        ['This aligns with how Metrolink’s fare system is designed. Most mobile tickets are inherently time-bound to the day of purchase or activation, rather than a user-selected future date.'],
        ['For example:'],
        list([['One-way tickets', ' expire within a few hours after purchase'], ['Day passes', ' are valid only for the same day of purchase'], ['Monthly and multi-day passes', ' are tied to fixed validity periods rather than chosen dates']]),
        ['Because of this structure, the mobile app does not require a separate day-selection step. The ', '“date” is implicitly determined by when the ticket is purchased and activated', ', not by user input.'],
        ['In contrast, the ', 'desktop website experience', ' is more schedule-oriented. It allows users to browse train schedules across different days, supporting trip planning in advance. This reflects a different use case:'],
        list([['Desktop →', ' planning and comparing schedules across dates'], ['Mobile app →', ' quick ticket purchase for immediate or same-day travel']]),
      ]} />
    </div>`;
}

// Figma: Home Page_Service Alert (4683:6452)
export function ServiceAlerts() {
  const { back } = useApp();
  const tops = [188, 696, 1203];
  return html`
    <div class="screen" style=${{ height: 1733 }}>
      <${CloseButton} onClick=${back} />
      ${serviceAlerts.map((a, i) => html`
        <section key=${a.train} class="alert" style=${at(39, tops[i], { width: 324 })}>
          <header class="alert__head">
            <${LineRibbon} line=${a.line} />
            <span class="t-heading-l alert__train">${a.train}</span>
            <span class="t-heading-l alert__region">${a.region}</span>
          </header>
          <div class="t-caption alert__route">${a.route}</div>
          <p class="t-alert alert__body">Train <b>${a.train}</b> to LA Union Station is <b>${a.delay}</b><br />delayed due to freight train congestion.</p>
          <ul class="stop-list">
            ${a.stops.map(([name, time]) => html`<li key=${name}><span>${name}</span><span>${time}</span></li>`)}
          </ul>
        </section>`)}
    </div>`;
}
