const API_URL = "/api";

const openMenuButton = document.querySelector("#open-menu");
const feedbackForm = document.querySelector("#feedback-form");
const feedbackMessage = document.querySelector("#feedback-message");

openMenuButton.addEventListener("click", async () => {
  const response = await fetch(`${API_URL}/menu`);

  if (!response.ok) {
    feedbackMessage.textContent = "Não foi possível carregar o cardápio.";
    return;
  }

  const menu = await response.json();

  console.log(menu);
});

feedbackForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(feedbackForm);

  const feedback = {
    food: formData.get("food"),
    service: formData.get("service"),
    delivery: formData.get("delivery"),
    comment: formData.get("comment")
  };

  const response = await fetch(`${API_URL}/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(feedback)
  });

  if (!response.ok) {
    feedbackMessage.textContent = "Não foi possível enviar o feedback.";
    return;
  }

  feedbackForm.reset();
  feedbackMessage.textContent = "Feedback enviado. Obrigado!";
});