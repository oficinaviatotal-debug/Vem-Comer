import { useState } from "react";
import NvIcon, { type NvIconName } from "./Icons";
import { TopBar, VoiceOrb } from "./parts";
import type { Job } from "./types";

type Props = {
  jobs: Job[];
  city: string;
  /** "seek": procuro trabalho; "hire": tenho vagas. */
  onTab?: (id: "seek" | "hire") => void;
  onSearch?: (what: string, where: string) => void;
  onShortcut?: (id: string) => void;
  onAllJobs?: () => void;
  /** Toque em qualquer lugar do cartão da vaga. */
  onJob?: (id: string) => void;
  /** Toque no balãozinho do Vem Comer. */
  onFood?: () => void;
  /** O menu do painel. Sem ele (e sem `showMenu`) o botão não aparece. */
  onMenu?: () => void;
  showMenu?: boolean;
};

const SHORTCUTS: { id: string; label: string; icon: NvIconName }[] = [
  { id: "vagas", label: "Vagas", icon: "briefcase" },
  { id: "cursos", label: "Cursos", icon: "book" },
  { id: "curriculo", label: "Currículo", icon: "doc" },
  { id: "perfil", label: "Perfil", icon: "user" },
];

/**
 * A porta do Vem Trabalhar para quem procura trabalho: a mesma casa do Vem Comer, em azul.
 * Quem não sabe escrever fala o currículo na bolinha de voz. O balãozinho de comida é pequeno e fecha com um toque.
 */
export default function JobsHome({ jobs, city, onTab, onSearch, onShortcut, onAllJobs, onJob, onFood, onMenu, showMenu = false }: Props) {
  const [crossOpen, setCrossOpen] = useState(true);
  const [what, setWhat] = useState("");
  const [where, setWhere] = useState(city);

  return (
    <div className="nv-root nv-work">
      <main className="nv-screen" style={crossOpen ? { paddingBottom: 188 } : undefined}>
        <TopBar title="Vem Trabalhar" sub="O seu próximo passo começa aqui" onMenu={onMenu} showMenu={showMenu} />

        <div className="nv-tabs is-two" role="tablist" aria-label="Quem é você">
          <button type="button" role="tab" aria-selected="true" className="nv-tab is-on" onClick={() => onTab?.("seek")}>
            Procuro trabalho
          </button>
          <button type="button" role="tab" aria-selected="false" className="nv-tab" onClick={() => onTab?.("hire")}>
            Tenho vagas
          </button>
        </div>

        <h2 className="nv-hello">Vagas que combinam com você</h2>

        <form
          className="nv-find"
          aria-label="Buscar vagas"
          onSubmit={(event) => {
            event.preventDefault();
            onSearch?.(what.trim(), where.trim());
          }}
        >
          <label className="nv-field">
            <NvIcon name="search" />
            <input
              type="search"
              placeholder="Cargo ou palavra-chave"
              aria-label="Cargo ou palavra-chave"
              enterKeyHint="search"
              value={what}
              onChange={(event) => setWhat(event.target.value)}
            />
          </label>
          <label className="nv-field">
            <NvIcon name="pin" />
            <input
              type="text"
              placeholder="Cidade"
              aria-label="Cidade"
              enterKeyHint="search"
              value={where}
              onChange={(event) => setWhere(event.target.value)}
            />
          </label>
          <button type="submit" className="nv-btn is-fire is-block">
            Buscar vagas
          </button>
        </form>

        <nav className="nv-cats" aria-label="Atalhos">
          {SHORTCUTS.map((item) => (
            <button key={item.id} type="button" className="nv-cat" onClick={() => onShortcut?.(item.id)}>
              <span className="nv-cat-tile" aria-hidden="true">
                <NvIcon name={item.icon} />
              </span>
              {item.label}
            </button>
          ))}
        </nav>

        <section aria-labelledby="nv-jobs-h">
          <div className="nv-h2-row">
            <h2 className="nv-h2" id="nv-jobs-h">
              Vagas perto de você
            </h2>
            <button type="button" className="nv-link" onClick={onAllJobs}>
              Ver todas
            </button>
          </div>
          <ul className="nv-jobs" style={{ marginTop: 14 }}>
            {jobs.map((job) => (
              <li key={job.id} className="nv-job">
                <span className="nv-job-badge" aria-hidden="true">
                  {job.company.slice(0, 1)}
                </span>
                <h3>{job.title}</h3>
                <p className="nv-job-company">{job.company}</p>
                <div className="nv-job-chips">
                  <span>
                    <NvIcon name="pin" /> {job.city}
                  </span>
                  <span>{job.mode}</span>
                  <span>{job.contract}</span>
                </div>
                <div className="nv-job-foot">
                  <span>{job.ago}</span>
                  {/* nv-hit: o cartão inteiro da vaga abre os detalhes. */}
                  <button
                    type="button"
                    className="nv-btn is-fire nv-hit"
                    aria-label={`Ver detalhes da vaga ${job.title}, ${job.company}`}
                    onClick={() => onJob?.(job.id)}
                  >
                    Ver detalhes
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>

      {crossOpen ? (
        <nav className="nv-cross" aria-label="Outro caminho">
          <span className="nv-cross-bubble is-food">
            <NvIcon name="fork" />
            <button type="button" className="nv-cross-link nv-hit" onClick={onFood}>
              Está com fome? Toque aqui
            </button>
            <button type="button" className="nv-cross-close" aria-label="Fechar o aviso" onClick={() => setCrossOpen(false)}>
              <NvIcon name="close" />
            </button>
          </span>
        </nav>
      ) : null}

      <div className="nv-dock is-float">
        <VoiceOrb label="Falar o meu currículo" />
      </div>
    </div>
  );
}
