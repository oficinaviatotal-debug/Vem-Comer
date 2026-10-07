import { useEffect, useRef } from "react";
import { drawGlyph } from "./logoGlyphs";
import { loadLogoFonts, paintLogo } from "./logoFiles";
import type { FoodId, LogoSpec } from "./logoLogic";

type Props = {
  spec: LogoSpec;
  /** Pixels de verdade do desenho (o tamanho na tela vem do CSS). 2x o tamanho na tela fica nítido. */
  pixels?: number;
  label: string;
  /** Avisa se o nome ficou cortado (comprido demais) neste modelo. */
  onNameCut?: (cut: boolean) => void;
};

/** Uma logomarca desenhada na tela. Espera as fontes da marca antes de escrever o nome. */
export default function LogoCanvas({ spec, pixels = 320, label, onNameCut }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;
    const draw = () => {
      if (!ref.current) return;
      const cut = paintLogo(ref.current, spec, pixels); // antes do aviso: "onNameCut?.(paintLogo())" nem desenharia sem onNameCut
      onNameCut?.(cut);
    };
    draw(); // já mostra o desenho; se as fontes chegarem depois, refaz com elas
    void loadLogoFonts().then(() => {
      if (alive) draw();
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.template, spec.food, spec.palette, spec.name, pixels]);

  return <canvas ref={ref} className="logo-canvas" role="img" aria-label={label} />;
}

const ICON_INK = "#123B2B";
const ICON_DETAIL = "#C2410C";
const ICON_BACK = "#FFFFFF";

/** O desenho de comida sozinho, para os botões de "o que você vende". */
export function FoodIcon({ food }: { food: FoodId }) {
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

  return <canvas ref={ref} className="logo-food-icon" aria-hidden="true" />;
}
