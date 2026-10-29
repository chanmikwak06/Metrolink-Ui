// App state + navigation. Navigation is a stack per session; tabs reset it.
// The current screen is mirrored to the URL hash (#/tickets/payment) so any
// screen can be linked to directly when reviewing.
import { html, createContext, useContext, useState, useEffect, useCallback } from './lib.js';

export const TAB_ROOTS = { home: 'home', tickets: 'tickets', schedules: 'schedules', map: 'map', explore: 'explore' };

const initialTrip = { from: null, to: null, ticketType: null, day: null, fare: null, payment: null };

const Ctx = createContext(null);

const readHash = () => {
  const id = location.hash.replace(/^#\/?/, '');
  return id || 'home';
};

export function AppProvider({ screens, children }) {
  const [stack, setStack] = useState(() => [screens[readHash()] ? readHash() : 'home']);
  const [trip, setTrip] = useState(initialTrip);
  const current = stack[stack.length - 1];

  useEffect(() => {
    if (readHash() !== current) history.replaceState(null, '', `#/${current}`);
  }, [current]);

  useEffect(() => {
    const onHash = () => {
      const id = readHash();
      if (screens[id]) setStack(s => (s[s.length - 1] === id ? s : [...s, id]));
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, [screens]);

  const go = useCallback(id => setStack(s => [...s, id]), []);
  // With nothing to go back to (screen opened from a link), Back goes to the tab's first screen.
  const back = useCallback(() => setStack(s => (s.length > 1 ? s.slice(0, -1)
    : TAB_ROOTS[screens[s[0]].tab] !== s[0] ? [TAB_ROOTS[screens[s[0]].tab]] : s)), [screens]);
  const tab = useCallback(id => setStack([TAB_ROOTS[id]]), []);
  const replace = useCallback(id => setStack(s => [...s.slice(0, -1), id]), []);
  const restart = useCallback(() => { setTrip(initialTrip); setStack(['home']); }, []);
  const update = useCallback(patch => setTrip(t => ({ ...t, ...patch })), []);

  const value = { current, stack, go, back, tab, replace, restart, trip, update };
  return html`<${Ctx.Provider} value=${value}>${children}<//>`;
}

export const useApp = () => useContext(Ctx);
