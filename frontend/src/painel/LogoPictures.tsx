import { useEffect, useRef, type ReactNode } from "react";
import type { LogoPictures } from "../novo/Logo";
import { LOGO_LIVE_ALT, LOGO_MODEL_ALT } from "../novo/copy";
import { drawGlyph } from "../logo/logoGlyphs";
import { loadLogoFonts, paintLogo } from "../logo/logoFiles";
import type { FoodId, LogoSpec, TemplateId } from "../logo/logoLogic";
import { makerSpec, modelSpecs, type MakerState } from "./logoViewLogic";

/**
 * Os desenhos da logomarca na tela nova. São feitos aqui no celular, num canvas, sem internet e sem custo; só o PNG final vai
 * para o servidor. A tela em si (`novo/Logo.tsx`) só guarda o lugar deles.
 */

type PictureProps = {
  spec: LogoSpec;
  /** Pixels de verdade do desenho (o tamanho na tela vem do CSS). 2x o tamanho na tela fica nítido. */
  pixels?: number;
  label: string;
  /** O botão em volta já tem nome: o desenho não precisa ser lido de novo. */
  decorative?: boolean;
  /** Avisa se o nome ficou cortado (comprido demais) neste modelo. */
  onNameCut?: (cut: boolean) => void;
};

/** Uma logomarca desenhada na tela. Espera as fontes da marca antes de escrever o nome e redesenha quando elas chegam. */
export function LogoPicture({ spec, pixels = 320, label, decorative = false, onNameCut }: PictureProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cut = useRef(onNameCut);
  cut.current = onNameCut;

  useEffect(() => {
    let alive = true;
    const draw = () => {
      if (!ref.current) return;
      const clipped = paintLogo(ref.current, spec, pixels);
      cut.current?.(clipped);
    };
    draw(); // já mostra o desenho; se as fontes chegarem depois, refaz com elas
    void loadLogoFonts().then(() => {
      if (alive) draw();
    });
    return () => {
      alive = false;
    };
  }, [spec.template, spec.food, spec.palette, spec.name, pixels]); // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={ref} className="nv-logocanvas" role={decorative ? undefined : "img"} aria-label={decorative ? undefined : label} aria-hidden={decorative || undefined} />;
}

const ICON_INK = "#123B2B";
const ICON_DETAIL = "#C2410C";
const ICON_BACK = "#FFFFFF";

/** O desenho de comida sozinho, para os botões de "o que você vende". */
export function FoodPicture({ food }: { food: FoodId }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    canvas.width = 160;
    canvas.height = 160;
    context.clearRect(0, 0, 160, 160);
    drawGlyph(context, food, 80, 80, 68, { fg: ICON_INK, detail: ICON_DETAIL, cut: ICON_BACK });
  }, [food]);

  return <canvas ref={ref} className="nv-logofood" aria-hidden="true" />;
}

/**
 * Os desenhos que a tela do criar usa: o tipo de comida, a prévia da cor e cada um dos seis modelos. `onCut` avisa quando o
 * nome ficou cortado (ou coube) em um modelo.
 */
export function makerPictures(maker: MakerState | null, onCut: (template: TemplateId, cut: boolean) => void): LogoPictures {
  return {
    food: (id) => <FoodPicture food={id as FoodId} />,
    live: () => (maker ? <LogoPicture spec={makerSpec(maker, "quadrado")} pixels={264} label={LOGO_LIVE_ALT} /> : null),
    model: (id, label): ReactNode => {
      const spec = maker ? modelSpecs(maker).find((entry) => entry.template === id) : undefined;
      if (!spec) return null;
      return <LogoPicture spec={spec} label={LOGO_MODEL_ALT(label)} decorative onNameCut={(cut) => onCut(id as TemplateId, cut)} />;
    },
  };
}

/** Uma logomarca desenhada como imagem (endereço de dados), para a conferência mostrar a logomarca de agora. */
export async function drawnLogoUrl(spec: LogoSpec, pixels = 512): Promise<string> {
  await loadLogoFonts();
  const canvas = document.createElement("canvas");
  paintLogo(canvas, spec, pixels);
  return canvas.toDataURL("image/png");
}
