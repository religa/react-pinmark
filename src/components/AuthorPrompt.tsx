import React, { useState } from 'react';
import type { Author } from '../core/types';

interface AuthorPromptProps {
  onSubmit: (author: Author) => void;
}

export function AuthorPrompt({ onSubmit }: AuthorPromptProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) {
      onSubmit({ displayName: trimmed });
    }
  };

  return (
    <form className="rc-author-prompt" onSubmit={handleSubmit}>
      <label className="rc-author-prompt-label" htmlFor="rc-author-name">
        Your name
      </label>
      <div className="rc-author-prompt-row">
        <input
          id="rc-author-name"
          className="rc-author-prompt-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          autoFocus
        />
        <button
          className="rc-author-prompt-submit"
          type="submit"
          disabled={!name.trim()}
        >
          Continue
        </button>
      </div>
    </form>
  );
}
