/**
 * The garage: vehicles saved on this device.
 *
 * AsyncStorage is a key/value store that survives closing the app. It only
 * holds strings, so everything goes through JSON.stringify / JSON.parse.
 * Every call is async because it touches disk.
 *
 * This is deliberately temporary. Once accounts exist the garage moves to
 * Supabase and this file becomes the offline cache — but the function
 * signatures below shouldn't need to change when that happens.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DecodedVehicle } from './vin';

/** A decoded vehicle plus the bits that only matter once it's saved. */
export type SavedVehicle = DecodedVehicle & {
  /** ISO timestamp. Used to sort the garage newest-first. */
  addedAt: string;
};

/**
 * Versioned key. If the shape of SavedVehicle ever changes incompatibly,
 * bump to v2 rather than trying to read old data with new code.
 */
const STORAGE_KEY = 'sonder.garage.v1';

/** Every vehicle in the garage, newest first. Returns [] if nothing is saved. */
export async function loadGarage(): Promise<SavedVehicle[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as SavedVehicle[];
    return parsed.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  } catch {
    // Corrupted storage shouldn't brick the app. Start clean.
    return [];
  }
}

/** One vehicle by VIN, or null if it isn't in the garage. */
export async function findVehicle(vin: string): Promise<SavedVehicle | null> {
  const garage = await loadGarage();
  return garage.find((v) => v.vin === vin) ?? null;
}

/**
 * Add a vehicle. Throws if that VIN is already saved — a VIN is unique to a
 * single physical car, so a duplicate is always a mistake.
 */
export async function addVehicle(vehicle: DecodedVehicle): Promise<SavedVehicle> {
  const garage = await loadGarage();

  if (garage.some((v) => v.vin === vehicle.vin)) {
    throw new Error('That vehicle is already in your garage.');
  }

  const saved: SavedVehicle = { ...vehicle, addedAt: new Date().toISOString() };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([saved, ...garage]));
  return saved;
}

/** Remove a vehicle by VIN. Silently does nothing if it wasn't there. */
export async function removeVehicle(vin: string): Promise<void> {
  const garage = await loadGarage();
  const remaining = garage.filter((v) => v.vin !== vin);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
}
