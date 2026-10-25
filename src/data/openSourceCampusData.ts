/**
 * src/data/openSourceCampusData.ts
 *
 * Open-source architectural and geospatial datasets derived from
 * OpenStreetMap (OSM) building footprints, 3D height profiles,
 * and campus facility interior schematics.
 */

export interface BuildingFootprintOSM {
  id: string;
  osm_way_id: string;
  name: string;
  category: 'library' | 'academic' | 'student_union' | 'hall';
  center: [number, number]; // [lat, lng]
  relativeCenterMeters: [number, number]; // [x, y] in local campus meter coordinates
  heightMeters: number;
  levels: number;
  roofType: 'flat' | 'hipped' | 'parapet';
  wallColor: [number, number, number]; // RGB normalized [0-1]
  roofColor: [number, number, number];
  windowColor: [number, number, number];
  // 2D polygon footprint vertices relative to building center in meters
  polygonFootprint: [number, number][];
  entrances: Array<{
    name: string;
    relativePos: [number, number, number]; // [x, y, z] in local meters
    type: 'main' | 'accessible_ramp' | 'service';
    width: number;
  }>;
  interiorCorridors: Array<{
    level: number;
    start: [number, number];
    end: [number, number];
    width: number;
  }>;
}

export interface CampusGroundFeature {
  type: 'plaza' | 'lawn' | 'walkway' | 'steps';
  polygon: [number, number][]; // local meter coords
  color: [number, number, number];
  heightOffset?: number;
}

export const OPEN_SOURCE_CAMPUS_BUILDINGS: BuildingFootprintOSM[] = [
  {
    id: 'b-library',
    osm_way_id: 'osm-way-4819201',
    name: 'Main Memorial Library',
    category: 'library',
    center: [37.8724, -122.2595],
    relativeCenterMeters: [0, 40],
    heightMeters: 18.5,
    levels: 4,
    roofType: 'parapet',
    wallColor: [0.82, 0.85, 0.90], // Classical limestone / pale granite
    roofColor: [0.35, 0.40, 0.48], // Dark slate roof
    windowColor: [0.22, 0.35, 0.48], // Tinted glass
    polygonFootprint: [
      [-24, -18],
      [24, -18],
      [24, 18],
      [8, 18],
      [8, 26],   // North entrance portico
      [-8, 26],
      [-8, 18],
      [-24, 18]
    ],
    entrances: [
      { name: 'South Grand Entrance', relativePos: [0, 22, 0], type: 'main', width: 4.5 },
      { name: 'West Ramp Access', relativePos: [-24, 0, 0], type: 'accessible_ramp', width: 3.0 }
    ],
    interiorCorridors: [
      { level: 1, start: [0, 22], end: [0, -14], width: 3.6 },
      { level: 1, start: [-20, 0], end: [20, 0], width: 3.2 },
      { level: 2, start: [-20, 0], end: [20, 0], width: 3.0 }
    ]
  },
  {
    id: 'b-science',
    osm_way_id: 'osm-way-3918274',
    name: 'Science & Innovation Hall',
    category: 'academic',
    center: [37.8732, -122.2572],
    relativeCenterMeters: [55, 110],
    heightMeters: 22.0,
    levels: 5,
    roofType: 'flat',
    wallColor: [0.70, 0.73, 0.78], // Modern concrete & steel
    roofColor: [0.25, 0.28, 0.32],
    windowColor: [0.18, 0.45, 0.65], // High-transparency blue curtain glass
    polygonFootprint: [
      [-28, -20],
      [14, -20],
      [14, -8],
      [28, -8],
      [28, 20],
      [-10, 20],
      [-10, 8],
      [-28, 8]
    ],
    entrances: [
      { name: 'East Plaza Entrance', relativePos: [14, -14, 0], type: 'main', width: 4.0 },
      { name: 'Courtyard Zero-Step Entry', relativePos: [-10, 14, 0], type: 'accessible_ramp', width: 3.2 }
    ],
    interiorCorridors: [
      { level: 1, start: [14, -14], end: [-18, 0], width: 3.4 },
      { level: 2, start: [20, 0], end: [-20, 0], width: 2.8 }
    ]
  },
  {
    id: 'b-union',
    osm_way_id: 'osm-way-5729103',
    name: 'Student Union & Commons',
    category: 'student_union',
    center: [37.8698, -122.2590],
    relativeCenterMeters: [10, -75],
    heightMeters: 14.0,
    levels: 3,
    roofType: 'flat',
    wallColor: [0.78, 0.72, 0.68], // Terracotta / warm brick
    roofColor: [0.30, 0.28, 0.26],
    windowColor: [0.28, 0.40, 0.50],
    polygonFootprint: [
      [-32, -22],
      [32, -22],
      [32, 22],
      [-32, 22]
    ],
    entrances: [
      { name: 'North Quad Plaza Doors', relativePos: [0, 22, 0], type: 'main', width: 5.0 },
      { name: 'South Transit Entry', relativePos: [0, -22, 0], type: 'accessible_ramp', width: 3.5 }
    ],
    interiorCorridors: [
      { level: 1, start: [0, 22], end: [0, -22], width: 4.2 },
      { level: 1, start: [-28, 0], end: [28, 0], width: 3.8 }
    ]
  }
];

export const OPEN_SOURCE_CAMPUS_GROUNDS: CampusGroundFeature[] = [
  // Central Quad Lawn
  {
    type: 'lawn',
    color: [0.18, 0.38, 0.22], // Deep park grass
    polygon: [
      [-45, -45],
      [45, -45],
      [45, 15],
      [-45, 15]
    ]
  },
  // Main Paved Memorial Plaza
  {
    type: 'plaza',
    color: [0.38, 0.42, 0.48], // Paver stone gray
    polygon: [
      [-30, 15],
      [30, 15],
      [30, 65],
      [-30, 65]
    ]
  },
  // North Science Pathway
  {
    type: 'walkway',
    color: [0.55, 0.58, 0.62],
    polygon: [
      [20, 35],
      [65, 95],
      [75, 90],
      [28, 30]
    ]
  },
  // South Union Walkway
  {
    type: 'walkway',
    color: [0.55, 0.58, 0.62],
    polygon: [
      [-6, -45],
      [16, -75],
      [24, -75],
      [4, -45]
    ]
  }
];
