'use client';

import React from 'react';
import { Incubator, EggData } from '@/lib/types';
import { MAX_INCUBATORS, COLORS } from '@/lib/constants';

interface IncubatorPanelProps {
  incubators: Incubator[];
  selectedEgg: EggData | null;
  onAddIncubator: () => void;
  onSlotClick: (slotId: number) => void;
  onSpawnClick: (slotId: number) => void;
}

const IncubatorSlot: React.FC<{
  incubator: Incubator;
  selectedEgg: EggData | null;
  eggs: EggData[];
  onClick: () => void;
  onSpawn: () => void;
}> = ({ incubator, selectedEgg, eggs, onClick, onSpawn }) => {
  const [displayTime, setDisplayTime] = React.useState(0);
  const egg = eggs.find((e) => e.id === incubator.eggId);
  const remainingMs =
    incubator.status === 'incubating' && incubator.startTime
      ? Math.max(0, incubator.duration - (Date.now() - incubator.startTime))
      : 0;
  const remainingSecs = Math.ceil(remainingMs / 1000);
  const progress =
    incubator.status === 'incubating' && incubator.startTime
      ? ((incubator.duration - remainingMs) / incubator.duration) * 100
      : 0;

  React.useEffect(() => {
    if (incubator.status === 'incubating') {
      const timer = setInterval(() => {
        setDisplayTime(Date.now());
      }, 500);
      return () => clearInterval(timer);
    }
  }, [incubator.status]);

  const slotStyle: React.CSSProperties = {
    background: 
      incubator.status === 'empty' ? '#d4af37' :
      incubator.status === 'ready' ? '#f39c12' : '#a0522d',
    minHeight: '80px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    transform: incubator.status === 'ready' ? 'scale(1.05)' : 'scale(1)',
    transition: 'transform 0.3s, background 0.3s',
  };

  return (
    <div
      onClick={onClick}
      className="pixel-border p-2 mb-2 cursor-pointer hover:brightness-110"
      style={slotStyle}
    >
      {incubator.status === 'empty' ? (
        <div
          className="text-xs text-center flex items-center justify-center flex-1"
          style={{ color: COLORS.black }}
        >
          {selectedEgg ? 'Click to add' : 'Empty'}
        </div>
      ) : (
        <>
          <div className="flex gap-1 mb-1">
            {egg && (
              <img
                src={egg.eggSprite}
                alt="egg"
                className="sprite animate-bounce-pixel"
                style={{ width: '24px', height: '24px' }}
              />
            )}
            <div className="flex-1">
              <div className="text-xs" style={{ color: COLORS.white }}>
                #{incubator.eggId}
              </div>
              {incubator.status === 'incubating' && (
                <div className="text-xs font-bold" style={{ color: COLORS.white }}>
                  {remainingSecs}s
                </div>
              )}
              {incubator.status === 'ready' && (
                <div className="text-xs font-bold animate-bounce-pixel" style={{ color: '#f39c12' }}>
                  READY!
                </div>
              )}
            </div>
          </div>

          {incubator.status === 'incubating' && (
            <div
              className="pixel-border"
              style={{
                height: '8px',
                background: '#654321',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  background: '#2ecc71',
                  width: `${progress}%`,
                  transition: 'width 0.1s linear',
                  boxShadow: '0 0 4px rgba(46, 204, 113, 0.8)',
                }}
              />
            </div>
          )}

          {incubator.status === 'ready' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSpawn();
              }}
              className="pixel-border px-1 py-0 text-xs bg-yellow-400 hover:bg-yellow-300 font-bold"
              style={{
                color: COLORS.black,
                fontFamily: 'Press Start 2P',
                fontSize: '8px',
                padding: '2px 4px',
                cursor: 'pointer',
                boxShadow: '0 0 8px rgba(243, 156, 18, 0.6)',
              }}
            >
              SPAWN
            </button>
          )}
        </>
      )}
    </div>
  );
};

export const IncubatorPanel: React.FC<IncubatorPanelProps> = ({
  incubators,
  selectedEgg,
  onAddIncubator,
  onSlotClick,
  onSpawnClick,
}) => {
  const eggs = require('@/lib/constants').EGGS;
  const hatchedCount = incubators.filter((i) => i.status === 'hatched').length;

  return (
    <div
      className="pixel-border p-3 flex flex-col"
      style={{
        background: COLORS.soil,
        width: '150px',
        maxHeight: BIOME_HEIGHT,
        overflow: 'auto',
      }}
    >
      <div className="mb-2" style={{ color: COLORS.white, fontSize: '10px', textShadow: '2px 2px 0 #000' }}>
        INCUBATORS
      </div>
      <div className="text-xs mb-1" style={{ color: COLORS.white }}>
        {incubators.length} / {MAX_INCUBATORS}
      </div>
      <div className="text-xs mb-3" style={{ color: '#2ecc71', fontSize: '8px' }}>
        Spawned: {incubators.filter((i) => i.status === 'hatched').length}
      </div>

      <div className="flex-1 mb-2">
        {incubators.map((incubator) => (
          <IncubatorSlot
            key={incubator.slotId}
            incubator={incubator}
            selectedEgg={selectedEgg}
            eggs={eggs}
            onClick={() => onSlotClick(incubator.slotId)}
            onSpawn={() => onSpawnClick(incubator.slotId)}
          />
        ))}
      </div>

      <button
        onClick={onAddIncubator}
        disabled={incubators.length >= MAX_INCUBATORS}
        className="pixel-border px-2 py-1 text-xs bg-green-400 hover:bg-green-300 disabled:bg-gray-400 disabled:opacity-50 font-bold"
        style={{
          color: COLORS.black,
          fontFamily: 'Press Start 2P',
          fontSize: '8px',
          cursor: incubators.length >= MAX_INCUBATORS ? 'not-allowed' : 'pointer',
          boxShadow: incubators.length >= MAX_INCUBATORS ? 'none' : '0 0 8px rgba(46, 204, 113, 0.4)',
        }}
      >
        ADD
      </button>
    </div>
  );
};

const BIOME_HEIGHT = 500; // Import from constants
