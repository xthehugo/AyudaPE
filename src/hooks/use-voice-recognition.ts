import { useCallback, useEffect, useRef, useState } from 'react';

export interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

export interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

export interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort?(): void;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

export interface VoiceRecognitionState {
  isListening: boolean;
  transcript: string;
  hasSupport: boolean;
  error: string | null;
  statusMessage: string;
}

export interface UseVoiceRecognitionReturn extends VoiceRecognitionState {
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

/**
 * Traduce códigos de error técnicos de Web Speech API a mensajes empáticos y claros
 * pensados para adultos mayores en situación de estrés o emergencia.
 */
export function mapSpeechErrorToFriendlyMessage(errorCode: string): string {
  switch (errorCode) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Permiso de micrófono denegado. Por favor, autoriza el micrófono o escribe tu mensaje.';
    case 'no-speech':
      return 'No se escuchó ninguna voz. Toca el botón del micrófono e intenta hablar más cerca.';
    case 'audio-capture':
      return 'No se detectó un micrófono disponible en tu teléfono o computadora.';
    case 'network':
      return 'El dictado en la nube no tiene red. Puedes escribir tu solicitud directamente.';
    default:
      return 'Ocurrió un inconveniente con el micrófono. Puedes escribir tu solicitud con normalidad.';
  }
}

/**
 * Obtiene el constructor `SpeechRecognition` o `webkitSpeechRecognition` del entorno global.
 */
export function resolveSpeechRecognitionConstructor(
  globalScope: Record<string, unknown> | undefined = typeof window !== 'undefined'
    ? (window as unknown as Record<string, unknown>)
    : undefined
): SpeechRecognitionConstructor | null {
  if (!globalScope) return null;
  const ctor =
    (globalScope.SpeechRecognition as SpeechRecognitionConstructor | undefined) ??
    (globalScope.webkitSpeechRecognition as SpeechRecognitionConstructor | undefined);
  return typeof ctor === 'function' ? ctor : null;
}

/**
 * Hook React `useVoiceRecognition` (MOD-09):
 * Configurado en español peruano (`es-PE`) con retroalimentación accesible para adultos mayores.
 */
export function useVoiceRecognition(
  customCtor?: SpeechRecognitionConstructor | null
): UseVoiceRecognitionReturn {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>(
    'Presiona el micrófono para dictar tu aviso con tu voz'
  );

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const ctor = customCtor !== undefined ? customCtor : resolveSpeechRecognitionConstructor();
  const hasSupport = Boolean(ctor);

  useEffect(() => {
    if (!ctor) {
      setStatusMessage(
        'Tu navegador no soporta dictado por voz. Usa el teclado en pantalla.'
      );
      return;
    }

    const instance = new ctor();
    instance.lang = 'es-PE';
    instance.continuous = false;
    instance.interimResults = true;
    instance.maxAlternatives = 1;

    instance.onstart = () => {
      setIsListening(true);
      setError(null);
      setStatusMessage('Escuchando tu voz (es-PE)... Habla con tranquilidad.');
    };

    instance.onresult = (event: SpeechRecognitionEventLike) => {
      let combined = '';
      for (let i = 0; i < event.results.length; i += 1) {
        const res = event.results[i];
        const alt = res?.[0];
        if (alt?.transcript) {
          combined += `${alt.transcript} `;
        }
      }
      const cleaned = combined.trim();
      if (cleaned.length > 0) {
        setTranscript(cleaned);
        setStatusMessage('Texto capturado correctamente desde tu voz.');
      }
    };

    instance.onerror = (event: SpeechRecognitionErrorEventLike) => {
      const friendly = mapSpeechErrorToFriendlyMessage(event.error);
      setError(friendly);
      setIsListening(false);
      setStatusMessage(friendly);
    };

    instance.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = instance;

    return () => {
      try {
        instance.abort?.();
      } catch {
        // Ignorar errores al desmontar
      }
    };
  }, [ctor]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      const msg = 'Tu navegador no soporta dictado por voz. Usa el teclado en pantalla.';
      setError(msg);
      setStatusMessage(msg);
      return;
    }

    try {
      setError(null);
      recognitionRef.current.start();
    } catch {
      // Si ya estaba iniciado, reiniciar limpiamente
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignorar
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
      setIsListening(false);
      setStatusMessage('Dictado finalizado. Revisa tu mensaje antes de publicar.');
    } catch {
      setIsListening(false);
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setError(null);
    setStatusMessage('Presiona el micrófono para dictar tu aviso con tu voz');
  }, []);

  return {
    isListening,
    transcript,
    hasSupport,
    error,
    statusMessage,
    startListening,
    stopListening,
    resetTranscript,
  };
}
