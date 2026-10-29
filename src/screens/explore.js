import { html, useRef, asset } from '../lib.js';
import { useApp } from '../store.js';
import { lines, places } from '../data.js';
import { at, Button, BackButton } from '../components.js';

const ORDER = ['antelopeValley', 'orangeCounty', 'sanBernardino', 'perrisValley', 'inlandEmpire', 'riverside', 'venturaCounty'];
const ROW_Y = [171, 299, 431, 561, 691, 822, 953];

// Figma: Explore (4683:6544). Only Orange County has a region page in the design.
export function Explore() {
  const { go } = useApp();
  return html`
    <div class="screen" style=${{ height: 1120 }}>
      ${ORDER.map((id, i) => {
        const open = id === 'orangeCounty' ? () => go('explore-region') : null;
        return html`
          <button key=${id} class="explore-line" disabled=${!open} onClick=${open} style=${at(116, ROW_Y[i] - 12)}>
            <img src=${asset(lines[id].explore)} alt="" width="57.498" height="26.882" />
            <span>${lines[id].name}</span>
          </button>`;
      })}
    </div>`;
}

function Carousel({ photos, name }) {
  const ref = useRef(null);
  const step = dir => ref.current.scrollBy({ left: dir * 442, behavior: 'smooth' });
  return html`
    <div class="carousel">
      <div class="carousel__track" ref=${ref}>
        ${photos.map((p, i) => html`<img key=${p} src=${asset(p)} alt=${`${name} photo ${i + 1}`} width="362" height="515" />`)}
      </div>
      <img class="carousel__arrows" src=${asset('explore/carousel-arrows.svg')} alt="" />
      <button class="carousel__btn carousel__btn--prev" onClick=${() => step(-1)} aria-label="Previous photo" />
      <button class="carousel__btn carousel__btn--next" onClick=${() => step(1)} aria-label="Next photo" />
    </div>`;
}

// Figma: Explore_1 (4683:6685) — Orange County places
export function ExploreRegion() {
  const { tab, update } = useApp();
  const tops = [99, 802];
  const getSchedule = place => { update({ to: place.station }); tab('home'); };
  return html`
    <div class="screen" style=${{ height: 1598 }}>
      <${BackButton} style=${{ top: 46 }} />
      <span class="t-body-m text-muted" style=${at(null, 58, { right: 20 })}>Orange County</span>
      ${places.map((p, i) => html`
        <section key=${p.name} class="place" style=${at(20, tops[i], { width: 362 })}>
          <${Carousel} photos=${p.photos} name=${p.name} />
          <h2 class="t-display-l text-primary place__name">${p.name}</h2>
          <p class="place__address">${p.address[0]}<br />${p.address[1]}</p>
          <${Button} onClick=${() => getSchedule(p)} style=${at(242, 583.5)}>Get Schedule<//>
        </section>`)}
    </div>`;
}
