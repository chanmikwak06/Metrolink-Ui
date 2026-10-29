import { html, asset } from '../lib.js';
import { useApp } from '../store.js';
import { days, trips } from '../data.js';
import { at, InfoButton, CloseButton, RadioGroup, LineRibbon } from '../components.js';
import { TripForm } from './home.js';

// Figma: Schedules (4683:7341 empty → 7395 filled)
export function Schedules() {
  const { go, trip, update } = useApp();
  return html`
    <div class="screen">
      <img src=${asset('schedules/schedules-title.svg')} alt="Schedules" width="57.54" height="8.274" style=${at(60, 220)} />
      <${InfoButton} onClick=${() => go('explanation')} style=${at(297, 208)} />
      <${RadioGroup} options=${days} value=${trip.day} onChange=${v => update({ day: v })} positions=${[61, 185, 283]} top=${274} />
      <${TripForm} y=${338} withType=${false} cta="Get Schedule" ctaGap=${87} onSubmit=${() => go('schedule-results')} />
    </div>`;
}

// Figma: Schedules_ (4683:7449) — results list
export function ScheduleResults() {
  const { back, trip } = useApp();
  return html`
    <div class="screen">
      <${CloseButton} onClick=${back} />
      <h2 class="t-heading-l text-secondary" style=${at(39, 131)}>${trip.day || 'Mon-Fri'}</h2>
      ${trips.map((t, i) => html`
        <div key=${i} class="trip" style=${at(39, 214 + i * 123)}>
          <span class="trip__train"><${LineRibbon} line="orangeCounty" small />${t.train}</span>
          <span class="trip__time">${t.depart}</span>
          <span class="trip__station">${trip.from || 'Anaheim'}</span>
          <span class="trip__duration">
            <img src=${asset('schedules/line.svg')} alt="" width="26" height="1" />
            <span>${t.duration}</span>
            <img src=${asset('schedules/arrow-right.svg')} alt="" width="26.5" height="7.36" />
          </span>
          <span class="trip__arrive-label">Arrives</span>
          <span class="trip__time trip__time--arrive">${t.arrive}</span>
          <span class="trip__station trip__station--arrive">${trip.to || 'Buena Park'}</span>
        </div>`)}
    </div>`;
}
