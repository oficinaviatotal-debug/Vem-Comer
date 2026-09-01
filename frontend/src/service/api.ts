const API_URL = "https://organic-space-winner-vxprqwv646vhrvp-5000.app.github.dev/api";

export async function healthCheck() {
  const response = await fetch(`${API_URL}/health`);

  if (!response.ok) {
    throw new Error("API indisponível");
  }

  return response.json();
}