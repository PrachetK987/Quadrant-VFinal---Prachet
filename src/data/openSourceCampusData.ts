/**
 * src/data/openSourceCampusData.ts
 *
 * Open-source architectural and geospatial datasets for UC San Diego (UCSD)
 * Featuring the Design and Innovation Building (DIB), Geisel Library, and Price Center.
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
  width: number;
  height: number;
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
  category: 'design_lab' | 'library' | 'academic' | 'student_union' | 'engineering';
  center: [number, number]; // [lat, lng]
  relativeCenterMeters: [number, number];
  heightMeters: number;
  levels: number;
  roofType: 'modern_glass' | 'brutalist' | 'flat' | 'parapet';
  wallColor: [number, number, number];
  interiorCorridors: IndoorCorridorSegment[];
}

export const UCSD_CAMPUS_BUILDINGS: BuildingFootprintOSM[] = [
  {
    id: 'b-dib',
    osm_way_id: 'osm-way-ucsd-dib',
    name: 'Design and Innovation Building (DIB)',
    campus: 'UC San Diego',
    category: 'design_lab',
    center: [32.8784, -117.2359],
    relativeCenterMeters: [0, 0],
    heightMeters: 19.5,
    levels: 4,
    roofType: 'modern_glass',
    wallColor: [0.88, 0.90, 0.92], // Clean architectural glass and white structural steel
    interiorCorridors: [
      {
        id: 'dib-level2-main',
        name: 'Level 2 Design Studio Concourse',
        floorLevel: 2,
        start: [0, 0],
        end: [0, 52],
        width: 3.4,
        height: 3.5,
        rooms: [
          { id: 'dib-202', roomNumber: '202', name: 'Design Studio & Prototyping', type: 'lab', side: 'left', wallOffsetMeters: 7, width: 12, depth: 10 },
          { id: 'dib-208', roomNumber: '208', name: 'Makerspace Laser & 3D Bay', type: 'lab', side: 'right', wallOffsetMeters: 16, width: 14, depth: 11 },
          { id: 'dib-214', roomNumber: '214', name: 'Don Norman Design Lab', type: 'study', side: 'left', wallOffsetMeters: 28, width: 15, depth: 12 },
          { id: 'dib-222', roomNumber: '222', name: 'Collaborative Showcase Terrace', type: 'study', side: 'right', wallOffsetMeters: 42, width: 10, depth: 8 }
        ],
        junctions: [
          { positionMeters: 24, direction: 'both', targetCorridorName: 'Pepper Canyon Terrace Skywalk' },
          { positionMeters: 52, direction: 'right', targetCorridorName: 'The Basement Startup Loft' }
        ]
      },
      {
        id: 'dib-level1-maker',
        name: 'Level 1 Maker Studios & Exhibition',
        floorLevel: 1,
        start: [0, 0],
        end: [0, 48],
        width: 3.6,
        height: 3.8,
        rooms: [
          { id: 'dib-102', roomNumber: '102', name: 'EnVision Prototyping Hub', type: 'lab', side: 'left', wallOffsetMeters: 8, width: 14, depth: 12 },
          { id: 'dib-106', roomNumber: '106', name: 'Materials & Woodworking Lab', type: 'lab', side: 'right', wallOffsetMeters: 20, width: 12, depth: 10 },
          { id: 'dib-114', roomNumber: '114', name: 'Cafe & Commons Lounge', type: 'service', side: 'left', wallOffsetMeters: 34, width: 16, depth: 10 }
        ]
      }
    ]
  },
  {
    id: 'b-geisel',
    osm_way_id: 'osm-way-ucsd-geisel',
    name: 'Geisel Library (UCSD)',
    campus: 'UC San Diego',
    category: 'library',
    center: [32.8811, -117.2376],
    relativeCenterMeters: [-40, 110],
    heightMeters: 33.5,
    levels: 8,
    roofType: 'brutalist',
    wallColor: [0.80, 0.82, 0.85],
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
          { id: 'g214', roomNumber: '214', name: 'Silent Study Outlets Hall', type: 'study', side: 'left', wallOffsetMeters: 26, width: 14, depth: 12 }
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
    relativeCenterMeters: [20, 45],
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
          { id: 'pc115', roomNumber: '115', name: 'Dining Plaza Corridor', type: 'service', side: 'right', wallOffsetMeters: 32, width: 16, depth: 14 }
        ]
      }
    ]
  }
];

export const OPEN_SOURCE_CAMPUS_BUILDINGS = UCSD_CAMPUS_BUILDINGS;
export const OPEN_SOURCE_CAMPUS_GROUNDS: any[] = [];
