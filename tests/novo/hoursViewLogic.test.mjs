import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { fromApi, hoursViewOf, isDirty, setClosed, setShift, addShift, validate } from "../../frontend/src/painel/hoursViewLogic.ts";
import { summary } from "../../frontend/src/service/hoursDraft.ts";
import * as copy from "../../frontend/src/novo/copy.ts";

const read = (path) => readFileSync(new URL(`../../frontend/src/${path}`, import.meta.url), "utf8");

const lunchAndDinner = [{ opens: "11:00", closes: "15:00" }, { opens: "18:00", closes: "23:00" }];
const apiWeek = (over = {}) => ({
  configured: true,
  week: [0, 1, 2, 3, 4, 5, 6].map((weekday) => (weekday === 6 ? { weekday, closed: true, shifts: [] } : { weekday, closed: false, shifts: lunchAndDinner.map((shift) => ({ ...shift })) })),
  orders_paused: false,
  open_now: true,
  open_message: "Aberto até 15h. Volta às 18h.",
  ...over,
});

const baseInput = (over = {}) => {
  const server = over.server === undefined ? apiWeek() : over.server;
  return {
    load: "ready",
    server,
    week: fromApi(server),
    person: "João Silva, dono",
    error: "",
    switching: false,
    saving: false,
    removing: false,
    removeArmed: false,
    problems: [],
    notice: null,
    listening: false,
    heard: "",
    spoken: null,
    canSpeak: true,
    speakHelp: "Diga os dias e as horas.",
    ...over,
  };
};
const view = (over) => hoursViewOf(baseInput(over));

// ---------------------------------------------------------------- como o restaurante está agora

test("aberto, fechado, pausado e sem horário: cada um diz o que o cliente vê", () => {
  const open = view().now;
  assert.deepEqual({ tone: open.tone, title: open.title }, { tone: "open", title: "Aberto agora" });
  assert.equal(open.detail, "Aberto até 15h. Volta às 18h.", "a frase é a que o servidor escreveu");

  const closed = view({ server: apiWeek({ open_now: false, open_message: "Abrimos hoje às 18h." }) }).now;
  assert.deepEqual({ tone: closed.tone, title: closed.title, detail: closed.detail }, { tone: "closed", title: "Fechado agora", detail: "Abrimos hoje às 18h." });

  const paused = view({ server: apiWeek({ orders_paused: true }) }).now;
  assert.deepEqual({ tone: paused.tone, title: paused.title }, { tone: "paused", title: "Pedidos pausados" });
  assert.match(paused.detail, /não estamos recebendo/);

  const none = view({ server: apiWeek({ configured: false, week: [], open_message: "" }) }).now;
  assert.deepEqual({ tone: none.tone, title: none.title }, { tone: "none", title: "Sem horário" });
  assert.match(none.detail, /qualquer hora/);
});

test("a pausa ganha de tudo: pausado nunca aparece como aberto, mesmo dentro do horário", () => {
  const paused = view({ server: apiWeek({ orders_paused: true, open_now: true }) });
  assert.equal(paused.now.tone, "paused");
  assert.equal(paused.paused, true);
  assert.equal(paused.pauseButton, "Voltar a receber pedidos");
  assert.match(paused.pauseHelp, /ninguém consegue pedir/);
  const running = view();
  assert.equal(running.paused, false);
  assert.equal(running.pauseButton, "Pausar os pedidos agora");
  assert.match(running.pauseHelp, /cozinha encher/);
});

test("enquanto a tela abre ou quando não abriu, não há dias, resumo nem estado inventados", () => {
  const loading = view({ load: "loading", server: null });
  assert.equal(loading.now, null);
  assert.deepEqual(loading.days, []);
  assert.equal(loading.summary, "");
  assert.equal(loading.canSave, false);
  assert.equal(loading.canRemoveHours, false);
  const failed = view({ load: "error", server: null, error: "Não consegui abrir o horário." });
  assert.equal(failed.error, "Não consegui abrir o horário.");
  assert.equal(failed.now, null);
  assert.equal(failed.canSave, false, "sem ter lido o horário, nada se salva por cima dele");
  assert.equal(view().error, "", "o erro só aparece quando a tela não abriu");
});

// ---------------------------------------------------------------- os sete dias

test("os sete dias saem em ordem, com o nome em maiúscula e o que o leitor de tela fala", () => {
  const { days } = view();
  assert.deepEqual(days.map((day) => day.name), ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]);
  assert.equal(days[0].toggleLabel, "Segunda: aberto. Toque para fechar");
  assert.equal(days[6].toggleLabel, "Domingo: fechado. Toque para abrir");
  assert.equal(days[6].closed, true);
  assert.deepEqual(days[6].shifts, [], "dia fechado não mostra horas");
  assert.deepEqual(days[0].shifts.map((shift) => [shift.opens, shift.closes]), [["11:00", "15:00"], ["18:00", "23:00"]]);
  assert.equal(days[0].shifts[1].opensLabel, "Segunda, turno 2, hora de abrir");
  assert.equal(days[0].shifts[1].closesLabel, "Segunda, turno 2, hora de fechar");
});

test("só dá para tirar um turno quando o dia tem dois; e só dá para pôr outro quando tem um", () => {
  const two = view().days[0];
  assert.deepEqual(two.shifts.map((shift) => shift.removeLabel), ["Tirar o turno 1 de Segunda", "Tirar o turno 2 de Segunda"]);
  assert.equal(two.canAddShift, false, "no máximo dois turnos");
  const oneWeek = setShift(setClosed(fromApi(apiWeek()), 1, false), 1, 0, { opens: "11:00", closes: "22:00" }).map((day) => (day.weekday === 1 ? { ...day, shifts: [day.shifts[0]] } : day));
  const one = hoursViewOf(baseInput({ week: oneWeek })).days[1];
  assert.equal(one.shifts.length, 1);
  assert.equal(one.shifts[0].removeLabel, null, "o único turno não tem botão de tirar (para isso fecha-se o dia)");
  assert.equal(one.canAddShift, true);
  const closed = view().days[6];
  assert.equal(closed.canAddShift, false, "dia fechado não recebe turno");
});

test("\"Copiar para todos os dias\" aparece só no primeiro dia aberto", () => {
  assert.deepEqual(view().days.map((day) => day.canCopy), [true, false, false, false, false, false, false]);
  const mondayClosed = setClosed(fromApi(apiWeek()), 0, true);
  assert.deepEqual(hoursViewOf(baseInput({ week: mondayClosed })).days.map((day) => day.canCopy), [false, true, false, false, false, false, false]);
  const allClosed = fromApi(apiWeek()).map((day) => ({ ...day, closed: true, shifts: [] }));
  assert.ok(hoursViewOf(baseInput({ week: allClosed })).days.every((day) => !day.canCopy), "sem dia aberto não há de onde copiar");
});

test("a linha-resumo é a da tela antiga, a mesma que o cliente e o dono leem", () => {
  assert.equal(view().summary, summary(fromApi(apiWeek())));
  assert.match(view().summary, /Seg a sáb/);
  assert.match(view().summary, /Dom fechado/);
});

// ---------------------------------------------------------------- salvar

test("só se salva o que mudou, ou o primeiro horário", () => {
  const clean = view();
  assert.equal(clean.dirty, false);
  assert.equal(clean.canSave, false, "nada mudou: o botão fica apagado");
  const edited = fromApi(apiWeek()).map((day) => (day.weekday === 6 ? { ...day, closed: false, shifts: [{ opens: "11:00", closes: "16:00" }] } : day));
  const changed = hoursViewOf(baseInput({ week: edited }));
  assert.equal(changed.dirty, true);
  assert.equal(changed.canSave, true);
  assert.equal(isDirty(apiWeek(), edited), true);
  assert.equal(isDirty(null, edited), false, "sem ter lido o servidor não se sabe o que mudou");

  const first = view({ server: apiWeek({ configured: false, week: [], open_message: "" }) });
  assert.equal(first.dirty, false);
  assert.equal(first.canSave, true, "sem horário salvo o botão Salvar horário já vale (o horário sugerido pode ser o certo)");
  assert.equal(hoursViewOf(baseInput({ week: edited, saving: true })).canSave, false, "enquanto salva, não toca de novo");
  assert.equal(hoursViewOf(baseInput({ week: edited, removing: true })).canSave, false);
});

test("o que falta acertar, o aviso e a frase do leitor de tela", () => {
  const problems = ["Terça: abrir e fechar na mesma hora não vale. Para o dia todo, use de 00:00 às 23:59."];
  const withProblems = view({ problems });
  assert.deepEqual(withProblems.problems, problems);
  assert.match(withProblems.live, /^Falta acertar: Terça/);
  const saved = view({ notice: { ok: true, text: "Horário salvo. Os clientes já veem." } });
  assert.equal(saved.live, "Horário salvo. Os clientes já veem.");
  assert.equal(view().live, "");
  assert.equal(view({ listening: true }).live, "Estou ouvindo.");
  const spoken = view({ spoken: { said: "domingo fechado", lines: ["Dom: fechado"], notes: [] } });
  assert.match(spoken.live, /Ainda não foi salvo/);
});

test("a validação é a mesma da tela antiga: mesma hora de abrir e fechar não vale", () => {
  const broken = setShift(fromApi(apiWeek()), 1, 0, { opens: "12:00", closes: "12:00" });
  assert.match(validate(broken)[0], /mesma hora/);
  // a conferência escreve o dia em minúscula ("terça: abrir…"); a tela mostra cada aviso começando por maiúscula
  const shown = view({ problems: validate(broken) });
  assert.match(validate(broken)[0], /^terça:/);
  assert.match(shown.problems[0], /^Terça: abrir e fechar na mesma hora/);
  assert.match(shown.live, /^Falta acertar: Terça:/);
  const fixed = addShift(setClosed(broken, 1, true), 1);
  assert.equal(fixed[1].closed, true, "um dia fechado não ganha turno (a conta é a antiga)");
});

// ---------------------------------------------------------------- falar o horário

test("o que a pessoa falou aparece com o que foi entendido, e nada foi salvo", () => {
  const understood = view({ spoken: { said: "domingo fechado", lines: ["Dom: fechado"], notes: ["Entendi só o domingo."] } });
  assert.equal(understood.spoken.said, "domingo fechado");
  assert.deepEqual(understood.spoken.lines, ["Dom: fechado"]);
  assert.equal(understood.spoken.failed, "");
  assert.equal(understood.dirty, false, "a conta de falar não salva nem marca o servidor");
});

test("quando nada foi entendido a tela diz isso e ensina a falar; quando nada foi ouvido, também", () => {
  const lost = view({ spoken: { said: "abrimos quando dá", lines: [], notes: [] } });
  assert.equal(lost.spoken.failed, "Não entendi nenhum horário. Diga os dias e as horas.");
  const silent = view({ spoken: { said: "", lines: [], notes: [] } });
  assert.equal(silent.spoken.failed, "Não ouvi nada. Diga os dias e as horas.");
});

test("enquanto o celular ouve, mostra as palavras que chegam e esconde a resposta velha", () => {
  const listening = view({ listening: true, heard: "de segunda a sexta", spoken: { said: "antigo", lines: ["Dom: fechado"], notes: [] } });
  assert.deepEqual(listening.listening, { heard: "de segunda a sexta" });
  assert.equal(listening.spoken, null);
  assert.equal(view().listening, null);
});

test("sem horário salvo a dica muda se o celular escuta", () => {
  const none = apiWeek({ configured: false, week: [], open_message: "" });
  assert.match(view({ server: none, canSpeak: true }).noHoursHint, /ou fale/);
  assert.doesNotMatch(view({ server: none, canSpeak: false }).noHoursHint, /fale/);
  assert.equal(view().noHoursHint, "", "com horário salvo não há dica");
});

// ---------------------------------------------------------------- tirar o horário

test("tirar o horário só existe quando há horário salvo, e mostra o primeiro toque", () => {
  assert.equal(view().canRemoveHours, true);
  assert.equal(view({ server: apiWeek({ configured: false, week: [], open_message: "" }) }).canRemoveHours, false);
  assert.equal(view({ removeArmed: true }).removeArmed, true);
});

// ---------------------------------------------------------------- a tela e o container

test("salvar só acontece no botão Salvar horário: falar, descartar e abrir nunca chamam o servidor para gravar", () => {
  const screen = read("painel/HoursScreen.tsx");
  assert.equal([...screen.matchAll(/saveAdminHours\(/g)].length, 1, "uma única gravação dos dias");
  assert.match(screen, /const save = useCallback\(async \(\) => \{[\s\S]*?saveAdminHours\(toBody\(week\)\)/, "ela está dentro de `save`");
  assert.match(screen, /onSave=\{\(\) => void save\(\)\}/, "e só o botão Salvar a chama");
  const understand = screen.match(/const understand = useCallback\([\s\S]*?\n  \);/)[0];
  assert.doesNotMatch(understand, /save|setOrdersPaused|clearAdminHours|fetch/, "entender o que foi falado só preenche a tela");
  assert.ok(!/validate\(/.test(understand), "e nem confere por conta própria");
  assert.match(screen, /if \(found\.length > 0\) \{\s*setProblems\(found\);[\s\S]*?return;\s*\}/, "o que não passa na conferência nunca vai ao servidor");
});

test("a pausa vale na hora, num toque só; tirar o horário pede dois toques", () => {
  const screen = read("painel/HoursScreen.tsx");
  assert.equal([...screen.matchAll(/setOrdersPaused\(/g)].length, 1);
  assert.match(screen, /setOrdersPaused\(!server\.orders_paused\)/, "inverte o que o servidor disse, não o que a tela acha");
  assert.equal([...screen.matchAll(/clearAdminHours\(/g)].length, 1);
  assert.match(screen, /if \(!removeArmed\) \{[\s\S]*?setRemoveArmed\(true\);[\s\S]*?return;\s*\}\s*disarm\(\);\s*void removeHours\(\);/, "o primeiro toque arma e o segundo tira");
  assert.match(screen, /REMOVE_ARM_MS/, "o primeiro toque expira");
});

test("quem muda os dias perde o primeiro toque de tirar, o erro e o aviso velhos", () => {
  const screen = read("painel/HoursScreen.tsx");
  assert.match(screen, /const change = useCallback\(\s*\(next: Day\[\]\) => \{\s*setWeek\(next\);\s*setProblems\(\[\]\);\s*setNotice\(null\);\s*disarm\(\);/);
});

test("a bolinha da tela ouve o horário; tocar nela enquanto ouve é o Pronto", () => {
  const screen = read("painel/HoursScreen.tsx");
  assert.match(screen, /onSpeak=\{\(\) => \(hearing\.current \? finish\(\) : void listen\(\)\)\}/);
  const hours = read("novo/Hours.tsx");
  assert.match(hours, /<VoiceOrb label=\{HOURS_SPEAK\} onPress=\{handlers\.onSpeak\} listening=\{speaking\} \/>/);
  assert.match(hours, /<VoiceOrb label="Falar com o Vem" \/>/, "sem microfone a bolinha é a do painel (que diz que o celular não escuta)");
  assert.match(screen, /patienceMs: DICTATION_PATIENCE_MS/, "o horário é um ditado: pausas não encerram");
  assert.match(screen, /return \(\) => \{\s*alive\.current = false;\s*hearing\.current\?\.cancel\(\);/, "sair da tela desliga o microfone");
});

test("os nomes de botão que as frases citam são os da tela", () => {
  assert.equal(copy.HOURS_SAVE, "Salvar horário");
  assert.match(copy.HOURS_CHECK, /toque em Salvar horário/);
  assert.match(copy.HOURS_NO_HOURS, /toque em Salvar horário/);
  assert.match(copy.HOURS_NO_HOURS_SPEAK, /toque em Salvar horário/);
  assert.match(copy.HOURS_REMOVE_ARMED, /Toque de novo/);
  const hours = read("novo/Hours.tsx");
  for (const name of ["HOURS_SAVE", "HOURS_DONE", "HOURS_CANCEL", "HOURS_DISCARD", "HOURS_RETRY", "HOURS_ADD_SHIFT", "HOURS_COPY_ALL", "HOURS_SPEAK", "HOURS_REMOVE_SHIFT"]) {
    assert.ok([...hours.matchAll(new RegExp(`\\b${name}\\b`, "g"))].length >= 2, `${name} está na tela (importado e usado)`);
  }
});

test("o botão de tirar o turno diz o que faz por escrito, e o nome para o leitor de tela começa igual", () => {
  const removeLabel = view().days[0].shifts[1].removeLabel;
  assert.equal(copy.HOURS_REMOVE_SHIFT(2), "Tirar o turno 2");
  assert.ok(removeLabel.startsWith(copy.HOURS_REMOVE_SHIFT(2)), "o que se vê está dentro do nome falado");
  const hours = read("novo/Hours.tsx");
  assert.match(hours, /\{HOURS_REMOVE_SHIFT\(index \+ 1\)\}/);
  const css = read("novo/novo.css");
  assert.match(css, /\.nv-hours-remove \{[^}]*grid-column: 1 \/ -1/, "o botão tem linha própria: as duas horas ficam com a largura toda e nenhuma é cortada");
  assert.doesNotMatch(css, /has-remove/, "nada de três colunas apertadas");
});

test("os textos do Horário são frases inteiras, sem jargão nem exclamação", () => {
  const all = Object.entries(copy).filter(([name, value]) => name.startsWith("HOURS_") && typeof value === "string");
  assert.ok(all.length > 40);
  for (const [name, value] of all) {
    assert.doesNotMatch(value, /!/, name);
    assert.doesNotMatch(value, /\b(app|login|loading|feedback|dashboard|checkout|template|upload)\b/i, name);
  }
  assert.equal(copy.HOURS_YOU_SAID("domingo fechado"), "Você disse: “domingo fechado”");
});

test("o Horário novo substituiu o antigo na casca: o menu abre a tela nova", () => {
  const shell = read("painel/shellLogic.ts");
  assert.match(shell, /horario: "hours",\n\};/, "horário está entre as telas novas");
  assert.doesNotMatch(read("painel/legacyPanels.tsx"), /HoursPanel/, "a ponte não carrega mais a tela antiga");
  assert.match(read("painel/PanelShell.tsx"), /case "hours":\s*return <HoursScreen key="hours" person=\{person\} onMenu=\{openMenu\} \/>/);
});

test("peças do Horário têm tamanho de dedo e a página de conferência tem todas as situações", () => {
  const css = read("novo/novo.css");
  assert.match(css, /\.nv-field \{[^}]*min-height: 56px/);
  assert.match(css, /\.nv-btn\.is-small \{[^}]*min-height: 44px/);
  assert.match(css, /\.nv-icon-btn \{[^}]*width: 48px/);
  const hours = read("novo/Hours.tsx");
  assert.match(hours, /aria-pressed=\{!day\.closed\}/, "o botão do dia diz se está aberto");
  assert.match(hours, /type="time"/);
  assert.equal([...hours.matchAll(/aria-label=\{shift\.(opens|closes)Label\}/g)].length, 2, "cada campo de hora tem nome para o leitor de tela");
  const preview = read("novo/preview.tsx");
  for (const route of ["horario", "horario-fechado", "horario-pausado", "horario-sem", "horario-ouvindo", "horario-entendi", "horario-nao-entendi", "horario-problema", "horario-salvo", "horario-carregando", "horario-erro"]) {
    assert.match(preview, new RegExp(`"?${route}"?: "`), route);
  }
});
