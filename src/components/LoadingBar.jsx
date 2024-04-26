import React from 'react';

export default function LoadingBar() {
  return (
    <>
      <style>
        {`
          @keyframes pulse {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}
      </style>
      <div
        style={{
          height: 5,
          width: '100%',
          backgroundColor: 'grey',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: '100%',
            backgroundImage: 'linear-gradient(90deg, transparent, lightgreen, transparent)',
            animation: 'pulse 2s infinite linear',
          }}
        />
      </div>
    </>
  );
}
