import { useEffect, useRef, useState } from "react";
import {
  deleteIngredient,
  fetchCosts,
  saveCostTarget,
  saveIngredient,
  saveRecipe,
  saveStock,
  type CostIngredient,
  type CostProduct,
  type CostView,
} from "../service/api";
import ConfirmButton from "../service/ConfirmButton";
import { canListen, hear, type Hearing } from "../assistant/voiceIO";
import {
  PACKAGE_UNITS,
  cmvOf,
  draftCost,
  draftLineCost,
  draftRecipeCost,
  formatMoneyPlain,
  formatPercent,
  ingredientFormProblem,
  isInputUnit,
  packageLabel,
  parseDecimal,
  parsePortions,
  parseYieldPct,
  periodSentence,
  portionsSentences,
  productSentence,
  profitSentence,
  quadrantAction,
  quadrantChip,
  quadrantLabel,
  recipePayload,
  recipeProblem,
  sortByProfit,
  sortForAttention,
  statusChip,
  statusLabel,
  stockSentence,
  toBase,
  toInput,
  unitsFor,
  type BaseUnit,
  type IngredientForm,
  type InputUnit,
  type RecipeDraftLine,
} from "./costLogic";
import { mergeSpokenLines, parseRecipeSpeech } from "./recipeSpeech";
import "./costs.css";
import FeedbackAsk from "../feedback/FeedbackAsk";

type Props = {
  companyId: string;
};

type RecipeDraft = {
  productId: string;
  portion: string;
  portions: string;
  grams: string;
  extra: string;
  lines: RecipeDraftLine[];
};

type StockDraft = {
  ingredientId: string;
  mode: "contagem" | "compra";
  quantity: string;
  unit: InputUnit;
};

const EMPTY_INGREDIENT: IngredientForm = { name: "", quantity: "", unit: "kg", price: "", yieldPct: "100" };

function defaultUnit(base: BaseUnit): InputUnit {
  return base === "un" ? "un" : base;
}

function moneyText(value: number): string {
  return value ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) : "";
}

function numberText(value: number | null): string {
  return value ? new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value).replace(/\./g, "") : "";
}

/**
 * "Custos" tab: what each dish costs (recipe card for N portions, said by voice or typed),
 * its CMV against the owner's target, the ingredients and their stock, and which dishes
 * bring the most profit with the action that fits each one. Owner and manager only.
 */
export default function CostsPanel({ companyId }: Props) {
  const [view, setView] = useState<CostView | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [notice, setNotice] = useState("");
  /** A recipe was saved in this visit: the "Como foi?" shows up under the notice. */
  const [recipeSaved, setRecipeSaved] = useState(false);

  const [target, setTarget] = useState("");
  const [targetError, setTargetError] = useState("");

  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [recipeError, setRecipeError] = useState("");
  const [savingRecipe, setSavingRecipe] = useState(false);

  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [heardNotes, setHeardNotes] = useState<string[]>([]);
  const hearing = useRef<Hearing | null>(null);

  const [ingredient, setIngredient] = useState<IngredientForm>(EMPTY_INGREDIENT);
  const [editingIngredient, setEditingIngredient] = useState<CostIngredient | null>(null);
  const [ingredientError, setIngredientError] = useState("");
  const [savingIngredient, setSavingIngredient] = useState(false);

  const [stock, setStock] = useState<StockDraft | null>(null);
  const [stockError, setStockError] = useState("");

  async function reload() {
    try {
      const next = await fetchCosts(companyId);
      setView(next);
      setTarget(String(next.target));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }

  useEffect(() => {
    setView(null);
    setDraft(null);
    void reload();
    return () => hearing.current?.cancel();
    // reload only depends on the restaurant
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  if (loadFailed && !view) {
    return (
      <p className="adm-status" role="alert">
        Não foi possível abrir os custos. Confira a internet e tente de novo.
      </p>
    );
  }

  if (!view) {
    return <p className="adm-status">Carregando…</p>;
  }

  const costView = view;
  const byId = new Map<string, CostIngredient>(
    costView.ingredients.map((item): [string, CostIngredient] => [item.id, item]),
  );
  const products = sortForAttention(costView.products);
  const ranking = sortByProfit(costView.products.filter((product) => product.price > 0));

  async function submitTarget() {
    setTargetError("");
    setNotice("");
    const value = parseDecimal(target);
    if (value === null || !Number.isInteger(value) || value < 5 || value > 90) {
      setTargetError("Escolha uma meta entre 5% e 90%, sem vírgula. Ex.: 35.");
      return;
    }
    try {
      await saveCostTarget(companyId, value);
      setNotice(`Meta de CMV salva: ${value}%.`);
      await reload();
    } catch (err) {
      setTargetError(err instanceof Error ? err.message : "Não consegui salvar a meta.");
    }
  }

  function startRecipe(product: CostProduct) {
    setRecipeError("");
    setNotice("");
    setHeard("");
    setHeardNotes([]);
    setDraft({
      productId: product.id,
      portion: product.portion ?? "",
      portions: String(product.yield_portions || 1),
      grams: numberText(product.portion_grams),
      extra: moneyText(product.extra_cost),
      lines: product.recipe.map((line) => ({ ingredientId: line.ingredient_id, ...toInput(line.quantity, line.unit) })),
    });
  }

  function closeRecipe() {
    hearing.current?.cancel();
    setListening(false);
    setDraft(null);
  }

  function changeLine(index: number, patch: Partial<RecipeDraftLine>) {
    setDraft((current) => {
      if (!current) return current;
      const lines = current.lines.map((line, i) => (i === index ? { ...line, ...patch } : line));
      return { ...current, lines };
    });
  }

  function addLine() {
    setDraft((current) => {
      if (!current) return current;
      const first = costView.ingredients.find((item) => !current.lines.some((line) => line.ingredientId === item.id));
      const lines = [
        ...current.lines,
        { ingredientId: first?.id ?? "", quantity: "", unit: first ? defaultUnit(first.unit) : "g" },
      ];
      return { ...current, lines };
    });
  }

  function removeLine(index: number) {
    setDraft((current) => (current ? { ...current, lines: current.lines.filter((_, i) => i !== index) } : current));
  }

  async function speakRecipe() {
    if (!draft) return;
    if (listening) {
      hearing.current?.cancel();
      setListening(false);
      return;
    }
    setRecipeError("");
    setHeard("");
    setHeardNotes([]);
    setListening(true);
    const session = hear({ onPartial: (text) => setHeard(text), timeoutMs: 30000 });
    hearing.current = session;
    const text = await session.result;
    hearing.current = null;
    setListening(false);
    if (!text) {
      setHeardNotes(["Não ouvi nada. Toque em Falar a ficha e fale de novo, perto do celular."]);
      return;
    }
    setHeard(text);
    const spoken = parseRecipeSpeech(
      text,
      costView.ingredients.map((item) => ({ id: item.id, name: item.name, unit: item.unit })),
    );
    setDraft((current) =>
      current
        ? {
            ...current,
            lines: mergeSpokenLines(current.lines, spoken.lines),
            portions: spoken.yieldPortions ? String(spoken.yieldPortions) : current.portions,
            grams: spoken.portionGrams ? numberText(spoken.portionGrams) : current.grams,
          }
        : current,
    );
    const notes = [...spoken.unknown];
    if (spoken.lines.length > 0) notes.unshift(`Entendi ${spoken.lines.length} ${spoken.lines.length === 1 ? "insumo" : "insumos"}. Confira abaixo e toque em Salvar ficha.`);
    if (spoken.lines.length === 0 && notes.length === 0) {
      notes.push("Não entendi os insumos. Fale assim: 1,2 quilo de peito de frango, 4 ovos, rende 6 porções.");
    }
    setHeardNotes(notes);
  }

  async function submitRecipe(product: CostProduct) {
    if (!draft) return;
    setRecipeError("");
    const problem = recipeProblem(draft.lines, draft.extra, draft.portions, draft.grams);
    if (problem) {
      setRecipeError(problem);
      return;
    }
    setSavingRecipe(true);
    try {
      await saveRecipe(
        companyId,
        product.id,
        recipePayload(draft.portion, draft.extra, draft.lines, draft.portions, draft.grams),
      );
      closeRecipe();
      setNotice(`Ficha de ${product.name} salva.`);
      setRecipeSaved(true);
      await reload();
    } catch (err) {
      setRecipeError(err instanceof Error ? err.message : "Não consegui salvar a ficha do prato.");
    } finally {
      setSavingRecipe(false);
    }
  }

  function startIngredientEdit(item: CostIngredient) {
    setIngredientError("");
    setNotice("");
    setEditingIngredient(item);
    const input = toInput(item.package_qty, item.unit);
    setIngredient({
      name: item.name,
      quantity: input.quantity,
      unit: input.unit,
      price: moneyText(item.package_price) || "0",
      yieldPct: String(item.yield_pct || 100),
    });
  }

  function cancelIngredientEdit() {
    setEditingIngredient(null);
    setIngredient(EMPTY_INGREDIENT);
    setIngredientError("");
  }

  async function submitIngredient() {
    setIngredientError("");
    setNotice("");
    const problem = ingredientFormProblem(ingredient);
    if (problem) {
      setIngredientError(problem);
      return;
    }
    setSavingIngredient(true);
    try {
      await saveIngredient(
        companyId,
        {
          name: ingredient.name.trim(),
          quantity: parseDecimal(ingredient.quantity) ?? 0,
          unit: ingredient.unit,
          price: parseDecimal(ingredient.price) ?? 0,
          yield_pct: parseYieldPct(ingredient.yieldPct) ?? 100,
        },
        editingIngredient?.id,
      );
      setNotice(editingIngredient ? `${ingredient.name.trim()} atualizado. Os custos dos pratos já mudaram.` : `${ingredient.name.trim()} salvo.`);
      setEditingIngredient(null);
      setIngredient(EMPTY_INGREDIENT);
      await reload();
    } catch (err) {
      setIngredientError(err instanceof Error ? err.message : "Não consegui salvar o insumo.");
    } finally {
      setSavingIngredient(false);
    }
  }

  async function removeIngredient(item: CostIngredient) {
    setNotice("");
    try {
      await deleteIngredient(companyId, item.id);
      if (editingIngredient?.id === item.id) cancelIngredientEdit();
      setNotice(`${item.name} removido.`);
      await reload();
    } catch (err) {
      setIngredientError(err instanceof Error ? err.message : "Não consegui remover o insumo.");
    }
  }

  function openStock(item: CostIngredient) {
    setStockError("");
    setNotice("");
    setStock({ ingredientId: item.id, mode: item.stock_controlled ? "compra" : "contagem", quantity: "", unit: defaultUnit(item.unit) === "g" ? "kg" : defaultUnit(item.unit) === "ml" ? "l" : "un" });
  }

  async function submitStock(item: CostIngredient) {
    if (!stock) return;
    setStockError("");
    const zeroCount = stock.mode === "contagem" && parseDecimal(stock.quantity) === 0;
    if (!zeroCount && toBase(stock.quantity, stock.unit) === null) {
      setStockError("Escreva a quantidade. Ex.: 5 kg.");
      return;
    }
    try {
      await saveStock(companyId, item.id, {
        mode: stock.mode,
        quantity: parseDecimal(stock.quantity) ?? 0,
        unit: stock.unit,
      });
      setStock(null);
      setNotice(stock.mode === "compra" ? `Compra de ${item.name} somada ao estoque.` : `Contagem de ${item.name} salva.`);
      await reload();
    } catch (err) {
      setStockError(err instanceof Error ? err.message : "Não consegui salvar o estoque.");
    }
  }

  async function stopStock(item: CostIngredient) {
    try {
      await saveStock(companyId, item.id, { mode: "parar" });
      setStock(null);
      setNotice(`${item.name} saiu do controle de estoque.`);
      await reload();
    } catch (err) {
      setStockError(err instanceof Error ? err.message : "Não consegui salvar o estoque.");
    }
  }

  const ingredientUnits =
    editingIngredient && editingIngredient.used_in > 0 ? unitsFor(editingIngredient.unit) : PACKAGE_UNITS;

  return (
    <section className="adm-stack" aria-label="Custos">
      <div className="sheet">
        <h2>Custo dos pratos</h2>
        <p className="adm-lead" id="admin-costs-period">
          {periodSentence(costView.period, costView.target)}
        </p>
        <p className="adm-muted">
          CMV é quanto do preço de venda vai em ingrediente. O Sebrae cita de 25% a 35% como faixa boa para restaurante.
          {costView.products.length > 0 &&
            ` ${costView.with_cost} de ${costView.products.length} pratos já têm ficha.`}
        </p>
        <form
          className="cost-target"
          onSubmit={(event) => {
            event.preventDefault();
            void submitTarget();
          }}
        >
          <label className="field">
            <span>Sua meta de CMV (%)</span>
            <input
              id="admin-costs-target"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              inputMode="numeric"
              autoComplete="off"
            />
          </label>
          <button type="submit" className="btn btn-outline">
            Salvar meta
          </button>
        </form>
        {targetError && (
          <p className="msg-error" role="alert">
            {targetError}
          </p>
        )}
        {notice && (
          <p className="msg-ok" role="status">
            {notice}
          </p>
        )}
        {recipeSaved && <FeedbackAsk context="custos" title="Como foi montar a ficha do prato?" />}
      </div>

      <div className="sheet">
        <h2>Pratos</h2>
        {products.length === 0 ? (
          <p className="adm-muted">Cadastre os pratos na aba Produtos. Depois volte aqui para montar a ficha de cada um.</p>
        ) : (
          <ul className="adm-list">
            {products.map((product) => {
              const editing = draft?.productId === product.id ? draft : null;
              const portions = editing ? parsePortions(editing.portions) ?? 1 : 1;
              const draftLines = editing
                ? editing.lines.map((line) => {
                    const item = byId.get(line.ingredientId);
                    return {
                      quantity: line.quantity,
                      unit: line.unit,
                      packageQty: item?.package_qty ?? 0,
                      packagePrice: item?.package_price ?? 0,
                      yieldPct: item?.yield_pct ?? 100,
                    };
                  })
                : [];
              const liveCost = editing ? draftCost(draftLines, editing.extra, portions) : null;
              const liveRecipe = editing ? draftRecipeCost(draftLines) : null;
              const details = [
                product.portion,
                product.portion_grams ? `${numberText(product.portion_grams)} g` : "",
                product.yield_portions > 1 ? `receita rende ${product.yield_portions} porções` : "",
              ].filter(Boolean);
              return (
                <li key={product.id} className="adm-row cost-row">
                  <div className="adm-row-main cost-row-main">
                    <strong>{product.name}</strong>
                    <span className="cost-price">
                      {formatMoneyPlain(product.price)}
                      {details.length > 0 ? ` · ${details.join(" · ")}` : ""}
                    </span>
                    <span className="adm-muted">{productSentence(product, costView.target)}</span>
                  </div>
                  <div className="adm-row-side">
                    <span className={statusChip(product.status)}>{statusLabel(product.status)}</span>
                    {!editing && (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => startRecipe(product)}>
                        {product.recipe.length > 0 || product.extra_cost > 0 ? "Editar ficha" : "Montar ficha"}
                      </button>
                    )}
                  </div>

                  {editing && (
                    <form
                      className="cost-editor"
                      aria-label={`Ficha de ${product.name}`}
                      onSubmit={(event) => {
                        event.preventDefault();
                        void submitRecipe(product);
                      }}
                    >
                      {canListen() && costView.ingredients.length > 0 && (
                        <div className="cost-voice">
                          <button
                            type="button"
                            className={listening ? "btn btn-primary cost-voice-btn is-on" : "btn btn-outline cost-voice-btn"}
                            aria-pressed={listening}
                            onClick={() => void speakRecipe()}
                          >
                            {listening ? "Ouvindo… toque para parar" : "Falar a ficha"}
                          </button>
                          <small className="adm-muted">
                            Ex.: “1,2 quilo de peito de frango, 300 gramas de farinha de rosca, 4 ovos, rende 6 porções, porção de 250 gramas”.
                          </small>
                          {heard && <p className="cost-heard">“{heard}”</p>}
                          {heardNotes.map((note) => (
                            <p key={note} className="adm-muted cost-heard-note">
                              {note}
                            </p>
                          ))}
                        </div>
                      )}

                      <div className="cost-pack">
                        <label className="field">
                          <span>A receita rende quantas porções?</span>
                          <input
                            value={editing.portions}
                            onChange={(event) => setDraft({ ...editing, portions: event.target.value })}
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="1"
                          />
                        </label>
                        <label className="field">
                          <span>Peso de cada porção (g)</span>
                          <input
                            value={editing.grams}
                            onChange={(event) => setDraft({ ...editing, grams: event.target.value })}
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="Ex.: 300"
                          />
                        </label>
                      </div>
                      <small className="adm-muted">
                        Escreva a receita inteira: se 1,2 kg de peito vira 6 pratos, ponha 1,2 kg e 6 porções. O custo de cada prato sai sozinho.
                      </small>

                      <label className="field">
                        <span>Nome da porção (opcional)</span>
                        <input
                          value={editing.portion}
                          onChange={(event) => setDraft({ ...editing, portion: event.target.value })}
                          maxLength={60}
                          placeholder="Ex.: 1 pessoa, prato feito, meia porção"
                          autoComplete="off"
                        />
                      </label>

                      {costView.ingredients.length === 0 ? (
                        <p className="adm-muted">Cadastre primeiro os insumos, lá embaixo. Depois escolha aqui quanto vai de cada um.</p>
                      ) : (
                        <ul className="cost-lines">
                          {editing.lines.map((line, index) => {
                            const item = byId.get(line.ingredientId);
                            const lineCost = item
                              ? draftLineCost({
                                  quantity: line.quantity,
                                  unit: line.unit,
                                  packageQty: item.package_qty,
                                  packagePrice: item.package_price,
                                  yieldPct: item.yield_pct,
                                })
                              : null;
                            return (
                              <li key={index} className="cost-line">
                                <label className="field cost-line-name">
                                  <span>Insumo</span>
                                  <select
                                    value={line.ingredientId}
                                    onChange={(event) => {
                                      const chosen = byId.get(event.target.value);
                                      changeLine(index, {
                                        ingredientId: event.target.value,
                                        unit: chosen ? defaultUnit(chosen.unit) : line.unit,
                                      });
                                    }}
                                  >
                                    <option value="">Escolha</option>
                                    {costView.ingredients.map((option) => (
                                      <option key={option.id} value={option.id}>
                                        {option.name}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="field cost-line-qty">
                                  <span>Quanto vai na receita</span>
                                  <input
                                    value={line.quantity}
                                    onChange={(event) => changeLine(index, { quantity: event.target.value })}
                                    inputMode="decimal"
                                    autoComplete="off"
                                    placeholder="250"
                                  />
                                </label>
                                <label className="field cost-line-unit">
                                  <span>Unidade</span>
                                  <select
                                    value={line.unit}
                                    onChange={(event) => {
                                      if (isInputUnit(event.target.value)) changeLine(index, { unit: event.target.value });
                                    }}
                                  >
                                    {(item ? unitsFor(item.unit) : PACKAGE_UNITS).map((unit) => (
                                      <option key={unit.value} value={unit.value}>
                                        {unit.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <span className="cost-line-cost" aria-label="Custo desta linha">
                                  {lineCost === null ? "—" : formatMoneyPlain(lineCost)}
                                </span>
                                <button type="button" className="btn btn-quiet btn-sm" onClick={() => removeLine(index)}>
                                  Tirar
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      {costView.ingredients.length > 0 && (
                        <button type="button" className="btn btn-outline btn-sm" onClick={addLine}>
                          Adicionar insumo
                        </button>
                      )}

                      <label className="field">
                        <span>Outros custos por porção, em R$ (embalagem, gás)</span>
                        <input
                          value={editing.extra}
                          onChange={(event) => setDraft({ ...editing, extra: event.target.value })}
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder="0,00"
                        />
                      </label>

                      <p className="cost-total" aria-live="polite">
                        {liveCost === null
                          ? "Custo da porção: escolha os insumos e as quantidades."
                          : `${portions > 1 && liveRecipe !== null ? `Receita: ${formatMoneyPlain(liveRecipe)} ÷ ${portions} porções. ` : ""}Custo da porção: ${formatMoneyPlain(liveCost)}${
                              cmvOf(liveCost, product.price) !== null
                                ? ` · CMV ${formatPercent(cmvOf(liveCost, product.price))} (meta ${costView.target}%)`
                                : ""
                            }`}
                      </p>

                      {recipeError && (
                        <p className="msg-error" role="alert">
                          {recipeError}
                        </p>
                      )}

                      <div className="cost-actions">
                        <button type="submit" className="btn btn-primary" disabled={savingRecipe}>
                          {savingRecipe ? "Salvando…" : "Salvar ficha"}
                        </button>
                        <button type="button" className="btn btn-quiet" onClick={closeRecipe}>
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {ranking.length > 0 && (
        <div className="sheet" aria-label="Lucratividade">
          <h2>O que dá mais lucro</h2>
          <p className="adm-muted">
            Últimos 30 dias, pelos pedidos aceitos. Cada prato ganha um nome pela engenharia de cardápio: o quanto vende
            e o quanto sobra por porção, comparado com os outros pratos. A ação ao lado é a promoção ou a mudança que combina.
          </p>
          <ol className="adm-list cost-ranking">
            {ranking.map((product) => (
              <li key={product.id} className="adm-row cost-row">
                <div className="adm-row-main cost-row-main">
                  <strong>{product.name}</strong>
                  <span className="adm-muted">{profitSentence(product)}</span>
                  <span>{quadrantAction(product.quadrant)}</span>
                </div>
                {product.quadrant && (
                  <div className="adm-row-side">
                    <span className={quadrantChip(product.quadrant)}>{quadrantLabel(product.quadrant)}</span>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="sheet" aria-label="Insumos">
      <form
        className="cost-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submitIngredient();
        }}
      >
        <h2>{editingIngredient ? `Mudar ${editingIngredient.name}` : "Insumos (o que você compra)"}</h2>
        <p className="adm-lead">Escreva como vem na nota: o tamanho da embalagem e quanto você pagou.</p>

        <label className="field">
          <span>Nome do insumo</span>
          <input
            id="admin-ingredient-name"
            value={ingredient.name}
            onChange={(event) => setIngredient({ ...ingredient, name: event.target.value })}
            maxLength={80}
            placeholder="Ex.: Peito de frango"
            autoComplete="off"
          />
        </label>

        <div className="cost-pack">
          <label className="field">
            <span>Tamanho da embalagem</span>
            <input
              id="admin-ingredient-qty"
              value={ingredient.quantity}
              onChange={(event) => setIngredient({ ...ingredient, quantity: event.target.value })}
              inputMode="decimal"
              autoComplete="off"
              placeholder="1"
            />
          </label>
          <label className="field">
            <span>Unidade</span>
            <select
              id="admin-ingredient-unit"
              value={ingredient.unit}
              onChange={(event) => {
                if (isInputUnit(event.target.value)) setIngredient({ ...ingredient, unit: event.target.value });
              }}
            >
              {ingredientUnits.map((unit) => (
                <option key={unit.value} value={unit.value}>
                  {unit.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="cost-pack">
          <label className="field">
            <span>Quanto você pagou (R$)</span>
            <input
              id="admin-ingredient-price"
              value={ingredient.price}
              onChange={(event) => setIngredient({ ...ingredient, price: event.target.value })}
              inputMode="decimal"
              autoComplete="off"
              placeholder="18,90"
            />
          </label>
          <label className="field">
            <span>Aproveitamento (%)</span>
            <input
              id="admin-ingredient-yield"
              value={ingredient.yieldPct ?? ""}
              onChange={(event) => setIngredient({ ...ingredient, yieldPct: event.target.value })}
              inputMode="numeric"
              autoComplete="off"
              placeholder="100"
            />
          </label>
        </div>
        <small className="adm-muted">
          Aproveitamento: o que sobra depois de limpar. Se 1 kg de peito vira 850 g limpo, escreva 85. Sem perda, deixe 100.
          {editingIngredient && editingIngredient.used_in > 0 &&
            ` Mudar o preço ou o aproveitamento atualiza o custo dos ${editingIngredient.used_in} prato(s) que usam este insumo.`}
        </small>

        {ingredientError && (
          <p className="msg-error" role="alert">
            {ingredientError}
          </p>
        )}

        <div className="cost-actions">
          <button type="submit" className="btn btn-primary" disabled={savingIngredient}>
            {savingIngredient ? "Salvando…" : editingIngredient ? "Salvar mudança" : "Salvar insumo"}
          </button>
          {editingIngredient && (
            <button type="button" className="btn btn-quiet" onClick={cancelIngredientEdit}>
              Cancelar
            </button>
          )}
        </div>
      </form>

        {costView.ingredients.length > 0 && (
          <ul className="adm-list">
            {costView.ingredients.map((item) => {
              const counting = stock?.ingredientId === item.id ? stock : null;
              return (
                <li key={item.id} className="adm-row cost-row">
                  <div className="adm-row-main cost-row-main">
                    <strong>{item.name}</strong>
                    <span className="adm-muted">
                      {packageLabel(item.package_price, item.package_qty, item.unit)}
                      {item.yield_pct < 100 ? ` · aproveitamento ${item.yield_pct}%` : ""}
                      {item.used_in > 0 ? ` · em ${item.used_in} prato(s)` : " · ainda em nenhum prato"}
                    </span>
                    {portionsSentences(item.package_qty, item.unit, item.portions_per_package).map((sentence) => (
                      <span key={sentence} className="cost-yield">
                        {sentence}
                      </span>
                    ))}
                    <span className="adm-muted">{stockSentence(item)}</span>
                  </div>
                  <div className="adm-row-side">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => openStock(item)}>
                      Estoque
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => startIngredientEdit(item)}>
                      Mudar
                    </button>
                    <ConfirmButton
                      label="Remover"
                      confirmLabel={item.used_in > 0 ? "Sai das fichas. Toque de novo" : "Toque de novo"}
                      onConfirm={() => void removeIngredient(item)}
                    />
                  </div>

                  {counting && (
                    <div className="cost-editor" role="group" aria-label={`Estoque de ${item.name}`}>
                      <div className="cost-pack">
                        <label className="field">
                          <span>O que aconteceu?</span>
                          <select
                            value={counting.mode}
                            onChange={(event) =>
                              setStock({ ...counting, mode: event.target.value === "compra" ? "compra" : "contagem" })
                            }
                          >
                            <option value="contagem">Contei: tenho agora</option>
                            <option value="compra">Comprei: somar</option>
                          </select>
                        </label>
                        <label className="field">
                          <span>Quantidade</span>
                          <input
                            value={counting.quantity}
                            onChange={(event) => setStock({ ...counting, quantity: event.target.value })}
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="5"
                          />
                        </label>
                      </div>
                      <label className="field">
                        <span>Unidade</span>
                        <select
                          value={counting.unit}
                          onChange={(event) => {
                            if (isInputUnit(event.target.value)) setStock({ ...counting, unit: event.target.value });
                          }}
                        >
                          {unitsFor(item.unit).map((unit) => (
                            <option key={unit.value} value={unit.value}>
                              {unit.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <small className="adm-muted">
                        Depois disso, cada venda aceita tira do estoque o que a ficha diz. Conte de novo de vez em quando para acertar.
                      </small>
                      {stockError && (
                        <p className="msg-error" role="alert">
                          {stockError}
                        </p>
                      )}
                      <div className="cost-actions">
                        <button type="button" className="btn btn-primary" onClick={() => void submitStock(item)}>
                          Salvar estoque
                        </button>
                        {item.stock_controlled && (
                          <button type="button" className="btn btn-quiet" onClick={() => void stopStock(item)}>
                            Parar de controlar
                          </button>
                        )}
                        <button type="button" className="btn btn-quiet" onClick={() => setStock(null)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
