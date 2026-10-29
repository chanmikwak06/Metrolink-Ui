# Mobile Intro: prototype + style guide

A working prototype of the **Wk14_R.1** page of the Figma file
[Mobile_Intro-Ui](https://www.figma.com/design/FZu2fhf5iZXyAokFbFM3ec/Mobile_Intro-Ui?node-id=4683-5964),
rebuilt in React, plus a living style guide built from the same tokens and components.

## Run it

No install needed. macOS already has Python.

```bash
python3 serve.py
```

- Prototype: http://localhost:4173/
- Style guide: http://localhost:4173/styleguide/

Every screen has its own link (e.g. `http://localhost:4173/#/payment`), so you can share a specific step.
The panel next to the phone has Back, Restart, a screen picker, and a link to each screen's Figma frame.

## What's where

| File | What it holds |
| --- | --- |
| `src/tokens.js` | **Colors, type, radius, spacing, shadow, motion.** The single source of truth. |
| `src/components.js` | Bottom nav, buttons, listbox, radio, status card, payment tiles… |
| `src/styles.css` | How components and screens look (reads tokens as CSS variables) |
| `src/screens/*.js` | One file per flow: home, tickets, schedules, map, explore |
| `src/screens/index.js` | Screen list: route id, tab, Figma node |
| `src/data.js` | Stations, fares, alerts, schedules, places |
| `src/styleguide.js` | The style guide page |
| `assets/` | Images and icons exported from Figma |

## Updating

- **Design tweak (color, font size, timing):** edit `src/tokens.js` and reload. The prototype and style guide both change.
- **Rename a proposed token:** edit its `figma` name in `tokens.js`. Remove `proposed: true` once the style exists in Figma.
- **Component change:** edit `src/components.js` and `src/styles.css`.
- **New screen:** add it in `src/screens/`, register it in `src/screens/index.js`, then add its links to `FLOWS` in `src/styleguide.js`.
- **Re-sync from Figma:** ask Claude to re-read the Figma page and update `tokens.js`. It will report what changed.

Moving to Vite later: the `html\`...\`` templates map one-to-one to JSX; the tokens, data and CSS move over unchanged.

## What differs from the Figma prototype

The prototype follows your Figma links. Where Figma had gaps, these were filled in (also listed in the style guide under *Screens & flows*):

- Dropdowns are real: pick any station or ticket type. Buy Tickets / Get Schedule enable once the form is complete.
  Figma's timed auto-fills (5.6–7 s delays) are replaced by this.
- On Home, picking Anaheim (From or To) zooms the map onto Anaheim; picking L.A. Union Station as To pans it to Los Angeles; any other station zooms back out. The A584 pin scales with the map instead of jumping to the large Figma size.
- Every fare row is tappable, and the chosen price carries through to Payment and the ticket.
- Close (X) returns to the previous screen instead of always going Home.
- Payment method tiles are selectable.
- Schedule results show the day and stations you picked.
- Explore → Get Schedule opens Home with **To = Santa Ana**.
- Tab bar inactive color is unified to `#484C52` (Figma used three different grays).
- "Accept & Contiinue" typo is fixed.
- Apple Pay sheet is the static screenshot from Figma, so it always reads $10.00.
