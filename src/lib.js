// No-build React: htm gives JSX-like templates without a compiler.
// Migrating to Vite later = swap html`...` for JSX; components stay the same.
import React from 'react';
import htm from 'htm';

export const html = htm.bind(React.createElement);
export const { useState, useEffect, useRef, useContext, createContext, useCallback, useMemo } = React;

// Asset paths are relative to the HTML page that loads the app.
let assetBase = './assets/';
export const setAssetBase = base => { assetBase = base; };
// Resolved to an absolute URL so it also works inside CSS custom properties (url(var(--icon))).
export const asset = path => new URL(assetBase + path, document.baseURI).href;

export const cx = (...parts) => parts.filter(Boolean).join(' ');
