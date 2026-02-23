'use client';

import React, { useState } from 'react';
import { EggData } from '@/lib/types';
import { EGGS, COLORS, BIOME_HEIGHT } from '@/lib/constants';

interface EggCaseProps {
  selectedEggId: number | null;
  onSelectEgg: (egg: EggData) => void;
}

export const EggCase: React.FC<EggCaseProps> = ({ selectedEggId, onSelectEgg }) => {
  const [scrollPos, setScrollPos] = useState(0);

  return (
    <div
      className="pixel-border p-2 flex flex-col"
      style={{
        background: COLORS.darkGrass,
        width: '200px',
        maxHeight: BIOME_HEIGHT,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className="mb-2" style={{ color: COLORS.white, fontSize: '10px' }}>
        EGG CASE
      </div>
      <div className="text-xs mb-2" style={{ color: COLORS.white }}>
        {selectedEggId ? `Selected: #${selectedEggId}` : 'Select an egg'}
      </div>

      <div
        className="overflow-y-auto flex-1"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '4px',
        }}
      >
        {EGGS.map((egg) => (
          <button
            key={egg.id}
            onClick={() => onSelectEgg(egg)}
            className={`pixel-border p-1 transition-all ${
              selectedEggId === egg.id
                ? 'ring-4 ring-offset-2 ring-yellow-300'
                : 'hover:brightness-110'
            }`}
            style={{
              background: selectedEggId === egg.id ? '#f39c12' : COLORS.soil,
              aspectRatio: '1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: '4px',
              transform: selectedEggId === egg.id ? 'scale(1.08)' : 'scale(1)',
              boxShadow: selectedEggId === egg.id ? '0 0 12px rgba(243, 156, 18, 0.8)' : 'none',
            }}
            title={`#${egg.id} - ${egg.type}`}
          >
            <img
              src={egg.eggSprite}
              alt={`Egg ${egg.id}`}
              className={`sprite ${selectedEggId === egg.id ? 'animate-bounce-pixel' : ''}`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
};
