import AsyncStorage from '@react-native-async-storage/async-storage';

export const WORK_LOCATION_KEY = 'work_location';

export interface WorkLocation {
  latitude: number;
  longitude: number;
  radius: number; // metres
  label: string;
}

export async function getWorkLocation(): Promise<WorkLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(WORK_LOCATION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WorkLocation;
  } catch (e) {
    console.error('[WorkLocation] Failed to read work location:', e);
    return null;
  }
}

export async function saveWorkLocation(loc: WorkLocation): Promise<void> {
  console.log('[WorkLocation] Saving work location:', loc);
  await AsyncStorage.setItem(WORK_LOCATION_KEY, JSON.stringify(loc));
  console.log('[WorkLocation] Work location saved successfully');
}

export async function clearWorkLocation(): Promise<void> {
  console.log('[WorkLocation] Clearing work location');
  await AsyncStorage.removeItem(WORK_LOCATION_KEY);
}

/** Returns distance in metres between two lat/lng points (Haversine). */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
