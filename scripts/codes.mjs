// Code dictionaries transcribed from Taipei Police Dept.'s 道路交通事故調查報告表
// (before/after 112.07.01 = 2023-07-01). Protective-equipment codes are a superset:
// both the pre-2023 scheme (1/2/3/4) and the post-2023 scheme (2/3/4/5/6/7) appear in
// the raw files depending on when each row was recorded, sometimes within the same year.

export const PROTECTIVE_EQUIPMENT = {
  '1': { label: 'Wore helmet/seatbelt', wore: true },
  '5': { label: 'Wore half-face helmet', wore: true },
  '6': { label: 'Wore full-face helmet', wore: true },
  '7': { label: 'Wore seatbelt / child seat', wore: true },
  '2': { label: 'Did not wear', wore: false },
  '3': { label: 'Unknown', wore: null },
  '4': { label: 'N/A (pedestrian etc.)', wore: null },
};

// 車種 (party vehicle-type) code -> simplified category used across the dashboards.
export function vehicleCategory(code) {
  if (!code) return 'other';
  const p = code.slice(0, 1);
  const p2 = code.slice(0, 3);
  if (p2 === 'H01' || p2 === 'H04') return 'pedestrian';
  if (p2 === 'H02' || p2 === 'H03') return 'passenger_other';
  if (p === 'A') return 'bus_truck';
  if (p === 'B') {
    if (p2 === 'B11' || p2 === 'B12' || p2 === 'B13') return 'bus_truck';
    return 'car';
  }
  if (p === 'C') return 'motorcycle';
  if (p === 'F') return 'bicycle_slow';
  return 'other'; // D military, E special, G other
}

// 受傷程度 (injury severity) — consistent across years.
export const INJURY_SEVERITY = {
  '1': 'fatal_24h',
  '2': 'injured',
  '3': 'uninjured',
  '4': 'unknown',
  '5': 'fatal_2_30d',
};

export function isFatal(severityCode) {
  return severityCode === '1' || severityCode === '5';
}

// 飲酒情形 (drinking status) simplified.
export function drinkingStatus(code) {
  if (!code) return 'unknown';
  if (code === '1' || code === '2') return 'no_alcohol';
  if (code === '9' || code === '10' || code === '11') return 'unknown';
  return 'alcohol_detected'; // 3-8 are ascending BAC bands
}

// 區序 like "06松山區" -> "松山區"
export function districtName(raw) {
  if (!raw) return 'unknown';
  const m = raw.match(/^\d+(.+)$/);
  return m ? m[1] : raw;
}
