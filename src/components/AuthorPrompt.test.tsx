import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthorPrompt } from './AuthorPrompt';

describe('AuthorPrompt', () => {
  it('renders a name input and submit button', () => {
    render(<AuthorPrompt onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Your name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('submit button is disabled when input is empty', () => {
    render(<AuthorPrompt onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('calls onSubmit with trimmed display name', () => {
    const onSubmit = vi.fn();
    render(<AuthorPrompt onSubmit={onSubmit} />);

    const input = screen.getByLabelText('Your name');
    fireEvent.change(input, { target: { value: '  Alice  ' } });
    fireEvent.submit(input.closest('form')!);

    expect(onSubmit).toHaveBeenCalledWith({ displayName: 'Alice' });
  });

  it('does not submit when name is whitespace-only', () => {
    const onSubmit = vi.fn();
    render(<AuthorPrompt onSubmit={onSubmit} />);

    const input = screen.getByLabelText('Your name');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.submit(input.closest('form')!);

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
