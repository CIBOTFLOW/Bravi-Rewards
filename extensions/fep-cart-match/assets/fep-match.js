(function () {
  if (window.__bravviFepMovementLoaded) return;
  window.__bravviFepMovementLoaded = true;

  const EMBED_SELECTOR = "[data-fep-embed]";
  const MOUNT_SELECTOR = "[data-fep-block], [data-fep-drawer-mount]";
  const SECTION_IDS = "cart-drawer,cart-icon-bubble,cart-footer,main-cart-items,main-cart-footer";
  const DRAWER_SELECTORS = [
    "cart-drawer",
    "cart-drawer-component",
    "#cart-drawer",
    "[data-cart-drawer]",
    ".cart-drawer",
    ".drawer--cart",
    "#mini-cart",
    ".mini-cart",
  ];
  const DRAWER_FOOTER_SELECTORS = [
    ".cart-drawer__footer",
    ".drawer__footer",
    ".cart-drawer__summary",
    ".mini-cart__footer",
    "[data-cart-footer]",
    "footer",
  ];
  const ROUTES = {
    where_needed_most: "Where it is needed most",
    work_enablement: "Work enablement",
    community_support: "Community support",
    environment_restoration: "Environment restoration",
  };
  const PROPERTIES = {
    type: "_FEP Type",
    version: "_FEP Intent Version",
    rateBps: "_FEP Rate BPS",
    contributionMinor: "_FEP Contribution Minor",
    route: "_FEP Route Code",
    source: "_FEP Source",
    followUp: "_FEP Follow Up",
    component: "_FEP Component",
  };

  let locked = false;
  let observerTimer = null;

  function cartUrl(path) {
    const root = window.Shopify?.routes?.root || "/";
    return `${root}${String(path).replace(/^\/+/, "")}`;
  }

  function money(cents, currency = "USD") {
    try {
      return new Intl.NumberFormat(document.documentElement.lang || "en-US", {
        style: "currency",
        currency,
      }).format(cents / 100);
    } catch {
      return `$${(cents / 100).toFixed(2)}`;
    }
  }

  function rateLabel(rate) {
    return `${Number((rate * 100).toFixed(2))}%`;
  }

  function configFrom(element) {
    const primary = Number(element?.dataset.fepPrimaryPercent || 2.5) / 100;
    const secondary = Number(element?.dataset.fepSecondaryPercent || 5) / 100;
    return {
      centVariantId: String(element?.dataset.fepCentVariantId || "").trim(),
      dollarVariantId: String(element?.dataset.fepDollarVariantId || "").trim(),
      defaultRoute: ROUTES[element?.dataset.fepDefaultRoute]
        ? element.dataset.fepDefaultRoute
        : "where_needed_most",
      intentVersion: element?.dataset.fepIntentVersion || "fep-contribution-v2",
      rates: [primary, secondary].filter((rate, index, values) =>
        Number.isFinite(rate) && rate > 0 && rate <= 1 && values.indexOf(rate) === index),
    };
  }

  function copyConfig(source, target) {
    for (const [key, value] of Object.entries(source.dataset)) {
      if (key.startsWith("fep")) target.dataset[key] = value;
    }
  }

  async function jsonRequest(path, options = {}) {
    const response = await fetch(cartUrl(path), {
      credentials: "same-origin",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok) {
      const message = body?.description || body?.message || `Cart request failed (${response.status})`;
      throw new Error(message);
    }
    return body;
  }

  function getCart() {
    return jsonRequest("cart.js");
  }

  function itemProperty(item, name) {
    const properties = item?.properties;
    if (Array.isArray(properties)) {
      return properties.find((property) => property?.name === name)?.value;
    }
    return properties && typeof properties === "object" ? properties[name] : undefined;
  }

  function isFepItem(item, config) {
    const variantId = String(item?.variant_id || item?.id || "");
    return variantId === config.centVariantId || variantId === config.dollarVariantId;
  }

  function fepItems(cart, config) {
    return (cart?.items || []).filter((item) => isFepItem(item, config));
  }

  function baseSubtotalMinor(cart, config) {
    return (cart?.items || [])
      .filter((item) => !isFepItem(item, config))
      .reduce((sum, item) => sum + Number(item.final_line_price || 0), 0);
  }

  function contributionMinor(cart, config, rate) {
    const subtotal = baseSubtotalMinor(cart, config);
    return subtotal > 0 ? Math.max(1, Math.round(subtotal * rate)) : 0;
  }

  function existingContributionMinor(cart, config) {
    return fepItems(cart, config).reduce(
      (sum, item) => sum + Number(item.final_line_price || 0),
      0,
    );
  }

  function selectedRoute(mount, cart, config) {
    const selected = mount.querySelector("[data-fep-route]")?.value;
    if (ROUTES[selected]) return selected;
    const existing = fepItems(cart, config)
      .map((item) => itemProperty(item, PROPERTIES.route))
      .find((value) => ROUTES[value]);
    return existing || config.defaultRoute;
  }

  function followUpRequested(mount, cart, config) {
    const input = mount.querySelector("[data-fep-followup]");
    if (input) return Boolean(input.checked);
    return fepItems(cart, config).some(
      (item) => itemProperty(item, PROPERTIES.followUp) === "yes",
    );
  }

  function currentRate(cart, config) {
    const value = fepItems(cart, config)
      .map((item) => Number(itemProperty(item, PROPERTIES.rateBps)))
      .find((rateBps) => Number.isInteger(rateBps) && rateBps > 0);
    return value ? value / 10_000 : null;
  }

  function routeOptions(selected) {
    return Object.entries(ROUTES)
      .map(([value, label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`)
      .join("");
  }

  function contributionItems(totalMinor, rate, route, followUp, config) {
    const dollars = Math.floor(totalMinor / 100);
    const cents = totalMinor % 100;
    const baseProperties = {
      [PROPERTIES.type]: "customer_contribution",
      [PROPERTIES.version]: config.intentVersion,
      [PROPERTIES.rateBps]: String(Math.round(rate * 10_000)),
      [PROPERTIES.contributionMinor]: String(totalMinor),
      [PROPERTIES.route]: route,
      [PROPERTIES.source]: "shopify_theme_cart",
      [PROPERTIES.followUp]: followUp ? "yes" : "no",
    };
    const items = [];
    if (dollars > 0) {
      items.push({
        id: config.dollarVariantId,
        quantity: dollars,
        properties: { ...baseProperties, [PROPERTIES.component]: "dollars" },
      });
    }
    if (cents > 0) {
      items.push({
        id: config.centVariantId,
        quantity: cents,
        properties: { ...baseProperties, [PROPERTIES.component]: "cents" },
      });
    }
    return items;
  }

  async function removeExistingContribution(cart, config) {
    const items = fepItems(cart, config);
    if (!items.length) return cart;
    const updates = Object.fromEntries(items.map((item) => [item.key, 0]));
    return jsonRequest("cart/update.js", {
      method: "POST",
      body: JSON.stringify({ updates }),
    });
  }

  function setStatus(mount, message, state = "") {
    const status = mount.querySelector("[data-fep-status]");
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
  }

  function setBusy(value) {
    locked = value;
    document.querySelectorAll(MOUNT_SELECTOR).forEach((mount) => {
      mount.classList.toggle("is-loading", value);
      mount.querySelectorAll("button, select, input").forEach((control) => {
        control.disabled = value;
      });
    });
  }

  function notifyTheme(cart, sections) {
    const detail = { cart, sections: sections || {}, source: "bravvi-fep" };
    document.documentElement.dispatchEvent(new CustomEvent("cart:refresh", {
      bubbles: true,
      detail,
    }));
    document.documentElement.dispatchEvent(new CustomEvent("shopify:cart:lines-update", {
      bubbles: true,
      detail: { cart, source: "bravvi-fep" },
    }));
    window.dispatchEvent(new CustomEvent("bravvi:fep:changed", { detail }));
  }

  async function addContribution(mount, rate) {
    if (locked) return;
    const config = configFrom(mount);
    if (!config.centVariantId || !config.dollarVariantId || config.centVariantId === config.dollarVariantId) {
      setStatus(mount, "The Movement contribution products need to be configured in the theme editor.", "error");
      return;
    }

    setBusy(true);
    setStatus(mount, "Updating your cart…", "working");
    try {
      let cart = await getCart();
      const totalMinor = contributionMinor(cart, config, rate);
      if (!totalMinor) throw new Error("Add a merchandise item before adding a Movement contribution.");
      const route = selectedRoute(mount, cart, config);
      const followUp = followUpRequested(mount, cart, config);
      cart = await removeExistingContribution(cart, config);
      const items = contributionItems(totalMinor, rate, route, followUp, config);
      const result = await jsonRequest("cart/add.js", {
        method: "POST",
        body: JSON.stringify({
          items,
          sections: SECTION_IDS,
          sections_url: window.location.pathname,
        }),
      });
      cart = await getCart();
      notifyTheme(cart, result?.sections);
      await renderAll(cart);
    } catch (error) {
      console.error("FEP Movement contribution add failed", error);
      setStatus(mount, error?.message || "The contribution could not be added. Checkout is unchanged.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeContribution(mount) {
    if (locked) return;
    const config = configFrom(mount);
    setBusy(true);
    setStatus(mount, "Removing the contribution…", "working");
    try {
      let cart = await getCart();
      const result = await removeExistingContribution(cart, config);
      cart = result?.items ? result : await getCart();
      notifyTheme(cart, result?.sections);
      await renderAll(cart);
    } catch (error) {
      console.error("FEP Movement contribution removal failed", error);
      setStatus(mount, "The contribution could not be removed. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  function renderMount(mount, cart) {
    const config = configFrom(mount);
    const subtotal = baseSubtotalMinor(cart, config);
    if (!cart?.items?.length || subtotal <= 0) {
      mount.innerHTML = "";
      return;
    }

    const existingMinor = existingContributionMinor(cart, config);
    const activeRate = currentRate(cart, config);
    const existingRoute = selectedRoute(mount, cart, config);
    const existingFollowUp = followUpRequested(mount, cart, config);
    const currency = cart.currency || "USD";
    const buttons = config.rates.map((rate) => {
      const amount = contributionMinor(cart, config, rate);
      const active = activeRate === rate && existingMinor === amount;
      return `
        <button type="button" class="fep-match__amount ${active ? "is-active" : ""}"
          data-fep-rate="${rate}" aria-pressed="${active}">
          <span>${existingMinor && activeRate === rate && !active ? "Update" : "Add"} ${rateLabel(rate)}</span>
          <strong>${money(amount, currency)}</strong>
        </button>`;
    }).join("");

    mount.innerHTML = `
      <section class="fep-match" data-fep-match-ui aria-label="Fulfillment Economics Movement contribution">
        <div class="fep-match__header">
          <span class="fep-match__mark" aria-hidden="true">FEP</span>
          <div>
            <p class="fep-match__eyebrow">Fulfillment Economics Movement</p>
            <h3 class="fep-match__headline">Add support to this order</h3>
          </div>
          ${existingMinor ? `<span class="fep-match__added">Added ${money(existingMinor, currency)}</span>` : ""}
        </div>

        <p class="fep-match__body">Choose an amount below. It becomes a real Shopify cart item and is included in checkout.</p>

        <div class="fep-match__amounts" aria-label="Choose a contribution amount">
          ${buttons}
        </div>

        <details class="fep-match__details">
          <summary>Choose where it can help</summary>
          <div class="fep-match__preferences">
            <label class="fep-match__field">
              <span>Movement route</span>
              <select data-fep-route>${routeOptions(existingRoute)}</select>
            </label>
            <label class="fep-match__followup">
              <input type="checkbox" data-fep-followup ${existingFollowUp ? "checked" : ""}>
              <span>Send me a verified fulfillment update.</span>
            </label>
          </div>
        </details>

        <div class="fep-match__meta">
          <p data-fep-status data-state="${existingMinor ? "success" : ""}" aria-live="polite">
            ${existingMinor
              ? `${money(existingMinor, currency)} is included in the cart total.`
              : "No contribution has been added yet."}
          </p>
          ${existingMinor ? '<button type="button" class="fep-match__remove" data-fep-remove>Remove</button>' : ""}
        </div>

        <p class="fep-match__footnote">Allocation begins only after Shopify confirms payment. Paid and refunded events are reconciled server-side.</p>
      </section>`;

    mount.querySelectorAll("[data-fep-rate]").forEach((button) => {
      button.addEventListener("click", () => addContribution(mount, Number(button.dataset.fepRate)));
    });
    mount.querySelector("[data-fep-remove]")?.addEventListener("click", () => removeContribution(mount));
  }

  async function renderAll(cart) {
    const resolvedCart = cart || await getCart();
    document.querySelectorAll(MOUNT_SELECTOR).forEach((mount) => renderMount(mount, resolvedCart));
  }

  function findDrawer() {
    for (const selector of DRAWER_SELECTORS) {
      const candidates = Array.from(document.querySelectorAll(selector));
      const visible = candidates.find((element) =>
        element.getAttribute("aria-hidden") !== "true" && !element.hasAttribute("hidden"));
      if (visible) return visible;
      if (candidates[0]) return candidates[0];
    }
    return null;
  }

  function findDrawerFooter(drawer) {
    for (const selector of DRAWER_FOOTER_SELECTORS) {
      const footer = drawer.querySelector(selector);
      if (footer) return footer;
    }
    const checkout = drawer.querySelector('[name="checkout"], a[href*="/checkout"]');
    return checkout?.closest("form, .button-group, .cart-actions") || checkout?.parentElement || null;
  }

  function installDrawerMount() {
    const embed = document.querySelector(EMBED_SELECTOR);
    if (!embed) return null;
    const drawer = findDrawer();
    if (!drawer || drawer.querySelector("[data-fep-drawer-mount]")) return null;
    const footer = findDrawerFooter(drawer);
    if (!footer?.parentNode) return null;
    const mount = document.createElement("div");
    mount.setAttribute("data-fep-drawer-mount", "");
    mount.dataset.fepContext = "drawer";
    copyConfig(embed, mount);
    footer.parentNode.insertBefore(mount, footer);
    return mount;
  }

  function scheduleDrawerMount() {
    window.clearTimeout(observerTimer);
    observerTimer = window.setTimeout(async () => {
      const mount = installDrawerMount();
      if (!mount) return;
      try {
        await renderAll();
      } catch (error) {
        console.error("FEP Movement drawer render failed", error);
      }
    }, 80);
  }

  async function start() {
    installDrawerMount();
    try {
      await renderAll();
    } catch (error) {
      console.error("FEP Movement render failed", error);
      document.querySelectorAll(MOUNT_SELECTOR).forEach((mount) => {
        mount.innerHTML = `
          <section class="fep-match fep-match--unavailable">
            <h3 class="fep-match__headline">Movement contribution is unavailable</h3>
            <p class="fep-match__body">You can continue checkout normally. Your cart was not changed.</p>
          </section>`;
      });
    }

    new MutationObserver(scheduleDrawerMount).observe(document.body, {
      childList: true,
      subtree: true,
    });
    document.addEventListener("cart:refresh", (event) => {
      if (event.detail?.source === "bravvi-fep") return;
      window.setTimeout(() => renderAll().catch(console.error), 60);
    });
    document.addEventListener("shopify:cart:lines-update", (event) => {
      if (event.detail?.source === "bravvi-fep") return;
      window.setTimeout(() => renderAll(event.detail?.cart).catch(console.error), 60);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
