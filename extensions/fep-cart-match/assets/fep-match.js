(function () {
  const root =
    document.querySelector("[data-fep-block]") ||
    document.querySelector("[data-fep-embed]");

  if (!root) {
    console.warn("FEP root not found");
    return;
  }

  const FEP_CENT_VARIANT_ID = Number(root.dataset.fepCentVariantId || 8720793665590);
  const FEP_DOLLAR_VARIANT_ID = Number(root.dataset.fepDollarVariantId || 8721388634166);
  const DEFAULT_ROUTE = root.dataset.fepDefaultRoute || "small_business_capacity";

  if (!FEP_CENT_VARIANT_ID || !FEP_DOLLAR_VARIANT_ID) {
    console.warn("FEP variant IDs missing", {
      cent: root.dataset.fepCentVariantId,
      dollar: root.dataset.fepDollarVariantId,
    });
    return;
  }

  let locked = false;

  const ROUTES = {
    small_business_capacity: "Small business capacity",
    community_projects: "Community projects",
    environment_restoration: "Environment restoration",
  };

  const RETURN_OPTIONS = {
    continue_rewards: "Keep eligible value in Bravi Rewards",
    refund_unused: "Return unused eligible contribution",
    ask_me: "Ask before reallocating unused value",
  };

  function money(cents) {
    return "$" + (cents / 100).toFixed(2);
  }

  async function getCart() {
    const response = await fetch("/cart.js", {
      headers: { Accept: "application/json" },
    });
    return response.json();
  }

  function isFepItem(item) {
    const title = String(item.title || "").toLowerCase();

    return (
      Number(item.variant_id) === FEP_CENT_VARIANT_ID ||
      Number(item.variant_id) === FEP_DOLLAR_VARIANT_ID ||
      title.includes("fep match contribution")
    );
  }

  function subtotalWithoutFep(cart) {
    return cart.items
      .filter((item) => !isFepItem(item))
      .reduce((sum, item) => sum + Number(item.final_line_price || 0), 0);
  }

  function contributionCents(cart, rate) {
    const subtotal = subtotalWithoutFep(cart);
    if (subtotal <= 0) return 0;
    return Math.round(subtotal * rate);
  }

  function splitCents(totalCents) {
    return {
      dollars: Math.floor(totalCents / 100),
      cents: totalCents % 100,
    };
  }

  function existingFepItems(cart) {
    return cart.items.filter(isFepItem);
  }

  async function removeFepItems(cart) {
    const items = existingFepItems(cart);

    for (const item of items) {
      await fetch("/cart/change.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ id: item.key, quantity: 0 }),
      });
    }
  }

  function getSelectedRoute() {
    return (
      document.querySelector('input[name="fep-route"]:checked')?.value ||
      DEFAULT_ROUTE ||
      "small_business_capacity"
    );
  }

  function getSelectedReturnPreference() {
    return (
      document.querySelector('input[name="fep-return"]:checked')?.value ||
      "continue_rewards"
    );
  }

  function getFollowUpRequested() {
    return Boolean(document.querySelector("[data-fep-followup]")?.checked);
  }

  async function addFep(rate) {
    if (locked) return;
    locked = true;
    root.classList.add("is-loading");

    try {
      const cart = await getCart();
      const totalCents = contributionCents(cart, rate);

      if (!totalCents) {
        locked = false;
        root.classList.remove("is-loading");
        return;
      }

      const route = getSelectedRoute();
      const returnPreference = getSelectedReturnPreference();
      const followUp = getFollowUpRequested();
      const parts = splitCents(totalCents);

      await removeFepItems(cart);

      const properties = {
        "_FEP Match": rate === 0.05 ? "5%" : "2.5%",
        "_FEP Contribution": money(totalCents),
        "_Bravi Rewards Route": ROUTES[route] || route,
        "_Return Preference": RETURN_OPTIONS[returnPreference] || returnPreference,
        "_Fulfillment Update": followUp ? "Requested" : "Not requested",
        "_Matched by": "Luzione",
        "_FEP Status": "Pending Bravi Rewards allocation after order confirmation",
        "_FEP Model": "Capacity return / service fulfillment",
      };

      const items = [];

      if (parts.dollars > 0) {
        items.push({
          id: FEP_DOLLAR_VARIANT_ID,
          quantity: parts.dollars,
          properties,
        });
      }

      if (parts.cents > 0) {
        items.push({
          id: FEP_CENT_VARIANT_ID,
          quantity: parts.cents,
          properties,
        });
      }

      if (!items.length) {
        locked = false;
        root.classList.remove("is-loading");
        return;
      }

      const addResponse = await fetch("/cart/add.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ items }),
      });

      const addResult = await addResponse.json();

      if (!addResponse.ok) {
        console.error("FEP cart add rejected", addResult);
        alert("FEP match could not be added. Check that the contribution products exist on this store and are active.");
        locked = false;
        root.classList.remove("is-loading");
        return;
      }

      window.location.reload();
    } catch (error) {
      console.error("FEP add failed", error);
      locked = false;
      root.classList.remove("is-loading");
    }
  }

  async function removeFep() {
    if (locked) return;
    locked = true;
    root.classList.add("is-loading");

    try {
      const cart = await getCart();
      await removeFepItems(cart);
      window.location.reload();
    } catch (error) {
      console.error("FEP remove failed", error);
      locked = false;
      root.classList.remove("is-loading");
    }
  }

  function activeRate(cart) {
    const subtotal = subtotalWithoutFep(cart);
    const fepItems = existingFepItems(cart);

    if (!subtotal || !fepItems.length) return null;

    const contributed = fepItems.reduce(
      (sum, item) => sum + Number(item.final_line_price || 0),
      0,
    );

    const twoFive = Math.round(subtotal * 0.025);
    const five = Math.round(subtotal * 0.05);

    if (Math.abs(contributed - twoFive) <= 1) return 0.025;
    if (Math.abs(contributed - five) <= 1) return 0.05;

    return null;
  }

  function routeOption(value, label, description, checked) {
    return `
      <label class="fep-match__route ${checked ? "is-selected" : ""}">
        <input type="radio" name="fep-route" value="${value}" ${checked ? "checked" : ""}>
        <span>
          <strong>${label}</strong>
          <em>${description}</em>
        </span>
      </label>
    `;
  }

  function returnOption(value, label, checked) {
    return `
      <label class="fep-match__return-option">
        <input type="radio" name="fep-return" value="${value}" ${checked ? "checked" : ""}>
        <span>${label}</span>
      </label>
    `;
  }

  async function renderFep() {
    const mount = document.querySelector("[data-fep-block]");
    if (!mount) return;

    const cart = await getCart();
    const subtotal = subtotalWithoutFep(cart);

    if (!cart.items || !cart.items.length || subtotal <= 0) {
      mount.innerHTML = "";
      return;
    }

    const twoFive = contributionCents(cart, 0.025);
    const five = contributionCents(cart, 0.05);
    const hasFep = existingFepItems(cart).length > 0;
    const currentRate = activeRate(cart);

    mount.innerHTML = `
      <section class="fep-match" data-fep-match-ui aria-label="Fulfillment Economics Protocol">
        <div class="fep-match__topline">
          <span>Bravi Rewards</span>
          <span>Luzione matches your contribution</span>
        </div>

        <div class="fep-match__headline">Help turn this order into useful work.</div>

        <p class="fep-match__body">
          Add a small matched contribution. Bravi Rewards helps fund service projects, capacity for small businesses, and restoration work — then tracks where eligible value is allocated.
        </p>

        <div class="fep-match__routes" aria-label="Choose Bravi Rewards route">
          ${routeOption("small_business_capacity", "Small business capacity", "Help fund work that gives smaller operators useful project capacity.", DEFAULT_ROUTE === "small_business_capacity")}
          ${routeOption("community_projects", "Community projects", "Support service projects requested by real communities or partners.", DEFAULT_ROUTE === "community_projects")}
          ${routeOption("environment_restoration", "Environment restoration", "Help initiate cleanup, repair, or restoration work where feasible.", DEFAULT_ROUTE === "environment_restoration")}
        </div>

        <div class="fep-match__actions">
          <button type="button" class="fep-match__button ${currentRate === 0.025 ? "is-active" : ""}" data-fep-rate="0.025">
            <span>Match 2.5%</span>
            <strong>${money(twoFive)}</strong>
          </button>

          <button type="button" class="fep-match__button ${currentRate === 0.05 ? "is-active" : ""}" data-fep-rate="0.05">
            <span>Match 5%</span>
            <strong>${money(five)}</strong>
          </button>

          ${hasFep ? `<button type="button" class="fep-match__remove" data-fep-remove>Remove</button>` : ""}
        </div>

        <details class="fep-match__returns">
          <summary>If this order is returned</summary>
          <div class="fep-match__returns-body">
            <p>If a return creates unused eligible value, choose whether it should stay in Bravi Rewards, be returned if eligible, or require confirmation before reallocation. Work already completed is not clawed back.</p>
            ${returnOption("continue_rewards", "Keep eligible value in Bravi Rewards", true)}
            ${returnOption("refund_unused", "Return unused eligible contribution", false)}
            ${returnOption("ask_me", "Ask before reallocating unused value", false)}
          </div>
        </details>

        <label class="fep-match__followup">
          <input type="checkbox" data-fep-followup>
          <span>Send me the Bravi Rewards update.</span>
        </label>

        <div class="fep-match__footer">
          <span>Customer match → Luzione match → Bravi Rewards route → tracked capacity return.</span>
          <a href="/pages/fep-mission">Learn more</a>
        </div>
      </section>
    `;

    mount.querySelectorAll("[data-fep-rate]").forEach((button) => {
      button.addEventListener("click", () => addFep(Number(button.dataset.fepRate)));
    });

    mount.querySelectorAll('input[name="fep-route"]').forEach((input) => {
      input.addEventListener("change", () => {
        mount.querySelectorAll(".fep-match__route").forEach((label) => label.classList.remove("is-selected"));
        input.closest(".fep-match__route")?.classList.add("is-selected");
      });
    });

    const remove = mount.querySelector("[data-fep-remove]");
    if (remove) remove.addEventListener("click", removeFep);
  }

  renderFep();
})();
