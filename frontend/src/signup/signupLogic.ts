/**
 * Cadastro do restaurante pela internet: regras puras da tela (sem React).
 *
 * O servidor (backend/signup.py) é quem manda: tudo aqui é conferido de novo lá. Esta parte só poupa
 * a ida e volta quando o erro é óbvio (e-mail sem @, senha curta), o que importa com sinal fraco.
 * As mensagens são as mesmas do servidor, para a pessoa ler a mesma coisa de qualquer lado.
 */

/** Versão dos termos que esta tela mostra. Tem de ser igual à do servidor (backend/signup.py). */
export const TERMS_VERSION = "2026-10-06";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const RESTAURANT_NAME_MAX = 120;
export const OWNER_NAME_MAX = 100;
export const EMAIL_MAX = 200;

export type SignupField =
  | "restaurant_name"
  | "owner_name"
  | "email"
  | "phone"
  | "password"
  | "accept_terms";

/** Ordem em que os campos aparecem na tela: o primeiro com erro recebe o foco. */
export const FIELD_ORDER: SignupField[] = [
  "restaurant_name",
  "owner_name",
  "email",
  "phone",
  "password",
  "accept_terms",
];

export type SignupForm = {
  restaurantName: string;
  ownerName: string;
  email: string;
  phone: string;
  password: string;
  acceptTerms: boolean;
};

export type FieldErrors = Partial<Record<SignupField, string>>;

export const EMPTY_FORM: SignupForm = {
  restaurantName: "",
  ownerName: "",
  email: "",
  phone: "",
  password: "",
  acceptTerms: false,
};

/** Espaços das pontas e repetidos fora (teclado de celular põe espaço no fim e maiúscula no começo). */
export function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// DDDs que existem no Brasil (iguais aos do servidor).
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45,
  46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83,
  84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** Só os dígitos de um texto. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Telefone brasileiro (celular ou fixo) em dígitos com DDI, como o servidor guarda
 * ("5584999991234"). Devolve null se não for um telefone do Brasil.
 */
export function normalizePhone(raw: string): string | null {
  let digits = digitsOnly(raw);
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) return null;
  if (!DDDS.has(Number(digits.slice(0, 2)))) return null;
  if (digits.length === 11 && digits[2] !== "9") return null;
  if (digits.length === 10 && (digits[2] === "0" || digits[2] === "1")) return null;
  return "55" + digits;
}

/**
 * Mostra o telefone arrumado enquanto a pessoa digita: "84999991234" vira "(84) 99999-1234".
 * Tira o 55 do começo só quando já é claramente um número com DDI.
 */
export function formatPhoneInput(raw: string): string {
  let digits = digitsOnly(raw);
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  const area = digits.slice(0, 2);
  const rest = digits.slice(2);
  // celular começa com 9 depois do DDD (5 dígitos antes do hífen); fixo, não (4). Assim o hífen
  // não muda de lugar no meio da digitação.
  const cut = digits[2] === "9" ? 5 : 4;
  if (rest.length <= cut) return `(${area}) ${rest}`;
  return `(${area}) ${rest.slice(0, cut)}-${rest.slice(cut)}`;
}

/** Confere o formulário. Devolve um erro por campo com problema (vazio = pode enviar). */
export function validateSignup(form: SignupForm): FieldErrors {
  const errors: FieldErrors = {};

  const restaurant = cleanText(form.restaurantName);
  if (restaurant.length < 2 || restaurant.length > RESTAURANT_NAME_MAX) {
    errors.restaurant_name = "Digite o nome do restaurante.";
  }

  const owner = cleanText(form.ownerName);
  if (owner.length < 2 || owner.length > OWNER_NAME_MAX) {
    errors.owner_name = "Digite o seu nome.";
  }

  const email = form.email.replace(/\s/g, "");
  if (!EMAIL_RE.test(email) || email.length > EMAIL_MAX) {
    errors.email = "Esse e-mail não parece certo. Exemplo: nome@gmail.com";
  }

  if (form.phone.trim() && normalizePhone(form.phone) === null) {
    errors.phone = "Esse WhatsApp não parece certo. Digite com o DDD.";
  }

  if (form.password.length < PASSWORD_MIN) {
    errors.password = "A senha precisa ter pelo menos 8 letras ou números.";
  } else if (form.password.length > PASSWORD_MAX) {
    errors.password = "A senha é grande demais. Use até 128 caracteres.";
  }

  if (!form.acceptTerms) {
    errors.accept_terms = "Para continuar, aceite os termos de uso.";
  }

  return errors;
}

/** O primeiro campo com erro, na ordem da tela (ou null). */
export function firstErrorField(errors: FieldErrors): SignupField | null {
  return FIELD_ORDER.find((field) => errors[field]) ?? null;
}

/** O que vai ao servidor no cadastro. */
export type SignupBody = {
  restaurant_name: string;
  owner_name: string;
  email: string;
  phone: string;
  password: string;
  accept_terms: boolean;
  terms_version: string;
  website: string;
};

/** Corpo do pedido ao servidor. O campo "website" é a armadilha de robô: sempre vazio para gente. */
export function toRequestBody(form: SignupForm, honeypot = ""): SignupBody {
  return {
    restaurant_name: cleanText(form.restaurantName),
    owner_name: cleanText(form.ownerName),
    email: form.email.replace(/\s/g, "").toLowerCase(),
    phone: form.phone.trim() ? form.phone.trim() : "",
    password: form.password,
    accept_terms: form.acceptTerms,
    terms_version: TERMS_VERSION,
    website: honeypot,
  };
}

/** O campo da tela que o servidor apontou, se for um que existe. */
export function asSignupField(value: unknown): SignupField | null {
  return FIELD_ORDER.includes(value as SignupField) ? (value as SignupField) : null;
}

/**
 * Mensagem para quando o pedido nem chegou ao servidor ou voltou com erro sem texto.
 * `status` 0 = sem rede.
 */
export function fallbackMessage(status: number): string {
  if (status === 0) return "Sem internet agora. Seus dados continuam aqui: tente de novo em instantes.";
  if (status === 429) return "Muitas tentativas. Espere um pouco e tente de novo.";
  if (status === 404) return "O cadastro ainda não está aberto.";
  if (status >= 500) return "O servidor está com problema agora. Tente de novo em alguns minutos.";
  return "Não foi possível cadastrar. Confira os dados e tente de novo.";
}
