import { createDefaultStoreDesign } from "@jelly/storefront-schema";
import { createRepository, memoryStorage } from "./repository";

const storeId = "store-sweet-bakes";

function withHeroHeading(heading: string) {
  const document = createDefaultStoreDesign();
  document.pages.home.sections[0].blocks[0].settings.text = heading;
  return document;
}

it("seeds a default Store Design for every store", () => {
  const repository = createRepository(memoryStorage());

  expect(repository.getState().stores.map((store) => repository.getStoreDesign(store.id)?.storeId)).toEqual(
    repository.getState().stores.map((store) => store.id)
  );
});

it("saves a draft only at its expected revision", () => {
  const repository = createRepository(memoryStorage());
  const current = repository.getStoreDesign(storeId)!;

  const saved = repository.saveStoreDesignDraft({ storeId, expectedRevision: current.draftRevision, document: withHeroHeading("Saved draft") });
  const stale = repository.saveStoreDesignDraft({ storeId, expectedRevision: current.draftRevision, document: withHeroHeading("Stale draft") });

  expect(saved).toMatchObject({ ok: true, record: { draftRevision: current.draftRevision + 1 } });
  expect(stale).toEqual({ ok: false, code: "DRAFT_REVISION_CONFLICT", currentRevision: current.draftRevision + 1 });
});

it("publishes an immutable snapshot while keeping later draft edits private", () => {
  const repository = createRepository(memoryStorage());
  const current = repository.getStoreDesign(storeId)!;
  const saved = repository.saveStoreDesignDraft({ storeId, expectedRevision: current.draftRevision, document: withHeroHeading("LIVE") });
  if (!saved.ok) throw new Error("Draft save should succeed");

  const published = repository.publishStoreDesign(storeId, saved.record.draftRevision);
  const laterDraft = repository.saveStoreDesignDraft({ storeId, expectedRevision: saved.record.draftRevision, document: withHeroHeading("DRAFT") });

  expect(published).toMatchObject({ ok: true, publication: { document: expect.any(Object) } });
  expect(laterDraft).toMatchObject({ ok: true });
  expect(repository.getPublishedStoreDesign(storeId)?.document.pages.home.sections[0].blocks[0].settings.text).toBe("LIVE");
  expect(repository.getStoreDesign(storeId)?.publications).toHaveLength(1);
});
