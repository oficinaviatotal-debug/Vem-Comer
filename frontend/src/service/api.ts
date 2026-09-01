const API_URL = 'https://github.dev';

export async function fetchCompany(companyId: string) {
  const response = await fetch(`${API_URL}/companies/${companyId}`);
  if (!response.ok) throw new Error('Falha ao buscar estabelecimento');
  return response.json();
}

export async function fetchProducts(companyId: string) {
  const response = await fetch(`${API_URL}/companies/${companyId}/products`);
  if (!response.ok) throw new Error('Falha ao buscar produtos');
  return response.json();
}
