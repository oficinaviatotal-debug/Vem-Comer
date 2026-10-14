import { useState, type ChangeEvent, type ReactNode } from "react";
import "./door.css";
import { doorStatuses, fileHint, filterTemplates, photoHint, type DoorStatus } from "./doorLogic";
import { MENU_FILE_ACCEPT, MENU_SHEET_ACCEPT, type ReadyMenuOptions } from "./menuPhotoLogic";

type DoorProps = {
  /** What the server reads of a menu the owner already has. null while it is still being asked. */
  options: ReadyMenuOptions | null;
  /** The browser can listen: only changes the line under "Falar". */
  voiceWorks: boolean;
  /** The photo (camera) was taken: the assistant goes on from there. */
  onPhotos: (files: File[]) => void;
  /** A spreadsheet or PDF was chosen. */
  onFile: (file: File) => void;
  onSpeak: () => void;
  onModels: () => void;
};

/* Icons: one stroke, round ends, 28px. Decorative, so hidden from screen readers. */
const iconProps = {
  width: 30,
  height: 30,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function CameraIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2a1 1 0 0 0 .8-.4l.8-1.2A1 1 0 0 1 10.1 4h3.8a1 1 0 0 1 .8.4l.8 1.2a1 1 0 0 0 .8.4h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
      <circle cx="12" cy="12.5" r="3.4" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg {...iconProps}>
      <path d="M14 3H7.5A1.5 1.5 0 0 0 6 4.5v15A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V7z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg {...iconProps}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg {...iconProps}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.6" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg className="door-chevron" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

type CardProps = {
  kind: "photo" | "file" | "speak" | "model";
  icon: ReactNode;
  title: string;
  hint: string;
  status?: DoorStatus;
  badge?: string;
  children?: ReactNode;
};

/** The look shared by the four doors. Children are the control that makes it tappable (a hidden input or nothing). */
function cardClass(kind: string, status: DoorStatus) {
  return ["door-card", `door-card--${kind}`, status === "ready" ? "" : "is-off"].filter(Boolean).join(" ");
}

function CardBody({ icon, title, hint, badge }: Pick<CardProps, "icon" | "title" | "hint" | "badge">) {
  return (
    <>
      <span className="door-icon">{icon}</span>
      <span className="door-text">
        <strong>{title}</strong>
        <small>{hint}</small>
      </span>
      {badge && <span className="door-badge">{badge}</span>}
      <Chevron />
    </>
  );
}

/** First screen of the menu assistant: four big doors. The camera and the file picker open by the tap itself. */
export default function MenuDoor({ options, voiceWorks, onPhotos, onFile, onSpeak, onModels }: DoorProps) {
  const statuses = doorStatuses(options);

  function takePhotos(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = ""; // choosing the same photo again must still work
    if (chosen.length > 0) onPhotos(chosen);
  }

  function takeFile(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (chosen) onFile(chosen);
  }

  return (
    <section className="door" aria-label="Cadastrar o cardápio">
      <div className="door-hero">
        <div className="door-hero-text">
          <p className="door-kicker">Assistente do cardápio</p>
          <h2>Como você quer cadastrar o seu cardápio?</h2>
          <p className="door-sub">Sem digitar. Escolha um jeito e eu faço o resto.</p>
        </div>
        <img className="door-logo" src="/logo-vem-comer.png" alt="" width={76} height={76} />
      </div>

      <ul className="door-list">
        <li>
          {statuses.photo === "ready" ? (
            <label className={cardClass("photo", "ready")}>
              <CardBody
                icon={<CameraIcon />}
                title="Tirar foto do cardápio"
                hint={photoHint(statuses)}
                badge="Mais rápido"
              />
              <input className="door-input" type="file" accept="image/*" capture="environment" onChange={takePhotos} />
            </label>
          ) : (
            <div className={cardClass("photo", statuses.photo)} aria-disabled="true">
              <CardBody icon={<CameraIcon />} title="Tirar foto do cardápio" hint={photoHint(statuses)} />
            </div>
          )}
        </li>

        <li>
          {statuses.file === "ready" ? (
            <label className={cardClass("file", "ready")}>
              <CardBody icon={<FileIcon />} title="Enviar arquivo" hint={fileHint(statuses)} />
              <input
                className="door-input"
                type="file"
                accept={statuses.pdf ? MENU_FILE_ACCEPT : MENU_SHEET_ACCEPT}
                onChange={takeFile}
              />
            </label>
          ) : (
            <div className={cardClass("file", statuses.file)} aria-disabled="true">
              <CardBody icon={<FileIcon />} title="Enviar arquivo" hint={fileHint(statuses)} />
            </div>
          )}
        </li>

        <li>
          <button type="button" id="assistant-speak-menu" className={cardClass("speak", "ready")} onClick={onSpeak}>
            <CardBody
              icon={<MicIcon />}
              title="Falar o meu cardápio"
              hint={
                voiceWorks
                  ? "Diga os pratos com o preço, do seu jeito. Eu anoto tudo."
                  : "Escreva os pratos com o preço, do seu jeito. Eu anoto tudo."
              }
            />
          </button>
        </li>

        <li>
          <button type="button" id="assistant-pick-model" className={cardClass("model", "ready")} onClick={onModels}>
            <CardBody
              icon={<GridIcon />}
              title="Começar de um modelo"
              hint="Escolha o tipo do seu negócio e toque nos pratos que você vende."
            />
          </button>
        </li>
      </ul>

      <p className="door-foot">Em qualquer jeito, no fim você confere tudo antes de salvar.</p>
    </section>
  );
}

/* ---------------------------------------------------------------- business types */

type TypeTemplate = { id: string; name: string; icon: string };

type GridProps = {
  templates: TypeTemplate[] | null;
  busy: boolean;
  onChoose: (templateId: string) => void;
  onBack: () => void;
};

/** The pastel behind each emoji, going around so neighbours differ. */
const TINTS = ["tint-orange", "tint-green", "tint-sun", "tint-rose"];

/** The business types: a search box and big colored tiles. */
export function TypeGrid({ templates, busy, onChoose, onBack }: GridProps) {
  const [query, setQuery] = useState("");
  const shown = filterTemplates(templates ?? [], query);

  return (
    <section className="door door-types" aria-label="Tipo de negócio">
      <div className="door-types-head">
        <button type="button" className="door-back" onClick={onBack} aria-label="Voltar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h2>O que você vende?</h2>
      </div>

      <label className="door-search">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="tapioca, bolo, pizza…"
          aria-label="Digite o que você vende"
          autoComplete="off"
        />
      </label>

      {templates === null ? (
        <p className="door-empty">Carregando os modelos…</p>
      ) : shown.length === 0 ? (
        <p className="door-empty">
          Não achei “{query.trim()}”. Tente outra palavra, ou volte e fale os pratos do seu jeito.
        </p>
      ) : (
        <div className="door-tiles" role="group" aria-label="Tipo de negócio">
          {shown.map((template, index) => (
            <button
              key={template.id}
              type="button"
              className={`door-tile ${TINTS[index % TINTS.length]}`}
              disabled={busy}
              onClick={() => onChoose(template.id)}
            >
              <span className="door-tile-icon" aria-hidden="true">
                {template.icon}
              </span>
              <span className="door-tile-name">{template.name}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
