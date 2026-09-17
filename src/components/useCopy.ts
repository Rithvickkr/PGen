import { useEffect, useRef, useState } from 'react';
import { copyText } from '../lib/storage';

export function useCopy(duration = 1800) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async (text: string) => {
    await copyText(text);
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), duration);
  };

  return { copied, copy };
}
