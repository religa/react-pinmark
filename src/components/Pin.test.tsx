import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pin } from './Pin';
import type { Thread } from '../core/types';

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: 'thread-1',
    projectId: 'proj-1',
    pageUrl: '/page',
    pin: { x: 50, y: 200 },
    status: 'open',
    createdAt: '2024-01-01T00:00:00Z',
    comments: [],
    ...overrides,
  };
}

describe('Pin', () => {
  beforeEach(() => {
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('scrollY', 0);
  });

  it('renders with the correct index number', () => {
    render(
      <Pin
        thread={makeThread()}
        index={2}
        isActive={false}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('button')).toHaveTextContent('3');
  });

  it('is positioned based on pin coordinates', () => {
    render(
      <Pin
        thread={makeThread({ pin: { x: 50, y: 200 } })}
        index={0}
        isActive={false}
        onClick={vi.fn()}
      />,
    );
    const btn = screen.getByRole('button');
    expect(btn.style.left).toBe('500px');
    expect(btn.style.top).toBe('200px');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(
      <Pin thread={makeThread()} index={0} isActive={false} onClick={onClick} />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies active class when isActive is true', () => {
    render(
      <Pin thread={makeThread()} index={0} isActive={true} onClick={vi.fn()} />,
    );
    expect(screen.getByRole('button').className).toContain('rc-pin--active');
  });

  it('applies resolved class for resolved threads', () => {
    render(
      <Pin
        thread={makeThread({ status: 'resolved' })}
        index={0}
        isActive={false}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('button').className).toContain('rc-pin--resolved');
  });

  it('repositions on window resize', () => {
    render(
      <Pin
        thread={makeThread({ pin: { x: 50, y: 200 } })}
        index={0}
        isActive={false}
        onClick={vi.fn()}
      />,
    );
    let btn = screen.getByRole('button');
    expect(btn.style.left).toBe('500px');

    // Resize window
    vi.stubGlobal('innerWidth', 2000);
    fireEvent(window, new Event('resize'));

    btn = screen.getByRole('button');
    expect(btn.style.left).toBe('1000px');
  });
});
