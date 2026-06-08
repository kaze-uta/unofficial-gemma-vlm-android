import { useEffect, useRef, useState, useCallback } from 'react';
import { gemmaEvents } from '../native/GemmaModule';

// ── ストリーミング購読フック ────────────────────────────────────────
export function useGemmaStream() {
  const [partial, setPartial] = useState('');
  const partialRef = useRef('');

  useEffect(() => {
    if (!gemmaEvents) return;
    const tok = gemmaEvents.addListener('onToken', (e: { token: string }) => {
      partialRef.current += e.token ?? '';
      setPartial(partialRef.current);
    });
    return () => {
      tok.remove();
    };
  }, []);

  const reset = useCallback(() => {
    partialRef.current = '';
    setPartial('');
  }, []);

  return { partial, reset };
}
