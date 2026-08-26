(function () {
  const root =
    document.querySelector("[data-fep-block]") ||
    document.querySelector("[data-fep-embed]");

  if (!root) return;

  const DEFAULT_ROUTE = root.dataset.fepDefaultRoute || "where_needed_most";
  const INTENT_VERSION = root.dataset.fepIntentVersion || "fep-intent-v1";

  const ATTRIBUTES = {
    version: "_Bravvi FEP Intent Version",
    route: "_Bravvi FEP Route Preference",
    followUp: "_Bravvi FEP Update Requested",
    source: "_Bravvi FEP Intent Source",
  };

  const ROUTES = {
    where_needed_most: {
      label: "Where it is needed most",
      description: "Let the current FEP program route eligible value where verified need and policy allow.",
    },
    work_enablement: {
      label: "Work enablement",
      description: "Prefer verified work essentials, tools, training, or capacity support.",
    },
    community_support: {
      label: "Community support",
      description: "Prefer verified local or community support projects.",
    },
    environment_restoration: {
      label: "Environment restoration",
      description: "Prefer eligible cleanup, repair, or restoration work.",
    },
  };

  let locked = false;

  async function getCart() {
    const response = await fetch("/cart.js", {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`cart read failed: ${response.status}`);
    return response.json();
  }

  function currentRoute(cart) {
    const value = cart.attributes?.[ATTRIBUTES.route];
    return ROUTES[value] ? value : DEFAULT_ROUTE;
  }

  function followUpRequested(cart) {
    return cart.attributes?.[ATTRIBUTES.followUp] === "yes";
  }

  function routeOption(value, checked) {
    const route = ROUTES[value];
    return `
      <label class="fep-match__route ${checked ? "is-selected" : ""}">
        <input type="radio" name="fep-route" value="${value}" ${checked ? "checked" : ""}>
        <span>
          <strong>${route.label}</strong>
          <em>${route.description}</em>
        </span>
      </label>
    `;
  }

  function selectedRoute(mount) {
    return mount.querySelector('input[name="fep-route"]:checked')?.value || DEFAULT_ROUTE;
  }

  async function savePreference(mount) {
    if (locked) return;
    locked = true;
    mount.classList.add("is-loading");
    const status = mount.querySelector("[data-fep-status]");

    try {
      const route = selectedRoute(mount);
      const followUp = Boolean(mount.querySelector("[data-fep-followup]")?.checked);
      const response = await fetch("/cart/update.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          attributes: {
            [ATTRIBUTES.version]: INTENT_VERSION,
            [ATTRIBUTES.route]: route,
            [ATTRIBUTES.followUp]: followUp ? "yes" : "no",
            [ATTRIBUTES.source]: "shopify_theme_cart",
          },
        }),
      });
      if (!response.ok) throw new Error(`preference save failed: ${response.status}`);
      if (status) status.textContent = "Preference saved. No contribution or reward value was created.";
    } catch (error) {
      console.error("Bravvi FEP preference save failed", error);
      if (status) status.textContent = "Preference could not be saved. Your cart total was not changed.";
    } finally {
      locked = false;
      mount.classList.remove("is-loading");
    }
  }

  async function clearPreference(mount) {
    if (locked) return;
    locked = true;
    mount.classList.add("is-loading");
    const status = mount.querySelector("[data-fep-status]");

    try {
      const response = await fetch("/cart/update.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          attributes: {
            [ATTRIBUTES.version]: INTENT_VERSION,
            [ATTRIBUTES.route]: "none",
            [ATTRIBUTES.followUp]: "no",
            [ATTRIBUTES.source]: "shopify_theme_cart",
          },
        }),
      });
      if (!response.ok) throw new Error(`preference clear failed: ${response.status}`);
      mount.querySelectorAll('input[name="fep-route"]').forEach((input) => {
        input.checked = false;
        input.closest(".fep-match__route")?.classList.remove("is-selected");
      });
      const followUp = mount.querySelector("[data-fep-followup]");
      if (followUp) followUp.checked = false;
      if (status) status.textContent = "No impact preference selected. Your cart total was not changed.";
    } catch (error) {
      console.error("Bravvi FEP preference clear failed", error);
      if (status) status.textContent = "Preference could not be cleared. Your cart total was not changed.";
    } finally {
      locked = false;
      mount.classList.remove("is-loading");
    }
  }

  async function renderFep() {
    const mount = document.querySelector("[data-fep-block]");
    if (!mount) return;

    try {
      const cart = await getCart();
      if (!cart.items || !cart.items.length) {
        mount.innerHTML = "";
        return;
      }

      const route = currentRoute(cart);
      const followUp = followUpRequested(cart);
      const hasPreference = ROUTES[cart.attributes?.[ATTRIBUTES.route]] != null;

      mount.innerHTML = `
        <section class="fep-match" data-fep-match-ui aria-label="Bravvi FEP impact preference">
          <div class="fep-match__topline">
            <span>Bravvi · FEP</span>
            <span>Preference only</span>
          </div>

          <div class="fep-match__headline">What would you like this purchase to support?</div>

          <p class="fep-match__body">
            Choose an impact preference. This does not add a charge, create Rewards, reserve funding, or allocate money. If the settled order is eligible, the server-side FEP program and its current rules determine any economic effect.
          </p>

          <div class="fep-match__routes" aria-label="Choose an impact preference">
            ${Object.keys(ROUTES).map((value) => routeOption(value, route === value && hasPreference)).join("")}
          </div>

          <label class="fep-match__followup">
            <input type="checkbox" data-fep-followup ${followUp ? "checked" : ""}>
            <span>Show me verified updates if this order later creates eligible impact.</span>
          </label>

          <div class="fep-match__actions">
            <button type="button" class="fep-match__button" data-fep-save>
              <span>Save preference</span>
            </button>
            ${hasPreference ? '<button type="button" class="fep-match__remove" data-fep-clear>No preference</button>' : ""}
          </div>

          <p class="fep-match__body" data-fep-status aria-live="polite">
            Economic value is created only from verified server-side events after the applicable settlement and program checks.
          </p>

          <div class="fep-match__footer">
            <span>Preference → verified order event → current program rules → auditable FEP/Rewards record.</span>
            <a href="/pages/fep-mission">Learn more</a>
          </div>
        </section>
      `;

      mount.querySelectorAll('input[name="fep-route"]').forEach((input) => {
        input.addEventListener("change", () => {
          mount.querySelectorAll(".fep-match__route").forEach((label) => label.classList.remove("is-selected"));
          input.closest(".fep-match__route")?.classList.add("is-selected");
        });
      });
      mount.querySelector("[data-fep-save]")?.addEventListener("click", () => savePreference(mount));
      mount.querySelector("[data-fep-clear]")?.addEventListener("click", () => clearPreference(mount));
    } catch (error) {
      console.error("Bravvi FEP preference render failed", error);
      mount.innerHTML = `
        <section class="fep-match" aria-label="Bravvi FEP impact preference unavailable">
          <div class="fep-match__headline">Impact preference is unavailable right now.</div>
          <p class="fep-match__body">Checkout can continue normally. Your cart total and Rewards are unchanged.</p>
        </section>
      `;
    }
  }

  renderFep();
})();
