function openMenu() {
  document.getElementById("feedback").classList.remove("hidden");
}

function sendFeedback(type) {
  const comment = document.getElementById("comment").value;

  console.log({
    type,
    comment,
    date: new Date().toISOString()
  });

  alert("Obrigado pelo feedback!");
}