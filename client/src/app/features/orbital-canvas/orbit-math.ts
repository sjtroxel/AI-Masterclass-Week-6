/**
 * orbit-math.ts — pure functions for converting Keplerian orbital elements
 * to 3D ellipse point arrays for Three.js rendering.
 *
 * All angles in degrees as inputs; converted to radians internally.
 * Returns arrays of {x, y, z} in AU (1 AU = scene unit).
 */

export interface OrbitalElements {
  /** Semi-major axis (AU) */
  semiMajorAxis: number;
  /** Eccentricity 0–1 */
  eccentricity: number;
  /** Inclination (degrees) */
  inclination: number;
  /** Longitude of ascending node (degrees) */
  longitudeAscNode: number;
  /** Argument of perihelion (degrees) */
  argPerihelion: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

const DEG = Math.PI / 180;

/**
 * Returns `count` equally-spaced points along the orbit ellipse.
 * The ecliptic plane is XZ; Y is the "up" axis to match Three.js convention.
 */
export function orbitEllipsePoints(
  elements: OrbitalElements,
  count = 128,
): Point3D[] {
  const { semiMajorAxis: a, eccentricity: e, inclination, longitudeAscNode, argPerihelion } = elements;

  // Derived semi-minor axis
  const b = a * Math.sqrt(1 - e * e);

  // Rotation angles in radians
  const i = inclination * DEG;
  const Omega = longitudeAscNode * DEG;
  const omega = argPerihelion * DEG;

  // Pre-compute trig
  const cosO = Math.cos(Omega);
  const sinO = Math.sin(Omega);
  const cosi = Math.cos(i);
  const sini = Math.sin(i);
  const cosw = Math.cos(omega);
  const sinw = Math.sin(omega);

  const points: Point3D[] = [];

  for (let k = 0; k <= count; k++) {
    // Eccentric anomaly stepping (uniform in eccentric anomaly, close enough for vis)
    const E = (2 * Math.PI * k) / count;

    // Position in orbital plane
    const xOrb = a * Math.cos(E) - a * e;   // shifted so focus at origin
    const yOrb = b * Math.sin(E);

    // Rotate from orbital plane to ecliptic (standard Euler rotation)
    // P = Rz(-Omega) * Rx(-i) * Rz(-omega) applied to (xOrb, yOrb, 0)
    const xw = cosw * xOrb - sinw * yOrb;
    const yw = sinw * xOrb + cosw * yOrb;

    const xE = cosO * xw - sinO * yw * cosi;
    const yE = sinO * xw + cosO * yw * cosi;
    const zE = yw * sini;

    // Map ecliptic XY → Three.js XZ (Y-up convention)
    points.push({ x: xE, y: zE, z: -yE });
  }

  return points;
}

/**
 * Returns the 3D position of a body at mean anomaly M (degrees).
 * Uses a fast iterative Newton-Raphson solve for eccentric anomaly.
 */
export function orbitPositionAtMeanAnomaly(
  elements: OrbitalElements,
  meanAnomalyDeg: number,
): Point3D {
  const { semiMajorAxis: a, eccentricity: e, inclination, longitudeAscNode, argPerihelion } = elements;
  const b = a * Math.sqrt(1 - e * e);

  const M = meanAnomalyDeg * DEG;

  // Solve Kepler's equation M = E - e*sin(E) via Newton-Raphson
  let E = M;
  for (let iter = 0; iter < 50; iter++) {
    const dE = (M - (E - e * Math.sin(E))) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-10) break;
  }

  const xOrb = a * Math.cos(E) - a * e;
  const yOrb = b * Math.sin(E);

  const i = inclination * DEG;
  const Omega = longitudeAscNode * DEG;
  const omega = argPerihelion * DEG;

  const cosO = Math.cos(Omega);
  const sinO = Math.sin(Omega);
  const cosi = Math.cos(i);
  const sini = Math.sin(i);
  const cosw = Math.cos(omega);
  const sinw = Math.sin(omega);

  const xw = cosw * xOrb - sinw * yOrb;
  const yw = sinw * xOrb + cosw * yOrb;

  const xE = cosO * xw - sinO * yw * cosi;
  const yE = sinO * xw + cosO * yw * cosi;
  const zE = yw * sini;

  return { x: xE, y: zE, z: -yE };
}
