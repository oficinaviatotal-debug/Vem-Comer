const currentHost = window.location.hostname;
const apiHost = currentHost.replace("-5174.", "-5000.");
export const API_URL = `https://${apiHost}/api`;


export async function fetchCompany(companyId: string) {
  const response = await fetch(`${API_URL}/companies/${companyId}`);

  if (!response.ok) {
    throw new Error("Falha ao buscar estabelecimento");
  }

  return response.json();
}

export async function fetchProducts(companyId: string) {
  const response = await fetch(`${API_URL}/companies/${companyId}/products`);

  if (!response.ok) {
    throw new Error("Falha ao buscar produtos");
  }

  return response.json();
}

export async function fetchMenus(companyId: string) {
  const response = await fetch(`${API_URL}/companies/${companyId}/menus`);

  if (!response.ok) {
    throw new Error("Falha ao buscar categorias");
  }

  return response.json();
}

export async function createOrder(
  companyId: string,
  customerName: string,
  totalPrice: number,
  items: unknown[]
) {
  const response = await fetch(`${API_URL}/companies/${companyId}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customer_name: customerName,
      total_price: totalPrice,
      items,
    }),
  });

  if (!response.ok) {
    throw new Error("Falha ao criar pedido");
  }

  return response.json();
}

export async function createFeedback(
  companyId: string,
  food: string,
  service: string,
  delivery: string,
  comment: string
) {
  const response = await fetch(
    `${API_URL}/companies/${companyId}/feedbacks`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        food,
        service,
        delivery,
        comment,
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Falha ao enviar feedback");
  }

  return response.json();
}
export async function fetchOrder(orderId: string) {
  const response = await fetch(`${API_URL}/orders/${orderId}`);

  if (!response.ok) {
    throw new Error("Falha ao buscar pedido");
  }

  return response.json();
}