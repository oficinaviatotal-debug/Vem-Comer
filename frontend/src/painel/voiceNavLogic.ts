/**
 * A bolinha de voz do painel: entende o que a pessoa disse e diz para onde ir. Só conta, sem React nem rede nem
 * microfone: tests/novo/voiceNavLogic.test.mjs roda isto no Node. O microfone e a fala ficam em `useVoiceNav.ts`.
 *
 * Esta voz abre telas ("pedidos", "mesas", "números") e lê como está o dia ("como está o dia?"). Ela não cria, não muda
 * e não apaga nada: dizer uma palavra errada, no máximo, abre a tela errada, e basta falar de novo. Por isso não pede
 * confirmação. Quem busca os números do dia é `readBriefing.ts`; aqui só se decide que a pessoa fez essa pergunta.
 *
 * Duas regras de honestidade:
 * - só leva às telas que o menu mostra para esta pessoa (`allowed` vem de `shellLogic.allowedViews`); o resto ouve
 *   "não posso abrir isto para você agora", nunca um silêncio;
 * - o que não foi entendido vira uma frase com exemplos reais (as telas dela), nunca um palpite.
 */
import { isManager } from "../nav/navLogic.ts";
import { plainPhraser, type Phraser } from "../novo/phrasing.ts";
import { SAY_BLOCKED, SAY_HELP, SAY_HERE, SAY_NO_EXAMPLES, SAY_OPENING, SAY_UNKNOWN } from "../novo/voiceCopy.ts";

export type VoiceAnswer =
  /** Abrir esta tela e dizer a frase. */
  | { kind: "go"; view: string; say: string }
  /** Ficar onde está e dizer a frase (já está na tela; não pode abrir; pediu ajuda). */
  | { kind: "stay"; say: string }
  /** A pessoa perguntou como está o dia: quem chama busca os números e lê a fala (não há frase pronta). */
  | { kind: "brief" }
  /** Não entendeu: a frase diz o que falar. */
  | { kind: "unknown"; say: string };

/**
 * O que a pessoa disse, em letras minúsculas, sem acento e sem pontuação, com um espaço antes e outro depois: assim
 * " pedidos " só casa com a palavra inteira (e "pedidos de ajuda" casa por inteiro, mas "mesa" não casa dentro de "mesada").
 */
export function normalizeSpeech(text: string | null | undefined): string {
  const plain = String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return ` ${plain} `;
}

type Target = {
  /** O nome da tela no painel (o mesmo do menu). */
  view: string;
  /** Como a pessoa fala essa tela: minúsculas, sem acento. A frase mais comprida que casar é a que vale. */
  says: readonly string[];
  /** Se a pessoa não pode abrir esta tela, a mais parecida que ela pode (a equipe do salão fala "mesa" e vê "Mesas"). */
  instead?: string;
};

/**
 * Todas as telas do menu e como se fala cada uma. Empate de tamanho: vale a que vem primeiro nesta lista.
 * "chamados" sozinho é a mesa chamando; o dono do sistema que quer os pedidos de ajuda diz "chamados de ajuda".
 */
const TARGETS: readonly Target[] = [
  { view: "inicio", says: ["inicio", "hoje", "comeco", "voltar", "tela inicial", "tela principal", "o que falta", "o que fazer", "o que preciso fazer"] },
  {
    view: "pedidos",
    says: [
      "pedido",
      "pedidos",
      "cozinha",
      "fila",
      "fila de pedidos",
      "comanda",
      "comandas",
      "novo pedido",
      "novos pedidos",
      "conferir pix",
      "conferir o pix",
      "confirmar pix",
      "pix para conferir",
    ],
  },
  {
    view: "mesa",
    says: [
      "mesa",
      "abrir mesa",
      "abrir a mesa",
      "atender mesa",
      "atender a mesa",
      "ler qr",
      "ler o qr",
      "ler qr code",
      "ler o qr code",
      "salao",
      "chamado",
      "chamados",
      "chamando",
      "mesa chamando",
      "mesas chamando",
      "chamados da mesa",
      "chamados do salao",
    ],
    instead: "mesas",
  },
  { view: "mesas", says: ["mesas", "qr code", "qr das mesas", "cadastrar mesa", "cadastrar mesas", "imprimir qr", "imprimir o qr"] },
  {
    view: "entregas",
    says: ["entrega", "entregas", "entregador", "entregadores", "motoqueiro", "motoqueiros", "moto boy", "motoboy", "quem esta na rua", "na rua"],
  },
  {
    view: "acerto",
    says: [
      "acerto",
      "acerto de caixa",
      "acertar",
      "acertar o caixa",
      "caixa",
      "fechar caixa",
      "fechar o caixa",
      "dinheiro do motoqueiro",
      "dinheiro dos motoqueiros",
      "dinheiro dos entregadores",
    ],
  },
  {
    view: "assistente",
    says: [
      "assistente",
      "montar cardapio",
      "montar o cardapio",
      "criar cardapio",
      "criar o cardapio",
      "cadastrar cardapio",
      "cadastrar o cardapio",
      "novo cardapio",
      "falar os pratos",
      "cardapio por voz",
      "cardapio por foto",
      "foto do cardapio",
      "tirar foto do cardapio",
      "fotografar o cardapio",
    ],
  },
  {
    view: "produtos",
    says: ["produto", "produtos", "prato", "pratos", "cardapio", "preco", "precos", "mudar preco", "mudar o preco", "foto", "fotos", "esgotou", "esgotado", "acabou"],
  },
  { view: "categorias", says: ["categoria", "categorias", "secao", "secoes", "grupos do cardapio"] },
  {
    view: "dashboard",
    says: ["numero", "numeros", "venda", "vendas", "faturamento", "lucro", "negocio", "meu negocio", "seu negocio", "resumo", "relatorio"],
  },
  { view: "custos", says: ["custo", "custos", "cmv", "ficha tecnica", "custo do prato", "custo dos pratos"] },
  { view: "pagamento", says: ["pagamento", "pix", "chave pix", "receber pix", "receber por pix"] },
  { view: "meulink", says: ["link", "meu link", "link do cardapio", "compartilhar", "divulgar", "whatsapp", "instagram"] },
  {
    view: "horario",
    says: ["horario", "horarios", "pausar", "pausar a loja", "pausar pedidos", "abrir a loja", "fechar a loja", "hora de abrir", "hora de fechar"],
  },
  {
    view: "entrega",
    says: ["regiao", "regioes", "regioes de entrega", "taxa de entrega", "taxas de entrega", "taxa", "taxas", "retirada", "bairro", "bairros", "frete"],
  },
  { view: "marca", says: ["marca", "minha marca", "logomarca", "logo", "cores"] },
  { view: "usuarios", says: ["equipe", "funcionario", "funcionarios", "colaboradores", "usuario", "usuarios", "quem entra"] },
  { view: "plano", says: ["plano", "meu plano", "pagar o plano", "pagar plano", "mensalidade", "vencimento"] },
  { view: "aprovacoes", says: ["aprovacao", "aprovacoes", "aprovar", "o que espera meu aval"] },
  { view: "assinaturas", says: ["assinaturas"] },
  { view: "ajuda", says: ["chamados de ajuda", "pedidos de ajuda", "chamados dos donos"] },
];

/**
 * Perguntas sobre o dia, que se respondem lendo os números e não abrindo tela. Frase mais comprida que a de uma tela
 * ganha dela ("resumo do dia" lê; "resumo" abre os números); "vendas de hoje" continua abrindo os números.
 */
const BRIEF_SAYS: readonly string[] = [
  "como esta o dia",
  "como esta hoje",
  "como esta indo",
  "como estamos",
  "como estou",
  "como foi o dia",
  "como estao as vendas",
  "resumo do dia",
  "me da um resumo",
  "me de um resumo",
  "me atualiza",
  "me atualize",
  "novidades",
  "o que esta acontecendo",
  "tem pedido",
  "tem pedidos",
  "quantos pedidos",
  "tem mesa chamando",
  "quanto vendi",
  "quanto vendi hoje",
  "quanto ja vendi",
  "quanto eu vendi",
  "quanto eu ja vendi",
  "quanto vendemos",
  "quanto faturei",
];

/** Quem pede ajuda ouve o que pode dizer. */
const HELP_SAYS: readonly string[] = ["ajuda", "socorro", "comandos", "o que posso falar", "o que posso dizer", "como funciona", "o que voce faz"];

type Spoken = { article: "o" | "a" | "os" | "as"; noun: string };

/** Como a frase fala cada tela, com o artigo, para "Abrindo os pedidos" e "Você já está nos pedidos" saírem certos. */
function spokenParts(view: string, role: string | null | undefined): Spoken {
  switch (view) {
    case "inicio":
      return { article: "o", noun: "Hoje" };
    case "pedidos":
      return String(role ?? "").toUpperCase() === "KITCHEN" ? { article: "a", noun: "fila da cozinha" } : { article: "os", noun: "pedidos" };
    case "mesa":
      return { article: "a", noun: "tela de abrir mesa" };
    case "mesas":
      return { article: "as", noun: "mesas" };
    case "entregas":
      return { article: "as", noun: "entregas" };
    case "acerto":
      return { article: "o", noun: "acerto de caixa" };
    case "assistente":
      return { article: "o", noun: "assistente do cardápio" };
    case "produtos":
      return { article: "os", noun: "produtos" };
    case "categorias":
      return { article: "as", noun: "categorias" };
    case "dashboard":
      return isManager(role) ? { article: "os", noun: "números do negócio" } : { article: "o", noun: "resumo" };
    case "custos":
      return { article: "os", noun: "custos" };
    case "pagamento":
      return { article: "o", noun: "pagamento" };
    case "meulink":
      return { article: "o", noun: "seu link" };
    case "horario":
      return { article: "o", noun: "horário" };
    case "entrega":
      return { article: "as", noun: "regiões de entrega" };
    case "marca":
      return { article: "a", noun: "marca" };
    case "usuarios":
      return { article: "a", noun: "equipe" };
    case "plano":
      return { article: "o", noun: "plano" };
    case "aprovacoes":
      return { article: "as", noun: "aprovações" };
    case "assinaturas":
      return { article: "as", noun: "assinaturas" };
    case "ajuda":
      return { article: "os", noun: "chamados de ajuda" };
    default:
      return { article: "a", noun: "tela" };
  }
}

/** "os pedidos", "o Hoje", "as mesas": para depois de "Abrindo" e "Não posso abrir". */
export function spokenName(view: string, role: string | null | undefined): string {
  const { article, noun } = spokenParts(view, role);
  return `${article} ${noun}`;
}

/** "nos pedidos", "no Hoje", "nas mesas": para depois de "Você já está". */
export function spokenIn(view: string, role: string | null | undefined): string {
  const { article, noun } = spokenParts(view, role);
  return `${{ o: "no", a: "na", os: "nos", as: "nas" }[article]} ${noun}`;
}

/** Como a pessoa fala a tela quando a frase dá exemplos ("pedidos", "mesas"). Só as telas que valem como exemplo. */
const EXAMPLE_WORDS: ReadonlyArray<readonly [string, string]> = [
  ["pedidos", "pedidos"],
  ["mesa", "abrir mesa"],
  ["mesas", "mesas"],
  ["entregas", "entregas"],
  ["acerto", "acerto de caixa"],
  ["produtos", "produtos"],
  ["assistente", "montar cardápio"],
  ["dashboard", "números"],
  ["inicio", "início"],
];

/**
 * Até três exemplos do que esta pessoa pode dizer agora, das telas que ela abre e menos a que já está aberta. Com um
 * `phrase` de verdade os exemplos andam pela lista a cada vez (não são sempre os mesmos três); sem ele, os três primeiros.
 */
export function examplesFor(allowed: readonly string[], current: string, phrase: Phraser = plainPhraser): string {
  const words = EXAMPLE_WORDS.filter(([view]) => allowed.includes(view) && view !== current).map(([, said]) => said);
  const chosen = phrase.window("voz.exemplos", words, 3);
  if (chosen.length === 0) return "";
  if (chosen.length === 1) return chosen[0];
  return `${chosen.slice(0, -1).join(", ")} ou ${chosen[chosen.length - 1]}`;
}

/** A frase mais comprida (em letras) de `says` que aparece em `text`; 0 se nenhuma. */
function bestMatch(text: string, says: readonly string[]): number {
  let best = 0;
  for (const phrase of says) {
    if (phrase.length > best && text.includes(` ${phrase} `)) best = phrase.length;
  }
  return best;
}

export type VoiceInput = {
  /** O que o celular ouviu. */
  transcript: string;
  role: string | null | undefined;
  /** As telas que o menu mostra a esta pessoa agora (`shellLogic.allowedViews`). */
  allowed: readonly string[];
  /** A tela aberta agora. */
  current: string;
  /** Quem escolhe a forma de dizer cada frase (sem repetir, mais curta com o uso). Sem ele, sempre a forma de referência. */
  phrase?: Phraser;
};

/** O que fazer com o que a pessoa disse. */
export function interpretVoiceNav(input: VoiceInput): VoiceAnswer {
  const text = normalizeSpeech(input.transcript);
  const phrase = input.phrase ?? plainPhraser;
  // Os exemplos só são contados quando a frase de fato os usa (senão a lista andaria à toa).
  const examples = () => examplesFor(input.allowed, input.current, phrase);

  type Hit = { view: string; asked: string; size: number; order: number };
  const hits: Hit[] = [];
  TARGETS.forEach((target, order) => {
    const size = bestMatch(text, target.says);
    if (size === 0) return;
    // A tela que a pessoa não abre vira a parecida que ela abre (a equipe do salão fala "mesa" e vê "Mesas").
    const view = !input.allowed.includes(target.view) && target.instead && input.allowed.includes(target.instead) ? target.instead : target.view;
    hits.push({ view, asked: target.view, size, order });
  });

  const help = bestMatch(text, HELP_SAYS);
  const brief = bestMatch(text, BRIEF_SAYS);
  // Entre as telas que a pessoa abre vale a de frase mais comprida; só sem nenhuma delas se fala de uma que ela não abre.
  const open = hits.filter((hit) => input.allowed.includes(hit.view));
  const pool = open.length > 0 ? open : hits;
  pool.sort((a, b) => b.size - a.size || a.order - b.order);
  const top = pool[0];

  if (brief > 0 && (!top || brief > top.size) && brief >= help) return { kind: "brief" };
  if (help > 0 && (!top || help > top.size)) {
    const some = examples();
    return { kind: "stay", say: some ? phrase.say(SAY_HELP, some) : phrase.say(SAY_NO_EXAMPLES) };
  }
  if (!top) {
    const some = examples();
    return { kind: "unknown", say: some ? phrase.say(SAY_UNKNOWN, some) : phrase.say(SAY_NO_EXAMPLES) };
  }

  if (!input.allowed.includes(top.view)) return { kind: "stay", say: phrase.say(SAY_BLOCKED, spokenName(top.asked, input.role)) };
  if (top.view === input.current) return { kind: "stay", say: phrase.say(SAY_HERE, spokenIn(top.view, input.role)) };
  return { kind: "go", view: top.view, say: phrase.say(SAY_OPENING, spokenName(top.view, input.role)) };
}

/** Os nomes de tela que a voz sabe abrir (para o teste conferir com o menu). */
export function voiceViews(): string[] {
  return TARGETS.map((target) => target.view);
}

/** Todas as frases que a voz entende (para o teste conferir que estão em letras minúsculas, sem acento). */
export function voicePhrases(): string[] {
  return [...TARGETS.flatMap((target) => target.says), ...HELP_SAYS, ...BRIEF_SAYS];
}

/** Quanto tempo a resposta fica na tela: o tempo de ler, com um mínimo (8 s) e um máximo (20 s). */
export function captionMs(text: string): number {
  const read = String(text ?? "").length * 70;
  return Math.max(8000, Math.min(20000, read));
}
