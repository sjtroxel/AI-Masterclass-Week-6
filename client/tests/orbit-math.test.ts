import { describe, it, expect } from 'vitest';
import {
  orbitEllipsePoints,
  orbitPositionAtMeanAnomaly,
  type OrbitalElements,
} from '../src/app/features/orbital-canvas/orbit-math.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function dist3D(p: { x: number; y: number; z: number }): number {
  return Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
}

// ── orbitEllipsePoints ─────────────────────────────────────────────────────────

describe('orbitEllipsePoints', () => {
  it('returns count+1 points', () => {
    const elements: OrbitalElements = {
      semiMajorAxis: 1.0,
      eccentricity: 0.0,
      inclination: 0,
      longitudeAscNode: 0,
      argPerihelion: 0,
    };
    const pts = orbitEllipsePoints(elements, 64);
    expect(pts).toHaveLength(65); // 0..64 inclusive
  });

  it('circular orbit: all points at exactly semi-major axis distance from focus', () => {
    // e=0 → circle, all points at distance a from center
    // But for circular orbit with e=0, focus is at center so all points are at a from focus
    const a = 2.0;
    const elements: OrbitalElements = {
      semiMajorAxis: a,
      eccentricity: 0.0,
      inclination: 0,
      longitudeAscNode: 0,
      argPerihelion: 0,
    };
    const pts = orbitEllipsePoints(elements, 128);
    for (const p of pts) {
      expect(dist3D(p)).toBeCloseTo(a, 6);
    }
  });

  it('zero inclination: all Y coordinates are zero (ecliptic plane)', () => {
    const elements: OrbitalElements = {
      semiMajorAxis: 1.0,
      eccentricity: 0.2,
      inclination: 0,
      longitudeAscNode: 0,
      argPerihelion: 0,
    };
    const pts = orbitEllipsePoints(elements, 64);
    for (const p of pts) {
      expect(Math.abs(p.y)).toBeLessThan(1e-10);
    }
  });

  it('non-zero inclination: Y coordinates are not all zero', () => {
    const elements: OrbitalElements = {
      semiMajorAxis: 1.0,
      eccentricity: 0.1,
      inclination: 30, // 30 degrees
      longitudeAscNode: 0,
      argPerihelion: 0,
    };
    const pts = orbitEllipsePoints(elements, 64);
    const maxY = Math.max(...pts.map((p) => Math.abs(p.y)));
    expect(maxY).toBeGreaterThan(0.1);
  });

  it('elliptical orbit: points span the correct X range (aphelion to perihelion)', () => {
    const a = 1.5;
    const e = 0.5;
    const elements: OrbitalElements = {
      semiMajorAxis: a,
      eccentricity: e,
      inclination: 0,
      longitudeAscNode: 0,
      argPerihelion: 0,
    };
    const pts = orbitEllipsePoints(elements, 256);
    // Perihelion distance = a(1-e) = 0.75; aphelion = a(1+e) = 2.25
    // With focus at origin (shifted), min distance ≈ a(1-e) = 0.75
    const dists = pts.map(dist3D);
    const minDist = Math.min(...dists);
    const maxDist = Math.max(...dists);
    expect(minDist).toBeCloseTo(a * (1 - e), 4); // perihelion
    expect(maxDist).toBeCloseTo(a * (1 + e), 4); // aphelion
  });

  it('Earth-like orbit produces points near 1 AU', () => {
    const elements: OrbitalElements = {
      semiMajorAxis: 1.0,
      eccentricity: 0.017,
      inclination: 0.0,
      longitudeAscNode: 0.0,
      argPerihelion: 102.937,
    };
    const pts = orbitEllipsePoints(elements, 128);
    const dists = pts.map(dist3D);
    const minDist = Math.min(...dists);
    const maxDist = Math.max(...dists);
    // Earth varies ~0.983–1.017 AU from the Sun
    expect(minDist).toBeGreaterThan(0.97);
    expect(maxDist).toBeLessThan(1.03);
  });

  it('default count=128 produces 129 points', () => {
    const elements: OrbitalElements = {
      semiMajorAxis: 1.0,
      eccentricity: 0.1,
      inclination: 5,
      longitudeAscNode: 20,
      argPerihelion: 45,
    };
    expect(orbitEllipsePoints(elements)).toHaveLength(129);
  });
});

// ── orbitPositionAtMeanAnomaly ─────────────────────────────────────────────────

describe('orbitPositionAtMeanAnomaly', () => {
  it('M=0: position is at perihelion distance a(1-e) from Sun', () => {
    const a = 2.0;
    const e = 0.4;
    const elements: OrbitalElements = {
      semiMajorAxis: a,
      eccentricity: e,
      inclination: 0,
      longitudeAscNode: 0,
      argPerihelion: 0,
    };
    const pos = orbitPositionAtMeanAnomaly(elements, 0);
    expect(dist3D(pos)).toBeCloseTo(a * (1 - e), 5); // perihelion
  });

  it('M=180: position is at aphelion distance a(1+e) from Sun', () => {
    const a = 2.0;
    const e = 0.4;
    const elements: OrbitalElements = {
      semiMajorAxis: a,
      eccentricity: e,
      inclination: 0,
      longitudeAscNode: 0,
      argPerihelion: 0,
    };
    const pos = orbitPositionAtMeanAnomaly(elements, 180);
    expect(dist3D(pos)).toBeCloseTo(a * (1 + e), 5); // aphelion
  });

  it('circular orbit: all mean anomaly positions at distance a', () => {
    const a = 1.5;
    const elements: OrbitalElements = {
      semiMajorAxis: a,
      eccentricity: 0,
      inclination: 0,
      longitudeAscNode: 0,
      argPerihelion: 0,
    };
    for (const M of [0, 45, 90, 135, 180, 270, 359]) {
      const pos = orbitPositionAtMeanAnomaly(elements, M);
      expect(dist3D(pos)).toBeCloseTo(a, 5);
    }
  });

  it('zero inclination: Y is always zero', () => {
    const elements: OrbitalElements = {
      semiMajorAxis: 1.0,
      eccentricity: 0.3,
      inclination: 0,
      longitudeAscNode: 0,
      argPerihelion: 0,
    };
    for (const M of [0, 60, 120, 180, 240, 300]) {
      const pos = orbitPositionAtMeanAnomaly(elements, M);
      expect(Math.abs(pos.y)).toBeLessThan(1e-9);
    }
  });

  it('inclined orbit: Y coordinate is non-zero at mid-anomaly', () => {
    const elements: OrbitalElements = {
      semiMajorAxis: 1.0,
      eccentricity: 0.1,
      inclination: 45,
      longitudeAscNode: 0,
      argPerihelion: 0,
    };
    const pos = orbitPositionAtMeanAnomaly(elements, 90);
    // At 45° inclination with M=90, should have meaningful Y lift
    expect(Math.abs(pos.y)).toBeGreaterThan(0.05);
  });

  it('M=0 position matches first point of orbitEllipsePoints', () => {
    const elements: OrbitalElements = {
      semiMajorAxis: 1.2,
      eccentricity: 0.25,
      inclination: 10,
      longitudeAscNode: 30,
      argPerihelion: 60,
    };
    const pos = orbitPositionAtMeanAnomaly(elements, 0);
    const pts = orbitEllipsePoints(elements, 128);
    const p0 = pts[0]!;
    // Both start at E=0 (perihelion), should match closely
    expect(pos.x).toBeCloseTo(p0.x, 4);
    expect(pos.y).toBeCloseTo(p0.y, 4);
    expect(pos.z).toBeCloseTo(p0.z, 4);
  });
});

// ── planet-positions integration ──────────────────────────────────────────────

describe('inner planet orbital elements sanity', () => {
  it('all inner planets produce orbits in the correct distance range', async () => {
    const { INNER_PLANETS } = await import(
      '../src/app/features/orbital-canvas/planet-positions.js'
    );

    const expectedRanges: Record<string, [number, number]> = {
      Mercury: [0.30, 0.47],
      Venus: [0.71, 0.73],
      Earth: [0.98, 1.02],
      Mars: [1.38, 1.67],
    };

    for (const planet of INNER_PLANETS) {
      const pts = orbitEllipsePoints(planet.elements, 128);
      const dists = pts.map(dist3D);
      const [lo, hi] = expectedRanges[planet.name] ?? [0, 100];
      expect(Math.min(...dists)).toBeGreaterThan(lo);
      expect(Math.max(...dists)).toBeLessThan(hi);
    }
  });
});
