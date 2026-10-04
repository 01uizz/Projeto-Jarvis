/**
 * Camada de voz (speech-to-text) baseada na Web Speech API.
 * A interface é independente do navegador: um provedor mais avançado (ex.: transcrição no servidor)
 * pode substituir esta classe mantendo os mesmos estados e callbacks.
 */

import { isNativeAndroid } from "@/android/platform";

/** idle=parado · listening=OUVINDO · processing=PROCESSANDO · speaking=RESPONDENDO · error=ERRO · denied=SEM PERMISSÃO · unsupported=INDISPONÍVEL */
export type VoiceState = "idle" | "listening" | "processing" | "speaking" | "success" | "error" | "denied" | "unsupported";

export interface VoiceCallbacks {
  onState: (state: VoiceState, detail?: string) => void;
  /** Texto parcial enquanto o usuário fala. */
  onInterim?: (text: string) => void;
  /** Texto final reconhecido. */
  onFinal: (text: string) => void;
}

interface RecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<RecognitionResultLike>;
}
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => RecognitionLike;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface VoiceSupport {
  supported: boolean;
  reason?: string;
}

export function checkVoiceSupport(): VoiceSupport {
  if (isNativeAndroid()) return { supported: true }; // a disponibilidade real do motor é checada ao iniciar
  if (typeof window === "undefined") return { supported: false, reason: "Voz só funciona no navegador." };
  if (!window.isSecureContext) {
    return { supported: false, reason: "O microfone exige uma conexão segura (HTTPS). Abra o JARVIS pelo endereço https da Vercel." };
  }
  if (!getCtor()) {
    return { supported: false, reason: "Este navegador não oferece reconhecimento de voz. Tente o Chrome (Android) ou o Safari recente (iPhone)." };
  }
  return { supported: true };
}

export function describeVoiceError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Permissão do microfone negada. Libere o microfone para este site nas configurações do navegador e tente de novo.";
    case "no-speech":
      return "Não ouvi nada. Toque no microfone e fale de novo.";
    case "audio-capture":
      return "Nenhum microfone foi encontrado ou ele está em uso por outro aplicativo.";
    case "network":
      return "O reconhecimento de voz precisa de internet e não conseguiu se conectar.";
    case "language-not-supported":
      return "O idioma português não é suportado pelo reconhecimento de voz deste navegador.";
    case "aborted":
      return "A gravação foi interrompida.";
    default:
      return "Não foi possível usar o microfone agora. Tente novamente.";
  }
}

export class VoiceService {
  private recognition: RecognitionLike | null = null;
  private finalText = "";
  private errored = false;
  private state: VoiceState = "idle";

  constructor(private callbacks: VoiceCallbacks, private lang = "pt-BR") {}

  getState(): VoiceState {
    return this.state;
  }

  private set(state: VoiceState, detail?: string) {
    this.state = state;
    this.callbacks.onState(state, detail);
  }

  /** Reconhecimento nativo do Android (plugin Capacitor). Pede a permissão do microfone sob demanda. */
  private async startNative(): Promise<void> {
    try {
      const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
      const avail = await SpeechRecognition.available().catch(() => ({ available: false }));
      if (!avail.available) {
        this.set("unsupported", "Este aparelho não tem um serviço de reconhecimento de voz disponível (instale ou ative o Google).");
        return;
      }
      let perm = (await SpeechRecognition.checkPermissions()).speechRecognition;
      if (perm !== "granted") perm = (await SpeechRecognition.requestPermissions()).speechRecognition;
      if (perm !== "granted") {
        this.set("denied", "Sem permissão do microfone. Libere em Configurações do Android → Apps → JARVIS → Permissões.");
        return;
      }
      this.set("listening");
      const res = await SpeechRecognition.start({ language: this.lang, maxResults: 1, prompt: "Fale com o JARVIS", partialResults: false, popup: false });
      const text = (res.matches?.[0] ?? "").trim();
      if (!text) {
        this.set("error", describeVoiceError("no-speech"));
        return;
      }
      this.set("processing");
      this.callbacks.onFinal(text);
      this.set("success");
    } catch (e) {
      console.error("[JARVIS] voz nativa", e);
      const msg = e instanceof Error ? e.message.toLowerCase() : "";
      if (msg.includes("permission")) this.set("denied", "Sem permissão do microfone.");
      else if (msg.includes("no match") || msg.includes("no speech")) this.set("error", describeVoiceError("no-speech"));
      else this.set("error", describeVoiceError("unknown"));
    }
  }

  start(): void {
    if (isNativeAndroid()) {
      if (this.state !== "listening") void this.startNative();
      return;
    }
    const support = checkVoiceSupport();
    if (!support.supported) {
      this.set("unsupported", support.reason);
      return;
    }
    if (this.state === "listening") return;
    const Ctor = getCtor();
    if (!Ctor) return;

    this.finalText = "";
    this.errored = false;
    const rec = new Ctor();
    rec.lang = this.lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => this.set("listening");
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) this.finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (interim) this.callbacks.onInterim?.(interim);
    };
    rec.onerror = (e) => {
      this.errored = true;
      this.set("error", describeVoiceError(e.error));
    };
    rec.onend = () => {
      this.recognition = null;
      if (this.errored) return;
      const text = this.finalText.trim();
      if (!text) {
        this.set("error", describeVoiceError("no-speech"));
        return;
      }
      this.set("processing");
      this.callbacks.onFinal(text);
      this.set("success");
    };

    this.recognition = rec;
    try {
      rec.start();
    } catch (err) {
      console.error("[JARVIS] voice start", err);
      this.recognition = null;
      this.set("error", describeVoiceError("unknown"));
    }
  }

  stop(): void {
    if (isNativeAndroid()) {
      void import("@capacitor-community/speech-recognition").then(({ SpeechRecognition }) => SpeechRecognition.stop()).catch(() => undefined);
      return;
    }
    this.recognition?.stop();
  }

  cancel(): void {
    if (isNativeAndroid()) {
      this.stop();
      this.set("idle");
      return;
    }
    this.errored = true;
    this.recognition?.abort();
    this.recognition = null;
    this.set("idle");
  }
}

/* ---------------- Resposta falada (TTS) ---------------- */

export function speechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Fala o texto em português. Retorna false se o aparelho não tem síntese de voz. */
export function speak(text: string, handlers: { onStart?: () => void; onEnd?: () => void; onError?: () => void } = {}): boolean {
  if (!speechAvailable()) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.slice(0, 600));
  u.lang = "pt-BR";
  u.onstart = () => handlers.onStart?.();
  u.onend = () => handlers.onEnd?.();
  u.onerror = () => handlers.onError?.();
  window.speechSynthesis.speak(u);
  return true;
}

export function stopSpeaking(): void {
  if (speechAvailable()) window.speechSynthesis.cancel();
}
