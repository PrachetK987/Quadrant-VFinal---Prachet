/**
 * src/data/openSourceCampusData.ts
 *
 * Open-source architectural and geospatial datasets for UC San Diego (UCSD)
 * Derived from OpenStreetMap (OSM) building geometries, floor plans, and
 * indoor facility schematics for major UCSD campus structures.
 */

export interface RoomCompartment {
  id: string;
  roomNumber: string;
  name: string;
  type: 'classroom' | 'lab' | 'study' | 'restroom' | 'office' | 'service';
  side: 'left' | 'right';
  wallOffsetMeters: number; // distance along corridor from start
  width: number;
  depth: number;
}

export interface IndoorCorridorSegment {
  id: string;
  name: string;
  floorLevel: number;
  start: [number, number]; // [x, y] in meters
  end: [number, number];
  width: number; // typically 2.6m - 3.4m
  height: number; // typically 3.0m - 3.4m
  rooms: RoomCompartment[];
  junctions?: Array<{
    positionMeters: number;
    direction: 'left' | 'right' | 'both';
    targetCorridorName: string;
  }>;
}

export interface BuildingFootprintOSM {
  id: string;
  osm_way_id: string;
  name: string;
  campus: string;
  category: 'library' | 'academic' | 'student_union' | 'engineering';
  center: [number, number]; // [lat, lng]
  relativeCenterMeters: [number, number];
  heightMeters: number;
  levels: number;
  roofType: 'brutalist' | 'flat' | 'parapet';
  wallColor: [number, number, number];
  interiorCorridors: IndoorCorridorSegment[];
}

export const UCSD_CAMPUS_BUILDINGS: BuildingFootprintOSM[] = [
  {
    id: 'b-geisel',
    osm_way_id: 'osm-way-ucsd-geisel',
    name: 'Geisel Library (UCSD)',
    campus: 'UC San Diego',
    category: 'library',
    center: [32.8811, -117.2376],
    relativeCenterMeters: [0, 60],
    heightMeters: 33.5,
    levels: 8,
    roofType: 'brutalist',
    wallColor: [0.80, 0.82, 0.85], // Brutalist pre-cast concrete
    interiorCorridors: [
      {
        id: 'geisel-fl2-main',
        name: 'Floor 2 West Concourse',
        floorLevel: 2,
        start: [0, 0],
        end: [0, 48],
        width: 3.2,
        height: 3.2,
        rooms: [
          { id: 'g201', roomNumber: '201', name: 'Digital Media Lab', type: 'lab', side: 'left', wallOffsetMeters: 6, width: 9, depth: 8 },
          { id: 'g208', roomNumber: '208', name: 'Collaborative Commons', type: 'study', side: 'right', wallOffsetMeters: 14, width: 12, depth: 10 },
          { id: 'g214', roomNumber: '214', name: 'Silent Study Outlets Hall', type: 'study', side: 'left', wallOffsetMeters: 26, width: 14, depth: 12 },
          { id: 'g220', roomNumber: '220', name: 'Research Carrels', type: 'study', side: 'right', wallOffsetMeters: 38, width: 8, depth: 7 }
        ],
        junctions: [
          { positionMeters: 24, direction: 'right', targetCorridorName: 'North Wing Study Alcove' },
          { positionMeters: 48, direction: 'left', targetCorridorName: 'East Tower Elevators' }
        ]
      }
    ]
  },
  {
    id: 'b-price-center',
    osm_way_id: 'osm-way-ucsd-price',
    name: 'Price Center (UCSD)',
    campus: 'UC San Diego',
    category: 'student_union',
    center: [32.8797, -117.2361],
    relativeCenterMeters: [40, -50],
    heightMeters: 18.0,
    levels: 3,
    roofType: 'flat',
    wallColor: [0.86, 0.84, 0.80],
    interiorCorridors: [
      {
        id: 'price-level1-concourse',
        name: 'Level 1 West Concourse',
        floorLevel: 1,
        start: [0, 0],
        end: [0, 56],
        width: 3.6,
        height: 3.5,
        rooms: [
          { id: 'pc101', roomNumber: '101', name: 'Student Lounge Hub', type: 'study', side: 'right', wallOffsetMeters: 8, width: 12, depth: 10 },
          { id: 'pc108', roomNumber: '108', name: 'Commuter Microwaves & Lockers', type: 'service', side: 'left', wallOffsetMeters: 18, width: 8, depth: 6 },
          { id: 'pc115', roomNumber: '115', name: 'Dining Plaza Corridor', type: 'service', side: 'right', wallOffsetMeters: 32, width: 16, depth: 14 },
          { id: 'pc122', roomNumber: '122', name: 'Study Quiet Zone', type: 'study', side: 'left', wallOffsetMeters: 44, width: 10, depth: 9 }
        ],
        junctions: [
          { positionMeters: 30, direction: 'left', targetCorridorName: 'Bookstore Arcade' },
          { positionMeters: 56, direction: 'both', targetCorridorName: 'Plaza Atrium Crossway' }
        ]
      }
    ]
  },
  {
    id: 'b-cse',
    osm_way_id: 'osm-way-ucsd-cse',
    name: 'Computer Science & Engineering (UCSD)',
    campus: 'UC San Diego',
    category: 'engineering',
    center: [32.8818, -117.2335],
    relativeCenterMeters: [120, 45],
    heightMeters: 20.0,
    levels: 4,
    roofType: 'flat',
    wallColor: [0.75, 0.77, 0.82],
    interiorCorridors: [
      {
        id: 'cse-b2-corridor',
        name: 'Basement Labs Concourse',
        floorLevel: 0,
        start: [0, 0],
        end: [0, 50],
        width: 2.8,
        height: 3.0,
        rooms: [
          { id: 'cse-b210', roomNumber: 'B210', name: 'Undergrad Linux Lab', type: 'lab', side: 'left', wallOffsetMeters: 10, width: 14, depth: 10 },
          { id: 'cse-b220', roomNumber: 'B220', name: 'Robotics & AI Studio', type: 'lab', side: 'right', wallOffsetMeters: 22, width: 14, depth: 12 },
          { id: 'cse-b240', roomNumber: 'B240', name: 'Tutor Hall & Outlets', type: 'study', side: 'left', wallOffsetMeters: 36, width: 12, depth: 8 }
        ],
        junctions: [
          { positionMeters: 28, direction: 'right', targetCorridorName: 'Warren Courtyard Exit' }
        ]
      }
    ]
  }
];

export const OPEN_SOURCE_CAMPUS_BUILDINGS = UCSD_CAMPUS_BUILDINGS;
export const OPEN_SOURCE_CAMPUS_GROUNDS: any[] = [];
