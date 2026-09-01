const API_URL = "https://organic-space-winner-vxprqwv646vhrvp-5000.app.github.dev/api/companies/e63e3538-e71e-4921-baa7-c4ce755a27ed";

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