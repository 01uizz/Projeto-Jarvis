"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkVoiceSupport, VoiceService } from "@/services/voice";
import type { VoiceState } from "@/services/voice";

export function useVoice(onFinal: (text: string) => void) {
  const [state, setState] = useState<VoiceState>("idle");
  const [detail, setDetail] = useState<string | null>(null);
  const [interim, setInterim] = useState("");
  const service = useRef<VoiceService | null>(null);
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;

  useEffect(() => {
    const support = checkVoiceSupport();
    if (!support.supported) {
      setState("unsupported");
      setDetail(support.reason ?? null);
    }
    service.current = new VoiceService({
      onState: (s, d) => {
        setState(s);
        setDetail(d ?? null);
        if (s !== "listening") setInterim("");
      },
      onInterim: setInterim,
      onFinal: (text) => finalRef.current(text),
    });
    return () => service.current?.cancel();
  }, []);

  const toggle = useCallback(() => {
    const svc = service.current;
    if (!svc) return;
    if (svc.getState() === "listening") svc.stop();
    else svc.start();
  }, []);

  return { state, detail, interim, toggle };
}
