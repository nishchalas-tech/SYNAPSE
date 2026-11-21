import { createSeededNetworkState } from '../data/seedData';
import type { NetworkState } from '../types';

const STORAGE_KEY = 'synapse_demo_network_state_v1';

export function loadNetworkState(): NetworkState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = createSeededNetworkState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as NetworkState;
    if (!parsed || !Array.isArray(parsed.stores) || !Array.isArray(parsed.products) || !Array.isArray(parsed.inventory)) {
      const seeded = createSeededNetworkState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return parsed;
  } catch {
    return createSeededNetworkState();
  }
}

export function saveNetworkState(state: NetworkState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to persist SYNAPSE demo state:', err);
  }
}

export function resetNetworkState(): NetworkState {
  const seeded = createSeededNetworkState();
  saveNetworkState(seeded);
  return seeded;
}
