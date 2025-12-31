import React from 'react';
import { CardItem } from '../types';

interface CardProps {
  item: CardItem | null;
  onClick: (item: CardItem) => void;
  disabled: boolean;
  column: 'left' | 'right';
}

export const Card: React.FC<CardProps> = ({ item, onClick, disabled, column }) => {
  const baseClasses = "relative w-full h-16 sm:h-20 rounded-xl border-b-4 text-base sm:text-lg font-bold transition-all duration-200 flex items-center justify-center p-1 text-center select-none";
  
  // Placeholder for empty slot
  if (!item) {
    return <div className={`w-full h-16 sm:h-20 rounded-xl border-2 border-dashed border-gray-100 bg-transparent transition-all duration-500`} />;
  }

  let stateClasses = "";

  switch (item.state) {
    case 'idle':
      stateClasses = "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 active:border-b-0 active:translate-y-1 cursor-pointer animate-pop";
      break;
    case 'selected':
      stateClasses = "bg-sky-100 border-sky-300 text-sky-600 active:border-b-0 active:translate-y-1 cursor-pointer";
      break;
    case 'matched':
      stateClasses = "bg-lingo-green border-lingo-green-dark text-white scale-105 z-10 cursor-default";
      break;
    case 'wrong':
      stateClasses = "bg-rose-100 border-rose-300 text-rose-600 animate-shake z-10";
      break;
  }

  const handleClick = () => {
    if (!disabled && item.state === 'idle') {
      onClick(item);
    }
  };

  return (
    <div 
      onClick={handleClick}
      className={`${baseClasses} ${stateClasses}`}
    >
      {item.text}
    </div>
  );
};