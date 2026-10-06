import { useMemo, useState } from "react";
import "../ui.css";
import "./logo.css";
import LogoCanvas, { FoodIcon } from "./LogoCanvas";
import { renderLogoPng } from "./logoFiles";
import {
  DEFAULT_PALETTE,
  FOODS,
  NAME_MAX_CHARS,
  PALETTES,
  cleanName,
  guessFood,
  paletteById,
  variantsFor,
  type FoodId,
  type PaletteId,
  type TemplateId,
} from "./logoLogic";

type Props = {
  /** O nome do restaurante: já vem escrito na logomarca, e o dono pode encurtar. */
  initialName: string;
  /** Guarda o PNG. Se falhar, lança um Error com a mensagem para o dono. */
  onSave: (png: Blob) => Promise<void>;
  onCancel: () => void;
};

type Step = 1 | 2 | 3;

const TEMPLATE_LABEL: Record<TemplateId, string> = {
  selo: "Selo redondo",
  quadrado: "Quadrado com faixa",
  claro: "Claro",
  redondo: "Redondo claro",
  letras: "Só as letras",
  toldo: "Toldo de loja",
};

/**
 * Criador de logomarca em três toques: o que você vende, a cor da fachada, o modelo.
 * Tudo é desenhado aqui no celular, sem internet e sem custo; só o PNG final vai para o servidor.
 */
export default function LogoMaker({ initialName, onSave, onCancel }: Props) {
  const guess = useMemo(() => guessFood(initialName), [initialName]);
  const [step, setStep] = useState<Step>(1);
  const [food, setFood] = useState<FoodId | null>(guess);
  const [palette, setPalette] = useState<PaletteId>(guess ? DEFAULT_PALETTE[guess] : "verde");
  const [paletteTouched, setPaletteTouched] = useState(false);
  const [template, setTemplate] = useState<TemplateId>("quadrado");
  const [name, setName] = useState(cleanName(initialName));
  const [cutIn, setCutIn] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function chooseFood(next: FoodId) {
    setFood(next);
    if (!paletteTouched) setPalette(DEFAULT_PALETTE[next]);
  }

  const chosenFood: FoodId = food ?? "geral";
  const variants = variantsFor(chosenFood, palette, name);
  const anyCut = variants.some((variant) => cutIn[variant.template]);

  async function save() {
    setError("");
    if (cleanName(name) === "") {
      setError("Escreva o nome que vai aparecer na logomarca.");
      return;
    }
    setSaving(true);
    try {
      const png = await renderLogoPng({ template, food: chosenFood, palette, name });
      await onSave(png);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui salvar a logomarca. Tente de novo.");
      setSaving(false);
    }
  }

  return (
    <section className="sheet logo-maker" aria-label="Criar logomarca" id="logo-maker">
      <p className="logo-steps" aria-live="polite">
        Passo {step} de 3
      </p>

      {step === 1 && (
        <>
          <h2 className="logo-question" id="logo-q1">
            O que você vende?
          </h2>
          <div className="logo-grid" role="radiogroup" aria-labelledby="logo-q1">
            {FOODS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={food === item.id}
                className="logo-pick"
                onClick={() => chooseFood(item.id)}
              >
                <FoodIcon food={item.id} />
                <span>{item.label}</span>
                {guess === item.id && food !== item.id && <span className="logo-pick-guess">parece ser este</span>}
              </button>
            ))}
          </div>
          <div className="logo-actions">
            <button
              type="button"
              id="logo-next-1"
              className="btn btn-primary btn-block"
              disabled={food === null}
              onClick={() => setStep(2)}
            >
              Continuar
            </button>
            <button type="button" className="btn btn-outline btn-block" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h2 className="logo-question" id="logo-q2">
            Qual é a cor da sua fachada?
          </h2>
          <p className="adm-muted">Sem fachada, escolha a cor que você mais gosta.</p>
          <div className="logo-live">
            <LogoCanvas
              spec={{ template: "quadrado", food: chosenFood, palette, name }}
              pixels={264}
              label="Como a logomarca está ficando"
            />
          </div>
          <div className="logo-grid" role="radiogroup" aria-labelledby="logo-q2">
            {PALETTES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={palette === item.id}
                className="logo-pick"
                onClick={() => {
                  setPalette(item.id);
                  setPaletteTouched(true);
                }}
              >
                <span className="logo-swatch" style={{ background: paletteById(item.id).main }} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <div className="logo-actions">
            <button type="button" id="logo-next-2" className="btn btn-primary btn-block" onClick={() => setStep(3)}>
              Continuar
            </button>
            <button type="button" className="btn btn-outline btn-block" onClick={() => setStep(1)}>
              Voltar
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h2 className="logo-question" id="logo-q3">
            Escolha o modelo
          </h2>
          <label className="field">
            <span>Nome na logomarca</span>
            <input
              id="logo-name"
              value={name}
              onChange={(event) => setName(event.target.value.slice(0, NAME_MAX_CHARS))}
              maxLength={NAME_MAX_CHARS}
              autoComplete="off"
              enterKeyHint="done"
            />
            <small>Se o nome for comprido, escreva aqui uma versão curta. Só muda na logomarca.</small>
          </label>
          {anyCut && (
            <p className="adm-muted" role="status">
              O nome ficou cortado em alguns modelos. Escreva uma versão mais curta.
            </p>
          )}
          <div className="logo-grid logo-grid-2" role="radiogroup" aria-labelledby="logo-q3">
            {variants.map((variant) => (
              <button
                key={variant.template}
                type="button"
                role="radio"
                aria-checked={template === variant.template}
                aria-label={TEMPLATE_LABEL[variant.template]}
                className="logo-pick logo-pick-model"
                onClick={() => setTemplate(variant.template)}
              >
                <LogoCanvas
                  spec={variant}
                  label={`Modelo ${TEMPLATE_LABEL[variant.template]}`}
                  onNameCut={(cut) =>
                    setCutIn((old) => (old[variant.template] === cut ? old : { ...old, [variant.template]: cut }))
                  }
                />
              </button>
            ))}
          </div>

          {error && (
            <p className="msg-error" role="alert">
              {error}
            </p>
          )}

          <div className="logo-actions">
            <button type="button" id="logo-save" className="btn btn-primary btn-block" disabled={saving} onClick={() => void save()}>
              {saving ? "Salvando…" : "Usar esta logomarca"}
            </button>
            <button type="button" className="btn btn-outline btn-block" disabled={saving} onClick={() => setStep(2)}>
              Voltar
            </button>
          </div>
        </>
      )}
    </section>
  );
}
