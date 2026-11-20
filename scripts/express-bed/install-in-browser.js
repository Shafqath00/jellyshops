/**
 * Applies scripts/express-bed/plan.json to the signed-in merchant's account. Run it in the browser console (or a
 * script runner) on a signed-in admin page of the local app, e.g. http://localhost:3000/admin, with the plan served
 * somewhere the page can fetch it:
 *
 *   await expressBedInstall({ api: "http://127.0.0.1:5001/jelly-507118/us-central1/api", plan: "http://127.0.0.1:4599/plan.json" })
 *
 * It creates the store (or reuses one with the same address), installs the Resthaven starter, replaces the draft's
 * layouts, shared sections, main menu and theme settings with the plan's, uploads the photos (from the app's own
 * /themes/jelly-resthaven/ folder), creates collections, products, pages and reviews, then validates and publishes.
 * Safe to run again: anything that already exists (by handle or file name) is left alone, layouts are rewritten.
 * The merchant's session token is read from the page's own sign-in storage and only sent to the app's API.
 */
async function expressBedInstall({ api, plan: planUrl, publish = true }) {
  const plan = await (await fetch(planUrl)).json();
  // The newest unexpired Supabase session (old projects can leave expired sessions behind).
  const sessions = Object.keys(localStorage).filter((key) => /^sb-.+-auth-token$/.test(key))
    .map((key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } })
    .filter((session) => session?.access_token && session.expires_at * 1000 > Date.now() + 60_000)
    .sort((a, b) => b.expires_at - a.expires_at);
  if (!sessions.length) throw new Error("Not signed in: no current merchant session in this tab. Reload the admin and try again.");
  const token = sessions[0].access_token;
  const log = [];
  const say = (line) => { log.push(line); console.log(`[express-bed] ${line}`); };

  async function call(method, path, body, expected = [200, 201]) {
    const init = { method, headers: { Authorization: `Bearer ${token}` } };
    if (body instanceof FormData) init.body = body;
    else if (body !== undefined) { init.body = JSON.stringify(body); init.headers["Content-Type"] = "application/json"; }
    const response = await fetch(`${api}${path}`, init);
    const text = await response.text();
    const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
    if (!expected.includes(response.status)) throw new Error(`${method} ${path}: HTTP ${response.status} ${text.slice(0, 400)}`);
    return { status: response.status, data };
  }
  const list = (data) => (Array.isArray(data) ? data : data?.items ?? data?.nodes ?? data?.reviews ?? data?.templates ?? data?.menus ?? data?.globalSections ?? []);

  // 1. Store.
  const me = await call("GET", "/api/me");
  let store = me.data.stores.find((candidate) => candidate.slug === plan.store.slug);
  if (!store) {
    store = (await call("POST", "/api/stores", plan.store, [201])).data.store;
    say(`Created the store ${plan.store.name} (/${store.slug}).`);
  } else say(`Using the existing store /${store.slug}.`);
  const base = `/api/stores/${store.id}`;
  const front = `${base}/storefront`;

  // 2. Resthaven starter.
  // Installing again would retire the current draft, so only a store without the starter gets it.
  const before = list((await call("GET", `${front}/templates`)).data);
  if (before.some((entry) => /:home$/.test(String(entry.id)) && entry.handle === "default")) say("Starter already installed.");
  else {
    const installed = await call("POST", `${front}/starters/${plan.starterId}/install`, undefined, [200, 201, 409]);
    say(installed.status === 409 ? "Starter already installed." : "Installed the Resthaven starter.");
  }

  // 3. Layouts and shared sections (ids get the same install prefix the server gave the starter's).
  const templates = list((await call("GET", `${front}/templates`)).data);
  const home = templates.find((entry) => /:home$/.test(String(entry.id)) && entry.handle === "default");
  if (!home) throw new Error("The installed home layout was not found.");
  const prefix = String(home.id).replace(/:home$/, "");
  const rekeyBlocks = (blocks = []) => blocks.map((entry) => ({ ...entry, id: `${prefix}:${entry.id}`, ...(entry.blocks ? { blocks: rekeyBlocks(entry.blocks) } : {}) }));
  const rekeySection = (section) => ({ ...section, id: `${prefix}:${section.id}`, blocks: rekeyBlocks(section.blocks) });
  const globals = list((await call("GET", `${front}/global-sections`)).data);
  for (const { section } of plan.globalSections) {
    const current = globals.find((entry) => entry.id === `${prefix}:${section.id}`);
    if (!current) { say(`Shared section ${section.id} not found; skipped.`); continue; }
    await call("PATCH", `${front}/global-sections/${encodeURIComponent(current.id)}`, { expectedRevision: current.revision, section: rekeySection(section) });
  }
  for (const entry of plan.templates) {
    const current = templates.find((candidate) => candidate.id === `${prefix}:${entry.key}`);
    if (!current) continue;
    const layout = { ...entry.layout, sections: entry.layout.sections.map((placement) => placement.kind === "global"
      ? { ...placement, globalSectionId: `${prefix}:${placement.globalSectionId}` }
      : { ...placement, section: rekeySection(placement.section) }) };
    await call("PATCH", `${front}/templates/${encodeURIComponent(current.id)}`, { expectedRevision: current.revision, layout });
  }
  say("Page layouts and shared sections written.");

  const menus = list((await call("GET", `${front}/menus`)).data);
  const main = menus.find((entry) => entry.handle === "main");
  if (main) await call("PATCH", `${front}/menus/${encodeURIComponent(main.id)}`, { expectedRevision: main.revision, items: plan.menus.main });
  else await call("POST", `${front}/menus`, { name: "Main menu", handle: "main", items: plan.menus.main }, [201]);
  say("Main menu written.");

  const theme = (await call("GET", `${front}/theme-settings`)).data;
  await call("PUT", `${front}/theme-settings`, { expectedRevision: theme.revision ?? null, themeId: theme.themeId, ...(theme.themeVersion ? { themeVersion: theme.themeVersion } : {}), settings: plan.themeSettings, ...(theme.draftArtifactId !== undefined ? { draftArtifactId: theme.draftArtifactId } : {}) });
  say("Theme settings written.");

  // 4. Photos.
  const mediaIds = new Map();
  for (const item of list((await call("GET", `${base}/media`)).data)) if (item.originalName) mediaIds.set(item.originalName, item.id);
  const photos = [...new Set(plan.products.flatMap((entry) => entry.images))];
  for (const name of photos) {
    const file = `express-bed-${name}.webp`;
    if (mediaIds.has(file)) continue;
    const blob = await (await fetch(`/themes/jelly-resthaven/${name}.webp`)).blob();
    const form = new FormData();
    form.append("file", new File([blob], file, { type: "image/webp" }));
    mediaIds.set(file, (await call("POST", `${base}/media`, form, [201])).data.id);
  }
  say(`Photos ready: ${photos.length}.`);

  // 5. Collections.
  const catalog = `${base}/catalog`;
  const collectionIds = new Map(list((await call("GET", `${catalog}/collections?limit=100`)).data).map((entry) => [entry.handle, entry.id]));
  for (const entry of plan.collections) {
    if (collectionIds.has(entry.handle)) {
      try { await call("PATCH", `${catalog}/collections/${collectionIds.get(entry.handle)}`, { title: entry.title, description: entry.description }); }
      catch (error) { say(`${entry.title} not refreshed: ${error.message}`); }
      continue;
    }
    collectionIds.set(entry.handle, (await call("POST", `${catalog}/collections`, entry, [201])).data.id);
  }
  say(`Collections: ${[...collectionIds.keys()].join(", ")}.`);

  // 6. Products.
  const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const productIds = new Map(list((await call("GET", `${catalog}/products?limit=100`)).data).map((entry) => [entry.handle, entry.id]));
  let created = 0;
  // Size is a stock option (one variant per size); "addon" options are optional priced extras on the bag line.
  const productOptions = (entry) => entry.options.map((definition, position) => {
    const type = definition.type ?? "variant";
    return {
      id: slug(definition.name), name: definition.name, type, required: type === "variant", position, display: "buttons",
      ...(type === "addon" ? { multiple: true } : {}),
      values: definition.values.map((value, index) => ({ id: `${slug(definition.name)}-${slug(value)}`, label: value, position: index, priceAdjustmentMinor: definition.prices?.[index] ?? 0 })),
    };
  });
  let refreshed = 0;
  for (const entry of plan.products) {
    if (productIds.has(entry.handle)) {
      // Existing products get the plan's current wording (description, specifications, tags); prices and stock stay.
      try {
        const options = productOptions(entry);
        await call("PATCH", `${catalog}/products/${productIds.get(entry.handle)}`, { description: entry.description, specifications: entry.specifications, tags: entry.tags, options, inventoryOptionIds: options.filter((option) => option.type === "variant").map((option) => option.id) });
        refreshed += 1;
      }
      catch (error) { say(`${entry.title} not refreshed: ${error.message}`); }
      continue;
    }
    const options = productOptions(entry);
    const variants = entry.variants.map((variant) => ({
      title: Object.values(variant.options).join(" / "), sku: variant.sku, priceMinor: variant.priceMinor,
      ...(variant.compareAtPriceMinor ? { compareAtPriceMinor: variant.compareAtPriceMinor } : {}),
      options: Object.fromEntries(Object.entries(variant.options).map(([name, value]) => [slug(name), `${slug(name)}-${slug(value)}`])),
      trackInventory: true, quantity: variant.stock,
    }));
    const response = await call("POST", `${catalog}/products`, {
      handle: entry.handle, title: entry.title, description: entry.description, status: "ACTIVE",
      vendor: entry.vendor, productType: entry.type, tags: entry.tags, specifications: entry.specifications,
      media: entry.images.map((name, index) => ({ mediaId: mediaIds.get(`express-bed-${name}.webp`), altText: index === 0 ? entry.title : `${entry.title}, view ${index + 1}` })),
      collectionIds: entry.collections.map((handle) => collectionIds.get(handle)).filter(Boolean),
      options, variants, inventoryOptionIds: options.filter((option) => option.type === "variant").map((option) => option.id),
    }, [201]);
    productIds.set(entry.handle, response.data.id);
    created += 1;
  }
  say(`Products: ${created} created, ${refreshed} refreshed.`);

  // 6b. Product picks in the layouts (spotlight, shop-the-look pins), now that product ids exist.
  for (const key of [...new Set((plan.productLinks ?? []).map((entry) => entry.template))]) {
    const current = list((await call("GET", `${front}/templates`)).data).find((candidate) => candidate.id === `${prefix}:${key}`);
    if (!current) continue;
    const layout = structuredClone(current.layout);
    for (const link of plan.productLinks.filter((entry) => entry.template === key)) {
      const productId = productIds.get(link.product);
      const section = layout.sections.find((placement) => placement.kind === "inline" && placement.section.id === `${prefix}:${link.section}`)?.section;
      const target = link.block ? section?.blocks.find((entry) => entry.id === `${prefix}:${link.block}`) : section;
      if (productId && target) target.settings = { ...target.settings, productId };
    }
    await call("PATCH", `${front}/templates/${encodeURIComponent(current.id)}`, { expectedRevision: current.revision, layout });
  }
  if (plan.productLinks?.length) say("Product picks linked.");

  // 7. Pages (written and published). "contact" is a built-in page; its copy shows above the contact form if allowed.
  const doc = (sections) => ({ type: "doc", content: sections.flatMap(([title, text]) => [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: title }] },
    { type: "paragraph", content: [{ type: "text", text }] },
  ]) });
  const pages = new Map(list((await call("GET", `${base}/content/pages`)).data).map((entry) => [entry.handle, entry]));
  for (const entry of plan.pages) {
    try {
      let current = pages.get(entry.handle);
      if (!current) current = (await call("POST", `${base}/content/pages`, { title: entry.title, handle: entry.handle, content: doc(entry.body) }, [201])).data;
      else await call("PATCH", `${base}/content/pages/${current.id}`, { title: entry.title, content: doc(entry.body), noindex: false });
      if (current.status !== "PUBLISHED") await call("POST", `${base}/content/pages/${current.id}/publish`);
    } catch (error) { say(`Page ${entry.handle} not written: ${error.message}`); }
  }
  say("Pages written and published.");

  // 8. Reviews: filed through the public form, then published by the merchant.
  const existing = list((await call("GET", `${base}/reviews?limit=100`)).data);
  if (!existing.length) {
    for (const review of plan.reviews) {
      const productId = productIds.get(review.product);
      if (!productId) continue;
      try { await call("POST", `/api/public/stores/${store.id}/reviews/products/${productId}`, { rating: review.rating, title: review.title, body: review.body, authorName: review.author }, [202]); }
      catch (error) { say(`Review not filed: ${error.message}`); }
    }
    for (const review of list((await call("GET", `${base}/reviews?limit=100`)).data)) {
      if (review.status !== "published") await call("PATCH", `${base}/reviews/${review.id}`, { status: "published" });
    }
  }
  say("Reviews published.");

  // 9. Validate and publish.
  if (publish) {
    const workspace = (await call("GET", `${front}/workspace`)).data;
    const validation = await call("POST", `${front}/validate`, { expectedGeneration: workspace.generation }, [200, 422]);
    if (!validation.data?.ok) throw new Error(`The storefront did not validate: ${JSON.stringify(validation.data).slice(0, 800)}`);
    await call("POST", `${front}/publish`, { expectedGeneration: workspace.generation, idempotencyKey: `express-bed-${workspace.generation}` });
    say(`Published: /${store.slug}`);
  }
  return { storeId: store.id, slug: store.slug, log };
}
