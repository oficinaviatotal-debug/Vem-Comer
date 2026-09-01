const API_URL = "/api";

export async function getMenu(slug: string) {
  const response = await fetch(`${API_URL}/menu/${slug}`);

  if (!response.ok) {
    throw new Error("Não foi possível carregar o cardápio.");
  }

  return response.json();
}

export async function sendFeedback(data: {
  company_id: string;
  order_id?: string;
  food?: string;
  service?: string;
  delivery?: string;
  comment?: string;
}) {
  const response = await fetch(`${API_URL}/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error("Não foi possível enviar o feedback.");
  }

  return response.json();
}