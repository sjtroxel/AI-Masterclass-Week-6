// Raw NASA / JPL API response shapes.
// These represent what comes over the wire — string numbers are intentional
// (NASA APIs serialize numeric fields as strings in several endpoints).

// ── NeoWs ────────────────────────────────────────────────────────────────────

export interface NeoWsBrowseResponse {
  links: {
    next?: string;
    self: string;
  };
  page: {
    size: number;
    total_elements: number;
    total_pages: number;
    number: number;
  };
  near_earth_objects: NeoWsObject[];
}

export interface NeoWsObject {
  id: string;
  name: string;
  name_limited?: string;
  designation?: string;
  absolute_magnitude_h: number;
  is_potentially_hazardous_asteroid: boolean;
  is_sentry_object: boolean;
  estimated_diameter?: {
    kilometers?: {
      estimated_diameter_min: number;
      estimated_diameter_max: number;
    };
  };
  close_approach_data: NeoWsCloseApproach[];
  orbital_data?: NeoWsOrbitalData;
}

export interface NeoWsCloseApproach {
  close_approach_date: string; // "YYYY-MM-DD"
  miss_distance: {
    astronomical: string;
    kilometers: string;
  };
  relative_velocity: {
    kilometers_per_second: string;
  };
  orbiting_body: string;
}

export interface NeoWsOrbitalData {
  epoch_osculation: string;       // Julian Date as string
  semi_major_axis: string;        // AU
  eccentricity: string;
  inclination: string;            // degrees
  ascending_node_longitude: string; // degrees
  perihelion_argument: string;    // degrees
  mean_anomaly: string;           // degrees
  perihelion_distance: string;    // AU
  aphelion_distance: string;      // AU
  orbital_period: string;         // days (convert to years on insert)
  minimum_orbit_intersection: string; // AU
  orbit_class: {
    orbit_class_type: string;
  };
}

// ── SBDB ─────────────────────────────────────────────────────────────────────

export interface SBDBResponse {
  object: {
    spkid: string;
    fullname: string;
    shortname?: string;
    des: string;
    neo: boolean;
    pha: boolean;
  };
  phys_par?: SBDBPhysParam[];
  orbit?: {
    moid: string; // AU
  };
}

export interface SBDBPhysParam {
  name: string;   // e.g. "diameter", "spec_B", "spec_T", "H"
  value: string;
  sigma?: string;
  units?: string;
}

// ── NHATS ────────────────────────────────────────────────────────────────────

// List-all endpoint: GET /nhats.api (no params)
export interface NHATSResponse {
  count: string;
  data: NHATSObject[];
}

// min_dv and min_dur are nested objects in both list and single responses.
// The list response entry shape matches the single-object shape below.
export interface NHATSDvSummary {
  dv: string;   // km/s as string
  dur: number;  // days
}

export interface NHATSObject {
  des: string;
  min_dv: NHATSDvSummary;
  min_dur: NHATSDvSummary;
  fullname?: string;
  h?: string;
}

// Per-asteroid endpoint: GET /nhats.api?des=<des>
// Returns the object directly — no { count, data } wrapper.
export interface NHATSSingleResponse {
  des: string;
  min_dv: NHATSDvSummary;
  min_dur: NHATSDvSummary;
  fullname?: string;
  h?: string;
  // Response also has trajectory detail, radar obs, etc. — not needed here.
  signature: { version: string; source: string };
}

// ── CAD ──────────────────────────────────────────────────────────────────────

export interface CADResponse {
  count: string;
  fields: string[];
  data: string[][];
}
