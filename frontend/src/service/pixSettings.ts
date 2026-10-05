/**
 * Rules for the "Pagamento" screen of the restaurant panel.
 *
 * Pure logic, no screens: tests/customer/pixSettings.test.mjs runs it in Node.
 * The server checks everything again (key digits, name, city, password), so
 * these checks only catch an empty field before the request is sent.
 */

export type PixKeyType = "cpf" | "cnpj" | "phone" | "email" | "random";

export const PIX_KEY_TYPES: { value: PixKeyType; label: string; placeholder: string }[] = [
  { value: "cpf", label: "CPF", placeholder: "000.000.000-00" },
  { value: "cnpj", label: "CNPJ", placeholder: "00.000.000/0000-00" },
  { value: "phone", label: "Celular", placeholder: "(84) 99999-9999" },
  { value: "email", label: "E-mail", placeholder: "nome@empresa.com.br" },
  { value: "random", label: "Chave aleatória", placeholder: "123e4567-e89b-12d3-a456-426614174000" },
];

export function keyTypeLabel(value: string | null | undefined): string {
  return PIX_KEY_TYPES.find((type) => type.value === value)?.label ?? "";
}

export function keyPlaceholder(value: string): string {
  return PIX_KEY_TYPES.find((type) => type.value === value)?.placeholder ?? "";
}

export type PixForm = {
  key_type: string;
  key: string;
  receiver_name: string;
  city: string;
  password: string;
};

/** The first thing missing in the form, in plain words, or "" when it can be sent. */
export function pixFormProblem(form: PixForm): string {
  if (!PIX_KEY_TYPES.some((type) => type.value === form.key_type)) return "Escolha o tipo da chave Pix.";
  if (!form.key.trim()) return "Escreva a chave Pix.";
  if (!form.receiver_name.trim()) return "Escreva o nome do recebedor, como aparece no seu banco.";
  if (!form.city.trim()) return "Escreva a cidade do restaurante.";
  if (!form.password) return "Escreva a sua senha para confirmar. Ela protege a sua chave.";
  return "";
}

/** Turning Pix off also asks for the password. */
export function removeProblem(password: string): string {
  return password ? "" : "Escreva a sua senha para desligar o Pix.";
}
