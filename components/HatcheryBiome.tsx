'use client';

import React, { useRef, useEffect, useState } from 'react';
import { CreatureInstance, EmojiReaction } from '@/lib/types';
import {
  BIOME_WIDTH,
  BIOME_HEIGHT,
  CREATURE_SIZE,
  COLORS,
} from '@/lib/constants';

interface HatcheryBiomeProps {
  creatures: CreatureInstance[];
  emojiReactions: EmojiReaction[];
}

export const HatcheryBiome: React.FC<HatcheryBiomeProps> = ({
  creatures,
  emojiReactions,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden pixel-border pixel-shadow"
      style={{
        width: BIOME_WIDTH,
        height: BIOME_HEIGHT,
        background: `linear-gradient(180deg, ${COLORS.sky} 0%, ${COLORS.lightSky} 50%, ${COLORS.grass} 100%)`,
        position: 'relative',
      }}
    >
      {/* Biome background elements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Grass patches */}
        <div
          className="absolute"
          style={{
            width: '120px',
            height: '100px',
            bottom: '0',
            left: '0',
            background: COLORS.darkGrass,
            opacity: 0.3,
            borderRadius: '50% 50% 0 0',
          }}
        />
        <div
          className="absolute"
          style={{
            width: '150px',
            height: '80px',
            bottom: '0',
            right: '0',
            background: COLORS.darkGrass,
            opacity: 0.25,
            borderRadius: '50% 50% 0 0',
          }}
        />
        {/* Decorative rocks */}
        <div
          className="absolute rounded-full"
          style={{
            width: '30px',
            height: '25px',
            bottom: '20px',
            left: '100px',
            background: '#6b5344',
            boxShadow: 'inset -2px -2px 0 rgba(0,0,0,0.5), inset 2px 2px 0 rgba(255,255,255,0.2)',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: '25px',
            height: '20px',
            bottom: '20px',
            right: '150px',
            background: '#7a6450',
            boxShadow: 'inset -2px -2px 0 rgba(0,0,0,0.5), inset 2px 2px 0 rgba(255,255,255,0.2)',
          }}
        />
      </div>

      {/* Creatures */}
      <div className="absolute inset-0">
        {creatures.map((creature) => (
          <div
            key={creature.id}
            className="absolute sprite transition-none pointer-events-none"
            style={{
              left: `${creature.x}px`,
              top: `${creature.y}px`,
              width: `${CREATURE_SIZE}px`,
              height: `${CREATURE_SIZE}px`,
              backgroundImage: `url('${creature.creatureSprite}')`,
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              zIndex: Math.floor(creature.y),
              filter: 'drop-shadow(2px 2px 0px rgba(0,0,0,0.3))',
            }}
          >
            {/* Emoji reactions above creature */}
            {emojiReactions
              .filter((r) => r.id === creature.id)
              .map((reaction) => (
                <div
                  key={`${reaction.id}-${reaction.createdAt}`}
                  className="absolute animate-fade-out pointer-events-none"
                  style={{
                    left: `${CREATURE_SIZE / 2}px`,
                    top: `-30px`,
                    fontSize: '24px',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                  }}
                >
                  {reaction.emoji}
                </div>
              ))}
          </div>
        ))}
      </div>

      {/* Empty state */}
      {creatures.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="text-center"
            style={{ 
              color: COLORS.white, 
              textShadow: `3px 3px 0 ${COLORS.black}`,
              fontSize: '12px',
            }}
          >
            <div className="mb-4">Select an egg and hatch</div>
            <div className="text-xs">to see creatures roam!</div>
          </div>
        </div>
      )}

      {/* Creature counter */}
      <div
        className="absolute top-2 right-2 pixel-border p-2"
        style={{
          background: 'rgba(0, 0, 0, 0.7)',
          color: COLORS.white,
          fontSize: '10px',
          pointerEvents: 'none',
        }}
      >
        Creatures: {creatures.length}
      </div>
    </div>
  );
};
