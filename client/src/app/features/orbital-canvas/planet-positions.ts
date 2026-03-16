/**
 * planet-positions.ts — simplified Keplerian elements for the inner planets.
 *
 * Elements are mean values (J2000 epoch) — good enough for visualization.
 * Sources: JPL Solar System Dynamics approximate orbital elements.
 *
 * These are STATIC elements for visualization only; we do not compute
 * time-varying positions from these (the osculating elements change slowly).
 */

import { type OrbitalElements } from './orbit-math.js';

export interface PlanetDef {
  name: string;
  /** Color as hex string for Three.js MeshBasicMaterial */
  color: string;
  /** Visual radius in scene units (not to scale, just for clarity) */
  displayRadius: number;
  elements: OrbitalElements;
}

export const INNER_PLANETS: PlanetDef[] = [
  {
    name: 'Mercury',
    color: '#b5b5b5',
    displayRadius: 0.012,
    elements: {
      semiMajorAxis: 0.387,
      eccentricity: 0.206,
      inclination: 7.005,
      longitudeAscNode: 48.331,
      argPerihelion: 29.124,
    },
  },
  {
    name: 'Venus',
    color: '#e8cda0',
    displayRadius: 0.018,
    elements: {
      semiMajorAxis: 0.723,
      eccentricity: 0.007,
      inclination: 3.395,
      longitudeAscNode: 76.681,
      argPerihelion: 54.884,
    },
  },
  {
    name: 'Earth',
    color: '#4fa3e0',
    displayRadius: 0.02,
    elements: {
      semiMajorAxis: 1.0,
      eccentricity: 0.017,
      inclination: 0.0,
      longitudeAscNode: 0.0,
      argPerihelion: 102.937,
    },
  },
  {
    name: 'Mars',
    color: '#c1440e',
    displayRadius: 0.015,
    elements: {
      semiMajorAxis: 1.524,
      eccentricity: 0.093,
      inclination: 1.85,
      longitudeAscNode: 49.558,
      argPerihelion: 286.502,
    },
  },
];

/** Asteroid orbit color by orbit class */
export const ORBIT_CLASS_COLORS: Record<string, string> = {
  Apollo: '#a78bfa',  // purple
  Aten: '#f472b6',    // pink
  Amor: '#34d399',    // emerald
  Atira: '#fb923c',   // orange
  IMB: '#60a5fa',     // blue
  MBA: '#94a3b8',     // slate
  OMB: '#64748b',     // darker slate
  TJN: '#fbbf24',     // amber (Trojans)
  CEN: '#38bdf8',     // sky
  TNO: '#818cf8',     // indigo
  PAA: '#e879f9',     // fuchsia
  HYA: '#f87171',     // red
};

export function orbitClassColor(orbitClass: string): string {
  return ORBIT_CLASS_COLORS[orbitClass] ?? '#a5b4fc';
}
