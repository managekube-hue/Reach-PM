import { useEffect } from 'react';

export type KeyBinding = {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
};

export function useKeyBindings(bindings: KeyBinding[], enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      for (const binding of bindings) {
        const ctrlMatch = binding.ctrl === undefined || binding.ctrl === e.ctrlKey;
        const shiftMatch = binding.shift === undefined || binding.shift === e.shiftKey;
        const altMatch = binding.alt === undefined || binding.alt === e.altKey;
        const keyMatch = e.key.toLowerCase() === binding.key.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          e.preventDefault();
          binding.action();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bindings, enabled]);
}

// Common chat key bindings
export const CHAT_KEY_BINDINGS = {
  SEND_MESSAGE: { key: 'Enter', description: 'Send message' },
  NEW_LINE: { key: 'Enter', shift: true, description: 'New line' },
  FOCUS_COMPOSER: { key: 'c', ctrl: true, description: 'Focus message composer' },
  TOGGLE_SIDEBAR: { key: 'b', ctrl: true, description: 'Toggle sidebar' },
  SEARCH: { key: 'k', ctrl: true, description: 'Search' },
  QUICK_SWITCHER: { key: 'k', ctrl: true, shift: true, description: 'Quick switcher' },
  MARK_READ: { key: 'Escape', description: 'Mark as read' },
  NEXT_CHANNEL: { key: 'ArrowDown', alt: true, description: 'Next channel' },
  PREV_CHANNEL: { key: 'ArrowUp', alt: true, description: 'Previous channel' },
  TOGGLE_THREADS: { key: 't', ctrl: true, description: 'Toggle threads' },
  EMOJI_PICKER: { key: 'e', ctrl: true, shift: true, description: 'Emoji picker' },
};
