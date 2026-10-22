import { useEffect, useRef } from "react";
import "./novo.css";
import NvIcon from "./Icons";
import { TopBar, VoiceOrb } from "./parts";
import {
  CATS_ADD,
  CATS_ADDING,
  CATS_HELP,
  CATS_NAME_HINT,
  CATS_NAME_LABEL,
  CATS_TITLE,
  DISHES_REMOVE_ARM,
  DISHES_REMOVING,
} from "./copy";
import type { CategoriesView } from "./types";

/** O que está indo ao servidor agora: adicionar segura o formulário; remover segura só a categoria tocada. */
export type CategoriesBusy = { adding: boolean; removing: string | null };

export const CATS_NOT_BUSY: CategoriesBusy = { adding: false, removing: null };

type Props = {
  view: CategoriesView;
  /** O que está escrito no campo do nome. */
  name?: string;
  /** A frase do problema do campo (vazio, repetido), ou "". */
  problemText?: string;
  busy?: CategoriesBusy;
  onName?: (name: string) => void;
  onAdd?: () => void;
  onRemove?: (id: string) => void;
  onRefresh?: () => void;
  /** O menu do painel. Sem ele (e sem `showMenu`) o botão não aparece. */
  onMenu?: () => void;
  showMenu?: boolean;
};

/**
 * Categorias: as seções do cardápio (Lanches, Bebidas…). Criar leva um nome; remover pede dois toques e não apaga os pratos
 * dela (o servidor os deixa sem categoria). A tela diz quantos pratos cada uma tem para ninguém remover sem saber.
 */
export default function Categories({ view, name = "", problemText = "", busy = CATS_NOT_BUSY, onName, onAdd, onRemove, onRefresh, onMenu, showMenu = false }: Props) {
  const field = useRef<HTMLInputElement>(null);
  const locked = busy.adding || busy.removing !== null;
  useEffect(() => {
    if (problemText) field.current?.focus();
  }, [problemText]);
  return (
    <div className="nv-root">
      <main className="nv-screen nv-page-dishes nv-page-cats">
        <TopBar title={CATS_TITLE} sub={view.sub} onMenu={onMenu} showMenu={showMenu} />
        <p className="nv-sr" id="nv-cats-live" role="status" aria-live="polite" tabIndex={-1}>
          {view.live}
        </p>

        {view.notice ? (
          <p className="nv-ok" aria-hidden="true">
            {view.notice}
          </p>
        ) : null}
        {view.error ? (
          <p className="nv-error" role="alert">
            {view.error}
          </p>
        ) : null}

        {!view.loading ? (
          <form
            className="nv-dishform"
            noValidate
            aria-label={CATS_ADD}
            onSubmit={(event) => {
              event.preventDefault();
              if (!locked) onAdd?.();
            }}
          >
            <div className="nv-dishform-field">
              <label className="nv-code-label" htmlFor="nv-cat-name">
                {CATS_NAME_LABEL}
              </label>
              <div className="nv-field">
                <input
                  ref={field}
                  id="nv-cat-name"
                  maxLength={60}
                  autoComplete="off"
                  placeholder={CATS_NAME_HINT}
                  value={name}
                  aria-invalid={problemText ? true : undefined}
                  aria-describedby={problemText ? "nv-cat-problem" : undefined}
                  onChange={(event) => onName?.(event.target.value)}
                />
              </div>
            </div>
            {problemText ? (
              <p className="nv-error" id="nv-cat-problem" role="alert">
                {problemText}
              </p>
            ) : null}
            <button type="submit" className="nv-btn is-green is-block" disabled={locked} aria-busy={busy.adding || undefined}>
              <NvIcon name="plus" />
              {busy.adding ? CATS_ADDING : CATS_ADD}
            </button>
          </form>
        ) : null}

        {view.empty ? <p className="nv-empty">{view.empty}</p> : view.rows.length > 0 ? <p className="nv-code-hint">{CATS_HELP}</p> : null}

        <ul className="nv-dishcards">
          {view.rows.map((row) => {
            const removing = busy.removing === row.id;
            return (
              <li key={row.id} className="nv-dishcard is-cat">
                <div className="nv-dishcard-main">
                  <div className="nv-dishcard-text">
                    <strong className="nv-dishcard-name">{row.name}</strong>
                    <span className="nv-dishcard-desc">{row.count}</span>
                  </div>
                  <button
                    type="button"
                    className={`nv-icon-btn is-danger${row.armed ? " is-armed" : ""}`}
                    aria-label={removing ? `${DISHES_REMOVING} ${row.name}` : row.armed ? `${DISHES_REMOVE_ARM}: ${row.name}` : `Remover ${row.name}`}
                    disabled={locked}
                    aria-busy={removing || undefined}
                    onClick={() => onRemove?.(row.id)}
                  >
                    <NvIcon name="trash" />
                  </button>
                </div>
                {row.armed || removing ? <p className="nv-dishcard-arm">{removing ? DISHES_REMOVING : DISHES_REMOVE_ARM}</p> : null}
              </li>
            );
          })}
        </ul>

        <button type="button" className="nv-btn is-ghost is-block" disabled={locked} onClick={onRefresh}>
          Atualizar a lista
        </button>
      </main>

      <div className="nv-dock is-float">
        <VoiceOrb label="Falar com o Vem" />
      </div>
    </div>
  );
}
