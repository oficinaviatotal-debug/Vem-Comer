import { useEffect, useState } from "react";
import {
  deleteIngredient,
  fetchCosts,
  saveCostTarget,
  saveIngredient,
  saveRecipe,
  type CostIngredient,
  type CostProduct,
  type CostView,
} from "../service/api";
import ConfirmButton from "../service/ConfirmButton";
import {
  PACKAGE_UNITS,
  cmvOf,
  draftCost,
  draftLineCost,
  formatMoneyPlain,
  formatPercent,
  ingredientFormProblem,
  isInputUnit,
  packageLabel,
  parseDecimal,
  periodSentence,
  productSentence,
  recipePayload,
  recipeProblem,
  sortForAttention,
  statusChip,
  statusLabel,
  toInput,
  unitsFor,
  type BaseUnit,
  type IngredientForm,
  type InputUnit,
  type RecipeDraftLine,
} from "./costLogic";
import "./costs.css";

type Props = {
  companyId: string;
};

type RecipeDraft = {
  productId: string;
  portion: string;
  extra: string;
  lines: RecipeDraftLine[];
};

const EMPTY_INGREDIENT: IngredientForm = { name: "", quantity: "", unit: "kg", price: "" };

function defaultUnit(base: BaseUnit): InputUnit {
  return base === "un" ? "un" : base;
}

function moneyText(value: number): string {
  return value ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) : "";
}

/**
 * "Custos" tab: what each dish costs (recipe card), its CMV against the owner's
 * target, and the ingredients the restaurant buys. Owner and manager only.
 */
export default function CostsPanel({ companyId }: Props) {
  const [view, setView] = useState<CostView | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [notice, setNotice] = useState("");

  const [target, setTarget] = useState("");
  const [targetError, setTargetError] = useState("");

  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [recipeError, setRecipeError] = useState("");
  const [savingRecipe, setSavingRecipe] = useState(false);

  const [ingredient, setIngredient] = useState<IngredientForm>(EMPTY_INGREDIENT);
  const [editingIngredient, setEditingIngredient] = useState<CostIngredient | null>(null);
  const [ingredientError, setIngredientError] = useState("");
  const [savingIngredient, setSavingIngredient] = useState(false);

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
    setDraft({
      productId: product.id,
      portion: product.portion ?? "",
      extra: moneyText(product.extra_cost),
      lines: product.recipe.map((line) => ({ ingredientId: line.ingredient_id, ...toInput(line.quantity, line.unit) })),
    });
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

  async function submitRecipe(product: CostProduct) {
    if (!draft) return;
    setRecipeError("");
    const problem = recipeProblem(draft.lines, draft.extra);
    if (problem) {
      setRecipeError(problem);
      return;
    }
    setSavingRecipe(true);
    try {
      await saveRecipe(companyId, product.id, recipePayload(draft.portion, draft.extra, draft.lines));
      setDraft(null);
      setNotice(`Ficha de ${product.name} salva.`);
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
    setIngredient({ name: item.name, quantity: input.quantity, unit: input.unit, price: moneyText(item.package_price) || "0" });
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
          quantity: String(parseDecimal(ingredient.quantity) ?? ""),
          unit: ingredient.unit,
          price: String(parseDecimal(ingredient.price) ?? ""),
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
      </div>

      <div className="sheet">
        <h2>Pratos</h2>
        {products.length === 0 ? (
          <p className="adm-muted">Cadastre os pratos na aba Produtos. Depois volte aqui para montar a ficha de cada um.</p>
        ) : (
          <ul className="adm-list">
            {products.map((product) => {
              const editing = draft?.productId === product.id ? draft : null;
              const liveCost = editing
                ? draftCost(
                    editing.lines.map((line) => {
                      const item = byId.get(line.ingredientId);
                      return {
                        quantity: line.quantity,
                        unit: line.unit,
                        packageQty: item?.package_qty ?? 0,
                        packagePrice: item?.package_price ?? 0,
                      };
                    }),
                    editing.extra,
                  )
                : null;
              return (
                <li key={product.id} className="adm-row cost-row">
                  <div className="adm-row-main cost-row-main">
                    <strong>{product.name}</strong>
                    <span className="cost-price">
                      {formatMoneyPlain(product.price)}
                      {product.portion ? ` · ${product.portion}` : ""}
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
                      <label className="field">
                        <span>Porção</span>
                        <input
                          value={editing.portion}
                          onChange={(event) => setDraft({ ...editing, portion: event.target.value })}
                          maxLength={60}
                          placeholder="Ex.: 1 pessoa, 300 g, prato feito"
                          autoComplete="off"
                        />
                        <small>Sempre a mesma porção: é ela que tem esse custo.</small>
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
                                  <span>Quanto vai</span>
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
                          : `Custo da porção: ${formatMoneyPlain(liveCost)}${
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
                        <button type="button" className="btn btn-quiet" onClick={() => setDraft(null)}>
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

      <form
        className="sheet"
        aria-label="Insumos"
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
          {editingIngredient && editingIngredient.used_in > 0 && (
            <small>Mudar o preço atualiza o custo dos {editingIngredient.used_in} prato(s) que usam este insumo.</small>
          )}
        </label>

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

        {costView.ingredients.length > 0 && (
          <ul className="adm-list">
            {costView.ingredients.map((item) => (
              <li key={item.id} className="adm-row">
                <div className="adm-row-main cost-row-main">
                  <strong>{item.name}</strong>
                  <span className="adm-muted">
                    {packageLabel(item.package_price, item.package_qty, item.unit)}
                    {item.used_in > 0 ? ` · em ${item.used_in} prato(s)` : " · ainda em nenhum prato"}
                  </span>
                </div>
                <div className="adm-row-side">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => startIngredientEdit(item)}>
                    Mudar
                  </button>
                  <ConfirmButton
                    label="Remover"
                    confirmLabel={item.used_in > 0 ? "Sai das fichas. Toque de novo" : "Toque de novo"}
                    onConfirm={() => void removeIngredient(item)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </form>
    </section>
  );
}
