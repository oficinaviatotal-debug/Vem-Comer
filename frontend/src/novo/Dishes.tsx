import { useEffect, useRef, type ChangeEvent } from "react";
import "./novo.css";
import NvIcon from "./Icons";
import { Photo, Spinner, TopBar, VoiceOrb } from "./parts";
import {
  DISH_OPTIONS_LABEL,
  DISH_PHOTO_HAS,
  DISH_PHOTO_LABEL,
  DISH_PHOTO_NONE,
  DISH_PHOTO_PICK,
  DISH_PHOTO_REMOVE,
  DISH_PHOTO_TAKE,
  DISHES_NO_PHOTO_CHIP,
  DISH_ADD,
  DISH_ADDING,
  DISH_CANCEL,
  DISH_CLOSE,
  DISH_EDIT_TITLE,
  DISH_FORM_TITLE,
  DISH_MENU_LABEL,
  DISH_NAME_HINT,
  DISH_NAME_LABEL,
  DISH_NO_MENU,
  DISH_PRICE_HINT,
  DISH_PRICE_LABEL,
  DISH_SAVE,
  DISH_SAVING,
  DISH_TEXT_LABEL,
  DISHES_EDITING,
  DISHES_MAKE_MENU,
  DISHES_NEW,
  DISHES_REFRESH,
  DISHES_REMOVE_ARM,
  DISHES_REMOVING,
  DISHES_RESET,
  DISHES_RESETTING,
  DISHES_SEARCH,
  DISHES_SOLD_CHIP,
} from "./copy";
import type { DishForm, DishOptionsLine, DishPhotoView, DishRow, DishesView } from "./types";

/** O que está indo ao servidor agora. Cada prato tem a sua vez; adicionar e voltar tudo seguram a tela inteira. */
export type DishesBusy = {
  /** Pratos cujo esgotou/voltou ainda não chegou ao servidor: só o botão deles espera. */
  toggling: readonly string[];
  removing: string | null;
  resetting: boolean;
  adding: boolean;
};

export const NOT_BUSY: DishesBusy = { toggling: [], removing: null, resetting: false, adding: false };

type FormProps = {
  form: DishForm;
  categories: DishesView["categories"];
  problemText: string;
  adding: boolean;
  onForm?: (patch: Partial<Omit<DishForm, "problem">>) => void;
  onAdd?: () => void;
  onClose?: () => void;
  /** A foto do prato que está sendo mudado; sem isto (prato novo) a parte da foto não aparece. */
  photo?: DishPhotoView | null;
  onPhoto?: (file: File) => void;
  onPhotoRemove?: () => void;
  /** As opções do prato (tamanho, adicionais): o resumo de hoje e o botão que abre a tela delas; sem isto (prato novo) a parte não aparece. */
  options?: DishOptionsLine | null;
  onOptions?: () => void;
};

/** Os botões da foto: tirar na hora, escolher do celular e (se há foto) tirar a foto. O campo de arquivo fica dentro do rótulo, escondido. */
function DishPhotoBox({ photo, onPhoto, onPhotoRemove }: { photo: DishPhotoView; onPhoto?: (file: File) => void; onPhotoRemove?: () => void }) {
  const wait = photo.phase === "working";
  const take = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Limpa o campo: escolher a mesma foto outra vez também funciona.
    event.target.value = "";
    if (file) onPhoto?.(file);
  };
  const said = photo.message || (photo.src ? DISH_PHOTO_HAS : DISH_PHOTO_NONE);
  return (
    <div className="nv-dishform-field nv-dishphoto" role="group" aria-labelledby="nv-dishphoto-label">
      <span className="nv-code-label" id="nv-dishphoto-label">
        {DISH_PHOTO_LABEL}
      </span>
      <div className="nv-dishphoto-row">
        <Photo src={photo.src || undefined} alt="" />
        <div className="nv-dishphoto-acts">
          <label className={`nv-btn nv-filebtn is-green is-block${wait ? " is-off" : ""}`} aria-disabled={wait || undefined}>
            <NvIcon name="camera" />
            {DISH_PHOTO_TAKE}
            <input className="nv-sr" type="file" accept="image/*" capture="environment" disabled={wait} onChange={take} />
          </label>
          <label className={`nv-btn nv-filebtn is-ghost is-block${wait ? " is-off" : ""}`} aria-disabled={wait || undefined}>
            <NvIcon name="image" />
            {DISH_PHOTO_PICK}
            <input className="nv-sr" type="file" accept="image/*" disabled={wait} onChange={take} />
          </label>
          {photo.src ? (
            <button type="button" className="nv-btn is-ghost is-block" disabled={wait} onClick={onPhotoRemove}>
              <NvIcon name="trash" />
              {DISH_PHOTO_REMOVE}
            </button>
          ) : null}
        </div>
      </div>
      <p className={photo.phase === "error" ? "nv-error" : "nv-code-hint"} role={photo.phase === "error" ? "alert" : "status"}>
        {wait ? <Spinner /> : null}
        {said}
      </p>
    </div>
  );
}

/**
 * O prato novo ou o prato que está sendo mudado (`form.editId`; vem preenchido): nome, preço e (se houver) categoria; a
 * descrição é opcional. Ao abrir, o foco vem para o nome e o teclado sobe. Os campos são afundados (escrever); os botões,
 * em relevo (tocar). `adding` vale para os dois: enquanto o servidor não responde, os campos esperam.
 */
export function DishFormBox({ form, categories, problemText, adding, onForm, onAdd, onClose, photo, onPhoto, onPhotoRemove, options, onOptions }: FormProps) {
  const name = useRef<HTMLInputElement>(null);
  useEffect(() => {
    name.current?.focus();
  }, []);
  const bad = (field: DishForm["problem"]) => (form.problem === field ? true : undefined);
  const editing = form.editId !== null;
  return (
    <form
      className="nv-dishform"
      aria-labelledby="nv-dishform-title"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!adding) onAdd?.();
      }}
    >
      <h2 className="nv-dishform-title" id="nv-dishform-title">
        {editing ? DISH_EDIT_TITLE : DISH_FORM_TITLE}
      </h2>

      <div className="nv-dishform-field">
        <label className="nv-code-label" htmlFor="nv-dish-name">
          {DISH_NAME_LABEL}
        </label>
        <div className="nv-field">
          <input
            ref={name}
            id="nv-dish-name"
            maxLength={80}
            autoComplete="off"
            placeholder={DISH_NAME_HINT}
            value={form.name}
            readOnly={adding || undefined}
            aria-invalid={bad("name") ?? bad("twice")}
            aria-describedby={form.problem === "name" || form.problem === "twice" ? "nv-dish-problem" : undefined}
            onChange={(event) => onForm?.({ name: event.target.value })}
          />
        </div>
      </div>

      <div className="nv-dishform-field">
        <label className="nv-code-label" htmlFor="nv-dish-price">
          {DISH_PRICE_LABEL}
        </label>
        <div className="nv-field">
          <input
            id="nv-dish-price"
            inputMode="decimal"
            maxLength={12}
            autoComplete="off"
            placeholder={DISH_PRICE_HINT}
            value={form.price}
            readOnly={adding || undefined}
            aria-invalid={bad("price")}
            aria-describedby={form.problem === "price" ? "nv-dish-problem" : undefined}
            onChange={(event) => onForm?.({ price: event.target.value })}
          />
        </div>
      </div>

      {categories.length > 0 ? (
        <div className="nv-dishform-field">
          <label className="nv-code-label" htmlFor="nv-dish-menu">
            {DISH_MENU_LABEL}
          </label>
          <div className="nv-field is-select">
            <select id="nv-dish-menu" value={form.menuId} disabled={adding} onChange={(event) => onForm?.({ menuId: event.target.value })}>
              <option value="">{DISH_NO_MENU}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <NvIcon name="chevron" />
          </div>
        </div>
      ) : null}

      <div className="nv-dishform-field">
        <label className="nv-code-label" htmlFor="nv-dish-text">
          {DISH_TEXT_LABEL}
        </label>
        <div className="nv-field">
          <input
            id="nv-dish-text"
            maxLength={160}
            autoComplete="off"
            value={form.description}
            readOnly={adding || undefined}
            onChange={(event) => onForm?.({ description: event.target.value })}
          />
        </div>
      </div>

      {editing && photo ? <DishPhotoBox photo={photo} onPhoto={onPhoto} onPhotoRemove={onPhotoRemove} /> : null}

      {editing && options ? (
        <div className="nv-dishform-field nv-dishform-options" role="group" aria-labelledby="nv-dishoptions-label">
          <span className="nv-code-label" id="nv-dishoptions-label">
            {DISH_OPTIONS_LABEL}
          </span>
          <p className="nv-code-hint">{options.summary}</p>
          <button type="button" id="nv-dish-options" className="nv-btn is-ghost is-block" disabled={adding} onClick={onOptions}>
            <NvIcon name="edit" />
            {options.button}
          </button>
        </div>
      ) : null}

      {problemText ? (
        <p className="nv-error" id="nv-dish-problem" role="alert">
          {problemText}
        </p>
      ) : null}

      <button type="submit" className="nv-btn is-green is-block" disabled={adding} aria-busy={adding || undefined}>
        <NvIcon name={editing ? "check" : "plus"} />
        {editing ? (adding ? DISH_SAVING : DISH_SAVE) : adding ? DISH_ADDING : DISH_ADD}
      </button>
      <button type="button" className="nv-btn is-ghost is-block" disabled={adding} onClick={onClose}>
        {editing ? DISH_CANCEL : DISH_CLOSE}
      </button>
    </form>
  );
}

type RowProps = {
  row: DishRow;
  canManage: boolean;
  busy: DishesBusy;
  onToggle?: (id: string) => void;
  onRemove?: (id: string) => void;
  onEdit?: (id: string) => void;
};

/**
 * Um prato: foto, nome, preço e o que ele é (esgotado, com opções). O cartão só informa (sombra macia). Os botões de baixo tocam:
 * Esgotou (ou Voltou, quando já esgotou) e, para quem pode, o lápis (mudar o prato) e a lixeira, que pede um segundo toque.
 * Enquanto o formulário de cima muda este prato, o cartão fica de lado e os botões esperam.
 */
export function DishItem({ row, canManage, busy, onToggle, onRemove, onEdit }: RowProps) {
  const waiting = busy.toggling.includes(row.id);
  const removing = busy.removing === row.id;
  const locked = busy.resetting || busy.removing !== null || busy.adding || row.editing;
  return (
    <li className={`nv-dishcard${row.soldOut ? " is-off" : ""}${row.editing ? " is-editing" : ""}`}>
      <Photo src={row.photo} alt="" />
      <div className="nv-dishcard-text">
        <strong className="nv-dishcard-name">{row.name}</strong>
        <span className="nv-dishcard-price">{row.price}</span>
        {row.soldOut || row.badge || row.noPhoto ? (
          <span className="nv-order-chips">
            {row.soldOut ? <span className="nv-order-chip is-wait">{DISHES_SOLD_CHIP}</span> : null}
            {row.badge ? <span className="nv-order-chip">{row.badge}</span> : null}
            {row.noPhoto ? <span className="nv-order-chip">{DISHES_NO_PHOTO_CHIP}</span> : null}
          </span>
        ) : null}
      </div>

      <div className="nv-dishcard-acts">
        <button
          type="button"
          className={`nv-btn ${row.soldOut ? "is-green" : "is-ghost"}`}
          aria-label={row.toggleSpoken}
          disabled={waiting || locked}
          aria-busy={waiting || undefined}
          onClick={() => onToggle?.(row.id)}
        >
          <NvIcon name={row.soldOut ? "check" : "close"} />
          {row.toggle}
        </button>
        {canManage ? (
          <button
            type="button"
            id={`nv-dish-edit-${row.id}`}
            className="nv-icon-btn"
            aria-label={`Mudar ${row.name}`}
            disabled={locked || waiting}
            onClick={() => onEdit?.(row.id)}
          >
            <NvIcon name="edit" />
          </button>
        ) : null}
        {canManage ? (
          <button
            type="button"
            className={`nv-icon-btn is-danger${row.armed ? " is-armed" : ""}`}
            aria-label={removing ? `${DISHES_REMOVING} ${row.name}` : row.armed ? `${DISHES_REMOVE_ARM}: ${row.name}` : `Remover ${row.name}`}
            disabled={removing || locked || waiting}
            aria-busy={removing || undefined}
            onClick={() => onRemove?.(row.id)}
          >
            <NvIcon name="trash" />
          </button>
        ) : null}
      </div>
      {row.armed || removing ? <p className="nv-dishcard-arm">{removing ? DISHES_REMOVING : DISHES_REMOVE_ARM}</p> : null}
      {row.editing ? <p className="nv-dishcard-note">{DISHES_EDITING}</p> : null}
    </li>
  );
}

type Props = {
  view: DishesView;
  /** O que está escrito na busca. */
  query?: string;
  /** O formulário do prato novo, ou null quando está fechado. */
  form?: DishForm | null;
  /** A frase do problema do formulário (nome vazio, preço que não entendi, prato repetido). */
  problemText?: string;
  busy?: DishesBusy;
  onQuery?: (query: string) => void;
  onToggle?: (id: string) => void;
  onRemove?: (id: string) => void;
  onReset?: () => void;
  onOpenForm?: () => void;
  /** O lápis de um prato: abre o formulário de cima preenchido. */
  onEdit?: (id: string) => void;
  onForm?: (patch: Partial<Omit<DishForm, "problem">>) => void;
  /** Adicionar (prato novo) ou Salvar (prato que está sendo mudado): o mesmo botão do formulário. */
  onAdd?: () => void;
  onCloseForm?: () => void;
  /** A foto do prato aberto no lápis: o que está acontecendo com ela, e as duas ações (mandar uma foto, tirar a foto). */
  photo?: DishPhotoView | null;
  onPhoto?: (file: File) => void;
  onPhotoRemove?: () => void;
  /** As opções do prato aberto no lápis: o resumo e o botão que leva à tela das opções. */
  options?: DishOptionsLine | null;
  onOptions?: () => void;
  /** Leva ao montar o cardápio por foto, arquivo ou voz. Sem isto o botão não aparece. */
  onMake?: () => void;
  onRefresh?: () => void;
  /** O menu do painel. Sem ele (e sem `showMenu`) o botão não aparece. */
  onMenu?: () => void;
  showMenu?: boolean;
};

/**
 * Pratos: o cardápio do ponto de vista de quem cuida dele. Esgotou e Voltou valem na hora (a cozinha usa o dia inteiro);
 * criar, mudar (o lápis) e remover são de dono e gerente. Criar e mudar usam o mesmo formulário, no alto da tela.
 */
export default function Dishes({
  view,
  query = "",
  form = null,
  problemText = "",
  busy = NOT_BUSY,
  onQuery,
  onToggle,
  onRemove,
  onReset,
  onOpenForm,
  onEdit,
  onForm,
  onAdd,
  onCloseForm,
  photo = null,
  onPhoto,
  onPhotoRemove,
  options = null,
  onOptions,
  onMake,
  onRefresh,
  onMenu,
  showMenu = false,
}: Props) {
  const anyBusy = busy.adding || busy.resetting || busy.removing !== null;
  return (
    <div className="nv-root">
      <main className="nv-screen nv-page-dishes">
        <TopBar title={view.title} sub={view.sub} onMenu={onMenu} showMenu={showMenu} />
        {/* Sempre na página: o leitor de tela só avisa o que muda dentro de uma região que já existia. */}
        <p className="nv-sr" id="nv-dishes-live" role="status" aria-live="polite" tabIndex={-1}>
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

        {view.canManage && !view.loading ? (
          form ? (
            <DishFormBox
              key={form.editId ?? "novo"}
              form={form}
              categories={view.categories}
              problemText={problemText}
              adding={busy.adding}
              onForm={onForm}
              onAdd={onAdd}
              onClose={onCloseForm}
              photo={photo}
              onPhoto={onPhoto}
              onPhotoRemove={onPhotoRemove}
              options={options}
              onOptions={onOptions}
            />
          ) : (
            <button type="button" id="nv-dishes-new" className="nv-btn is-green is-block" onClick={onOpenForm}>
              <NvIcon name="plus" />
              {DISHES_NEW}
            </button>
          )
        ) : null}

        {view.hint && !form ? <p className="nv-code-hint nv-dishes-hint">{view.hint}</p> : null}

        {view.alert ? (
          <div className="nv-soldbar">
            <p>{view.alert}</p>
            <button type="button" className="nv-btn is-green is-small" disabled={anyBusy} aria-busy={busy.resetting || undefined} onClick={onReset}>
              {busy.resetting ? DISHES_RESETTING : DISHES_RESET}
            </button>
          </div>
        ) : null}

        {view.showSearch ? (
          <label className="nv-search">
            <NvIcon name="search" />
            <input
              type="search"
              className="nv-search-input"
              placeholder={DISHES_SEARCH}
              aria-label={DISHES_SEARCH}
              value={query}
              onChange={(event) => onQuery?.(event.target.value)}
            />
          </label>
        ) : null}

        {view.empty ? <p className="nv-empty">{view.empty}</p> : null}
        {view.empty && view.canManage && onMake && view.lists.length === 0 && query.trim() === "" ? (
          <button type="button" className="nv-btn is-ghost is-block" onClick={onMake}>
            <NvIcon name="camera" />
            {DISHES_MAKE_MENU}
          </button>
        ) : null}

        {view.lists.map((list) => (
          <section key={list.key} className="nv-dishlist" aria-labelledby={list.title ? `nv-dishlist-${list.key}` : undefined} aria-label={list.title ? undefined : view.title}>
            {list.title ? (
              <h2 className="nv-dishlist-head" id={`nv-dishlist-${list.key}`}>
                {list.title}
                <span>{list.count}</span>
              </h2>
            ) : null}
            {list.sections.map((section) => (
              <div key={section.title || "-"} className="nv-dishsection">
                {section.title ? <h3 className="nv-dishsection-head">{section.title}</h3> : null}
                <ul className="nv-dishcards">
                  {section.rows.map((row) => (
                    <DishItem key={row.id} row={row} canManage={view.canManage} busy={busy} onToggle={onToggle} onRemove={onRemove} onEdit={onEdit} />
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))}

        <button type="button" className="nv-btn is-ghost is-block" disabled={anyBusy} onClick={onRefresh}>
          {DISHES_REFRESH}
        </button>
      </main>

      <div className="nv-dock is-float">
        <VoiceOrb label="Falar com o Vem" />
      </div>
    </div>
  );
}
