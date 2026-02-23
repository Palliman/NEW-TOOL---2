import { EggData } from './types';

// Generate egg data using blob storage URLs
export const generateEggData = (): EggData[] => {
  const eggs: EggData[] = [];
  const types = ['fire', 'water', 'grass', 'neutral', 'electric', 'ice', 'psychic', 'dragon'];
  const baseUrl = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/files-blob/egg_hatcher_sprites';
  
  for (let i = 1; i <= 255; i++) {
    const typeIndex = (i - 1) % types.length;
    const paddedNum = String(i).padStart(3, '0');
    eggs.push({
      id: i,
      eggSprite: `${baseUrl}/eggs/egg_${paddedNum}.png`,
      creatureSprite: `${baseUrl}/creatures/creature_${paddedNum}.png`,
      type: types[typeIndex],
      name: `Creature #${i}`,
    });
  }
  
  return eggs;
};

export const EGGS = generateEggData();

// Game constants
export const INCUBATION_DURATION = 30 * 1000; // 30 seconds
export const MAX_INCUBATORS = 10;
export const BIOME_WIDTH = 800;
export const BIOME_HEIGHT = 500;
export const CREATURE_SIZE = 64;
export const CREATURE_SPEED = 75; // pixels per second
export const CREATURE_UPDATE_INTERVAL = 50; // ms
export const DIRECTION_CHANGE_INTERVAL = 2000; // 2-5 seconds
export const IDLE_DURATION = 1000; // 1 second idle
export const PROXIMITY_RADIUS = 60; // pixels
export const EMOJI_DURATION = 2000; // 2 seconds
export const INTERACTION_THRESHOLD = 500; // ms

// Color palette (pixel-art theme)
export const COLORS = {
  grass: '#2ecc71',
  darkGrass: '#27ae60',
  soil: '#8b4513',
  darkSoil: '#654321',
  sky: '#3498db',
  lightSky: '#5dade2',
  white: '#ffffff',
  black: '#000000',
  border: '#1a1a1a',
  accent: '#f39c12',
};

// Emoji reactions by type
export const EMOJI_REACTIONS = {
  same: ['😊', '💖', '✨', '🌟', '👏'],
  clash: ['😤', '⚡', '❗', '💥', '⚠️'],
  curious: ['👀', '❓', '🤔', '😲', '👋'],
  idle: ['💤', '😴', '🌙', '😪'],
};
