import { useEffect, useRef, useState } from "react";
import { interpretVoiceCommand } from "./voiceCommand";

type Props = {
  onCommand?: (command: ReturnType<typeof interpretVoiceCommand>) => void;
};

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
  onresult: ((event: any) => void) | null;
};

export default function VoiceCommandButton({ onCommand }: Props) {
  const recognitionRef = useRef<Recognition | null>(null);
  const onCommandRef = useRef(onCommand);

  useEffect(() => {
    onCommandRef.current = onCommand;
  }, []);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [transcript, setTranscript] = useState("");

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition: Recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript || "";
      setTranscript(text);
      const command = interpretVoiceCommand(text);
      onCommandRef.current?.(command);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [onCommand]);

  if (!supported) return null;

  return (
    <div className="voice-command">
      <button
        type="button"
        className={listening ? "voice-command-button listening" : "voice-command-button"}
        onClick={() => {
          if (listening) recognitionRef.current?.stop();
          else recognitionRef.current?.start();
        }}
        aria-label={listening ? "Parar comando de voz" : "Comandar por voz"}
        title={listening ? "Ouvindo..." : "Comandar por voz"}
      >
        {listening ? "■" : "🎙️"}
      </button>
      {transcript && <span className="voice-command-text">{transcript}</span>}
    </div>
  );
}
