import React, { useEffect, useState, useCallback } from 'react';
import type { Thread } from '../core/types';
import { resolvePin } from '../core/pin-resolver';

interface PinProps {
  thread: Thread;
  index: number;
  isActive: boolean;
  onClick: () => void;
  highlighted?: boolean;
}

export function Pin({ thread, index, isActive, onClick, highlighted }: PinProps) {
  const [position, setPosition] = useState(() => resolvePin(thread.pin));

  const updatePosition = useCallback(() => {
    setPosition(resolvePin(thread.pin));
  }, [thread.pin]);

  // Re-resolve after mount (covers SPA navigation where DOM may be stale
  // during the useState initializer), on window resize, and on scroll
  // (so pins track elements inside scrollable containers).
  useEffect(() => {
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [updatePosition]);

  const isResolved = thread.status === 'resolved';

  return (
    <button
      className={[
        'rc-pin',
        isResolved ? 'rc-pin--resolved' : '',
        isActive ? 'rc-pin--active' : '',
        highlighted ? 'rc-pin--highlighted' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        position: 'absolute',
        left: `${position.left}px`,
        top: `${position.top}px`,
      }}
      onClick={onClick}
      aria-label={`Comment thread ${index + 1}${isResolved ? ' (resolved)' : ''}`}
      data-thread-id={thread.id}
    >
      {index + 1}
    </button>
  );
}
