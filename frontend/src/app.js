const products = [
  {
    id: 1,
    name: "Hambúrguer da Casa",
    description: "Pão, carne, queijo e molho especial.",
    price: 24.90
  },
  {
    id: 2,
    name: "Batata Frita",
    description: "Porção crocante.",
    price: 12.90
  },
  {
    id: 3,
    name: "Refrigerante",
    description: "Lata 350ml.",
    price: 6.00
  }
];

const cart = [];

function money(value) {
  return value.toFixed(2).replace(".", ",");
}

function renderMenu(list = products) {
  document.getElementById("menu").innerHTML = list.map(product => `
    <article class="product">
      <div>
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <strong>R$ ${money(product.price)}</strong>
      </div>

      <button onclick="addToCart(${product.id})">
        + Adicionar
      </button>
    </article>
  `).join("");
}

function addToCart(id) {
  const product = products.find(item => item.id === id);
  const item = cart.find(item => item.id === id);

  if (item) {
    item.quantity++;
  } else {
    cart.push({
      ...product,
      quantity: 1
    });
  }

  renderCart();
}

function removeFromCart(id) {
  const item = cart.find(item => item.id === id);

  if (!item) return;

  item.quantity--;

  if (item.quantity === 0) {
    const index = cart.findIndex(item => item.id === id);
    cart.splice(index, 1);
  }

  renderCart();
}

function renderCart() {
  const cartItems = document.getElementById("cartItems");
  const checkout = document.getElementById("checkout");

  cartItems.innerHTML = cart.length
    ? cart.map(item => `
      <div class="cartItem">
        <span>
          ${item.name}<br>
          ${item.quantity}x R$ ${money(item.price)}
        </span>

        <button onclick="removeFromCart(${item.id})">−</button>
        <button onclick="addToCart(${item.id})">+</button>
      </div>
    `).join("")
    : "<p>Seu carrinho está vazio.</p>";

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  document.getElementById("total").textContent = money(total);
  checkout.disabled = cart.length === 0;
}

function checkout() {
  if (!cart.length) return;

  document.getElementById("feedback").classList.remove("hidden");

  alert("Pedido criado! A próxima etapa será conectar o pagamento Pix.");
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

document.getElementById("search").addEventListener("input", event => {
  const term = event.target.value.toLowerCase();

  renderMenu(
    products.filter(product =>
      `${product.name} ${product.description}`
        .toLowerCase()
        .includes(term)
    )
  );
});

renderMenu();
renderCart();