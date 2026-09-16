// Official Taipei Police report forms, field 4 (weather), 5 (lighting),
// 7 (speed limit), 15 (collision). Sources and version policy:
// docs/implementation/accident-context.md.
const weather = {
  1: 'Heavy rain', 2: 'Strong wind', 3: 'Windblown sand', 4: 'Fog / smoke',
  5: 'Snow', 6: 'Rain', 7: 'Overcast', 8: 'Clear',
};
const lighting = {
  1: 'Daylight', 2: 'Dawn / dusk',
  3: 'Night / enclosed road, lit', 4: 'Night / enclosed road, unlit',
};
const collision = {
  1: 'Person travelling opposite vehicle direction',
  2: 'Person travelling with vehicle direction', 3: 'Person crossing road',
  4: 'Person playing on road', 5: 'Person working on road', 6: 'Person entering road suddenly',
  7: 'Person emerging behind parked / stopping vehicle', 8: 'Person standing at roadside',
  9: 'Other person–vehicle collision',
  10: 'Head-on collision', 11: 'Opposing-direction sideswipe', 12: 'Same-direction sideswipe',
  13: 'Rear-end collision', 14: 'Reversing collision', 15: 'Intersection crossing collision',
  16: 'Side-impact collision', 17: 'Other vehicle–vehicle collision',
  18: 'Overturn / fall on road', 19: 'Vehicle leaving road', 20: 'Collision with guardrail / post',
  21: 'Collision with signal / sign post', 22: 'Collision with toll booth',
  23: 'Collision with traffic island', 24: 'Collision with movable object',
  25: 'Collision with bridge / building', 26: 'Collision with tree / utility pole',
  27: 'Collision with animal', 28: 'Collision with construction works', 29: 'Other single-vehicle accident',
  30: 'Railway crossing barrier collision / breach', 31: 'Accident while crossing railway',
  32: 'Improper stopping position at railway crossing', 33: 'Immobilized at railway crossing',
  34: 'Other railway crossing accident',
};

export function codebookForDate(year, month, day) {
  return year > 2023 || (year === 2023 && (month > 7 || (month === 7 && day >= 1)))
    ? '2023-07-01' : 'pre-2023-07-01';
}

export function contextValue(field, rawCode, codebook) {
  const unrecognized = (label) => ({ recognized: false, label });
  if (!/^\d+$/.test(rawCode)) return unrecognized(`Unrecognized code ${rawCode}`);
  const code = Number(rawCode);
  const modern = codebook === '2023-07-01';
  if (codebook !== 'pre-2023-07-01' && !modern) return unrecognized(`Unrecognized codebook (code ${rawCode})`);
  let label;
  if (field === 'weather') label = modern && code === 9 ? 'Wind' : weather[code];
  if (field === 'lighting') {
    label = lighting[code];
    if (modern) label = ({ 5: 'Lighting installed and on', 6: 'Lighting off / faulty', 7: 'No lighting installed' })[code] ?? label;
  }
  if (field === 'collision') {
    label = collision[code];
    if (modern) label = ({ 35: 'Collision with bridge / bridge pier', 36: 'Collision with building',
      37: 'Collision with tree', 38: 'Collision with utility pole' })[code] ?? label;
  }
  return label ? { recognized: true, label } : unrecognized(`Unrecognized code ${rawCode}`);
}

export function contextLabel(field, rawCode, codebook) {
  return contextValue(field, rawCode, codebook).label;
}

export const contextFields = {
  weather: '天候', lighting: '光線', speedLimit: '速限-速度限制', collision: '事故類型及型態',
};

export function createContext(year, month, day) {
  return { codebook: codebookForDate(year, month, day), weather: [], lighting: [], speedLimit: [], collision: [] };
}

export function mergeContext(context, row) {
  for (const [field, column] of Object.entries(contextFields)) {
    const value = row[column]?.trim();
    if (value && !context[field].includes(value)) context[field].push(value);
    context[field].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  }
}

export function speedLimitLabel(value) {
  return isRecognizedSpeedLimit(value)
    ? `${Number(value)} km/h` : `Unrecognized value ${value}`;
}

export function isRecognizedSpeedLimit(value) {
  return /^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 200;
}
