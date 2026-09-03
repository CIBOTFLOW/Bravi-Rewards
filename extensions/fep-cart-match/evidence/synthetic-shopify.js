(function () {
  const DOLLAR_VARIANT = "8721388634166";
  const CENT_VARIANT = "8720793665590";
  let sequence = 0;
  let failNextAdd = false;
  let cart = {
    currency: "USD",
    items: [{
      key: "synthetic-merchandise",
      variant_id: "synthetic-merchandise",
      title: "Luzione sample item",
      quantity: 1,
      final_line_price: 10_000,
      properties: {},
    }],
  };

  window.Shopify = { routes: { root: "/" } };

  function copyCart() {
    const result = structuredClone(cart);
    result.total_price = result.items.reduce((sum, item) => sum + item.final_line_price, 0);
    return result;
  }

  function response(body) {
    return Promise.resolve({ ok: true, status: 200, json: async () => structuredClone(body) });
  }

  function errorResponse(status, message) {
    return Promise.resolve({
      ok: false,
      status,
      json: async () => ({ description: message }),
    });
  }

  window.fetch = async function syntheticFetch(input, options = {}) {
    const path = new URL(String(input), window.location.href).pathname;
    if (path.endsWith("/cart.js")) return response(copyCart());

    const request = options.body ? JSON.parse(options.body) : {};
    if (path.endsWith("/cart/update.js")) {
      cart.items = cart.items.filter((item) => request.updates?.[item.key] !== 0);
      renderSummary("Contribution removed from the synthetic cart.");
      return response(copyCart());
    }
    if (path.endsWith("/cart/add.js")) {
      if (failNextAdd) {
        failNextAdd = false;
        renderSummary("Synthetic add failure returned. Recovery should preserve the previous contribution.");
        return errorResponse(422, "Synthetic cart rejected the requested replacement.");
      }
      for (const item of request.items || []) {
        const variantId = String(item.id);
        const unitMinor = variantId === DOLLAR_VARIANT ? 100 : variantId === CENT_VARIANT ? 1 : 0;
        cart.items.push({
          key: `synthetic-contribution-${sequence += 1}`,
          variant_id: variantId,
          title: "FEP Movement contribution",
          quantity: Number(item.quantity),
          final_line_price: unitMinor * Number(item.quantity),
          properties: item.properties || {},
        });
      }
      renderSummary("Priced contribution added to the synthetic cart.");
      return response({ items: copyCart().items, sections: {} });
    }
    return Promise.resolve({ ok: false, status: 404, json: async () => ({ message: "Synthetic route not found" }) });
  };

  function money(minor) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(minor / 100);
  }

  function renderSummary(message) {
    const snapshot = copyCart();
    const lines = document.querySelector("[data-synthetic-cart-lines]");
    const total = document.querySelector("[data-synthetic-total]");
    const events = document.querySelector("[data-synthetic-events]");
    if (!lines || !total) return;
    lines.innerHTML = snapshot.items.map((item) => `
      <div class="line">
        <span>${item.title}<br><span class="muted">Quantity ${item.quantity}</span></span>
        <strong>${money(item.final_line_price)}</strong>
      </div>`).join("");
    total.textContent = money(snapshot.total_price);
    if (events && message) events.textContent = message;
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderSummary();
    const mount = document.querySelector("[data-fep-block]");
    document.querySelector("[data-synthetic-kill-switch]")?.addEventListener("change", (event) => {
      document.querySelectorAll("[data-fep-block], [data-fep-embed], [data-fep-drawer-mount]")
        .forEach((surface) => {
          surface.dataset.fepEnabled = String(event.currentTarget.checked);
        });
      document.documentElement.dispatchEvent(new CustomEvent("shopify:cart:lines-update", {
        bubbles: true,
        detail: { cart: copyCart(), source: "synthetic-control" },
      }));
      renderSummary(event.currentTarget.checked
        ? "G0 contribution surface enabled."
        : "Kill switch blocked new additions; any existing contribution remains removable.");
    });
    document.querySelector("[data-synthetic-fail-next-add]")?.addEventListener("click", () => {
      failNextAdd = true;
      renderSummary("The next synthetic add will fail once so the recovery path can be verified.");
    });
  });

  window.__braviB05Evidence = Object.freeze({
    snapshot: () => structuredClone(copyCart()),
    effects: Object.freeze({
      providerCalls: 0,
      journalWrites: 0,
      canonicalReadbacks: 0,
      effectPosture: "NO_EFFECT",
    }),
  });
})();
