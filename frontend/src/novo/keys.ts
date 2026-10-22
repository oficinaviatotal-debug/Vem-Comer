import type { KeyboardEvent } from "react";

/**
 * Setas nos grupos de "escolha uma" (tamanho, como receber, como pagar), como um grupo de rádio de verdade: seta para
 * baixo ou para a direita vai à próxima opção e a marca; seta para cima ou para a esquerda vai à anterior. Só o marcado
 * (ou o primeiro, se nada está marcado) recebe o Tab: quem usa teclado ou leitor de tela passa pelo grupo de uma vez só.
 */
export function onRadioKeys(event: KeyboardEvent<HTMLElement>): void {
  const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
  const back = event.key === "ArrowUp" || event.key === "ArrowLeft";
  if (!forward && !back) return;
  const group = event.currentTarget.closest<HTMLElement>('[role="radiogroup"]');
  if (!group) return;
  const radios = [...group.querySelectorAll<HTMLElement>('[role="radio"]:not([aria-disabled="true"])')];
  const at = radios.indexOf(event.currentTarget);
  if (at < 0 || radios.length < 2) return;
  event.preventDefault();
  const next = radios[(at + (forward ? 1 : radios.length - 1)) % radios.length];
  next.focus();
  next.click();
}

/** O Tab de uma opção de grupo de rádio: 0 no marcado (ou no primeiro, se ninguém está marcado), -1 nos outros. */
export function radioTab(index: number, on: boolean, anyOn: boolean): 0 | -1 {
  return on || (!anyOn && index === 0) ? 0 : -1;
}
