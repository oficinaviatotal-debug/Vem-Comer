import "./novo.css";
import { VOICE_BUBBLE_LABEL, VOICE_CLOSE, VOICE_HEARD } from "./copy";

export type VoiceBubbleTone = "listening" | "answer" | "warn";

/** Um botão da pergunta ("Sim" / "Não"). O nome do botão não varia: quem aprendeu onde tocar não pode ter o botão trocado. */
export type VoiceAction = { label: string; primary?: boolean; onPress: () => void };

type Props = {
  tone: VoiceBubbleTone;
  /** O que o painel responde: o que está fazendo, o que não entendeu ou o que fazer. */
  text: string;
  /** O que o celular ouviu da pessoa, quando ouviu. Mostrar o que foi ouvido deixa claro se o erro foi do celular. */
  heard?: string;
  /** Fechar a resposta antes de ela sumir sozinha. Sem isto não há botão. */
  onClose?: () => void;
  /** Os botões de uma pergunta ("Marcar como esgotado?" Sim / Não). Com eles a faixa não tem o Fechar: o "Não" já fecha. */
  actions?: readonly VoiceAction[];
};

/**
 * A resposta da bolinha de voz: uma faixa curta acima dela com o que o celular ouviu e o que o painel vai fazer. Quem
 * não lê bem ouve a mesma frase em voz alta; quem não pode ouvir lê aqui. Some sozinha (o painel decide quando).
 */
export default function VoiceBubble({ tone, text, heard = "", onClose, actions = [] }: Props) {
  const said = heard.trim();
  const asking = actions.length > 0;
  return (
    <div className="nv-root nv-voice" role="status" aria-live="polite" aria-label={VOICE_BUBBLE_LABEL}>
      <div className={`nv-voice-bubble is-${tone}`}>
        <div className="nv-voice-text">
          {said ? <p className="nv-voice-heard">{VOICE_HEARD(said)}</p> : null}
          <p className="nv-voice-say">{text}</p>
          {asking ? (
            <div className="nv-voice-actions">
              {actions.map((action) => (
                <button key={action.label} type="button" className={`nv-voice-act${action.primary ? " is-primary" : ""}`} onClick={action.onPress}>
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {onClose && !asking ? (
          <button type="button" className="nv-voice-close" onClick={onClose}>
            {VOICE_CLOSE}
          </button>
        ) : null}
      </div>
    </div>
  );
}
