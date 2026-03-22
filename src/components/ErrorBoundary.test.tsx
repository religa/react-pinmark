import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function ThrowingChild({ error }: { error?: Error }) {
  if (error) throw error;
  return <div>Child content</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('renders null when a child throws', () => {
    const { container } = render(
      <ErrorBoundary>
        <ThrowingChild error={new Error('boom')} />
      </ErrorBoundary>,
    );
    expect(container.innerHTML).toBe('');
    expect(screen.queryByText('Child content')).not.toBeInTheDocument();
  });

  it('logs the error to console.error', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild error={new Error('test error')} />
      </ErrorBoundary>,
    );
    expect(console.error).toHaveBeenCalledWith(
      '[react-pinmark] Error in overlay:',
      expect.any(Error),
      expect.any(String),
    );
  });
});
