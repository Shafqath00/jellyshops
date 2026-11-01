import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MetafieldApiError, type MetafieldDefinition } from "./api";
import { NewDefinitionForm } from "./new-definition-form";

afterEach(cleanup);

const created = (extra: Partial<MetafieldDefinition> = {}): MetafieldDefinition => ({ id: "d1", ownerType: "product", namespace: "custom", key: "material", name: "Material", type: "string", storefrontVisible: true, ...extra });
const setup = (onCreate = vi.fn(async () => created()), ownerType: "product" | "variant" = "product") => {
  const onCreated = vi.fn(); const onCancel = vi.fn(); const onSubmit = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
  render(<form onSubmit={onSubmit}><NewDefinitionForm ownerType={ownerType} onCreate={onCreate} onCreated={onCreated} onCancel={onCancel} /></form>);
  return { user: userEvent.setup(), onCreate, onCreated, onCancel, onSubmit };
};

describe("creating a custom field", () => {
  it("makes the key from the name and creates the field", async () => {
    const { user, onCreate, onCreated } = setup();
    await user.type(screen.getByLabelText("Name"), "Care guide");
    await user.selectOptions(screen.getByLabelText("Type"), "url");
    await user.type(screen.getByLabelText(/^Description/), "Link to the PDF");
    await user.click(screen.getByLabelText("Available to my store's theme"));
    await user.click(screen.getByRole("button", { name: "Add field" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(onCreate).toHaveBeenCalledWith({ ownerType: "product", namespace: "custom", key: "care_guide", name: "Care guide", description: "Link to the PDF", type: "url", storefrontVisible: false });
  });

  it("shows the key the theme will use, and stops following the name once it is edited", async () => {
    const { user, onCreate } = setup();
    await user.type(screen.getByLabelText("Name"), "Material");
    expect(screen.getByLabelText("Key")).toHaveValue("material");
    expect(screen.getByText(/custom\.material/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Key"));
    await user.type(screen.getByLabelText("Key"), "fabric");
    await user.type(screen.getByLabelText("Name"), " type");
    expect(screen.getByLabelText("Key")).toHaveValue("fabric");
    await user.click(screen.getByRole("button", { name: "Add field" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ key: "fabric", name: "Material type" })));
  });

  it("makes a list of the chosen type", async () => {
    const { user, onCreate } = setup();
    await user.type(screen.getByLabelText("Name"), "Care steps");
    await user.click(screen.getByLabelText("It holds a list of values"));
    await user.click(screen.getByRole("button", { name: "Add field" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ type: "list:string" })));
  });

  it("sends the rules that were set, and only the ones that fit the type", async () => {
    const { user, onCreate } = setup();
    await user.type(screen.getByLabelText("Name"), "Fabric");
    await user.type(screen.getByLabelText("Only allow these values"), "Cotton{Enter}Linen");
    await user.type(screen.getByLabelText("Longest length"), "20");
    await user.click(screen.getByRole("button", { name: "Add field" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ validations: { maxLength: 20, choices: ["Cotton", "Linen"] } })));

    cleanup();
    const number = setup();
    await number.user.type(screen.getByLabelText("Name"), "Rating");
    await number.user.selectOptions(screen.getByLabelText("Type"), "integer");
    expect(screen.queryByLabelText("Longest length")).not.toBeInTheDocument();
    await number.user.type(screen.getByLabelText("Lowest number"), "1");
    await number.user.type(screen.getByLabelText("Highest number"), "5");
    await number.user.click(screen.getByRole("button", { name: "Add field" }));
    await waitFor(() => expect(number.onCreate).toHaveBeenCalledWith(expect.objectContaining({ type: "integer", validations: { min: 1, max: 5 } })));
  });

  it("offers no rules for types that have none", async () => {
    const { user } = setup();
    await user.selectOptions(screen.getByLabelText("Type"), "boolean");
    expect(screen.queryByText("Rules (optional)")).not.toBeInTheDocument();
  });

  it("explains what is wrong before asking the server", async () => {
    const { user, onCreate } = setup();
    await user.click(screen.getByRole("button", { name: "Add field" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Give the field a name");
    await user.type(screen.getByLabelText("Name"), "***");
    await user.click(screen.getByRole("button", { name: "Add field" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/key must start with a letter/);
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Fabric");
    await user.type(screen.getByLabelText("Shortest length"), "9");
    await user.type(screen.getByLabelText("Longest length"), "3");
    await user.click(screen.getByRole("button", { name: "Add field" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/cannot be longer/);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("shows the server's reason, such as a field that already exists, and keeps what was typed", async () => {
    const onCreate = vi.fn(async () => { throw new MetafieldApiError("A custom field with this namespace and key already exists for these items.", 409, "METAFIELD_EXISTS"); });
    const { user, onCreated } = setup(onCreate);
    await user.type(screen.getByLabelText("Name"), "Material");
    await user.click(screen.getByRole("button", { name: "Add field" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already exists");
    expect(screen.getByLabelText("Name")).toHaveValue("Material");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("creates the field on Enter instead of saving the product around it", async () => {
    const { user, onCreate, onSubmit } = setup();
    await user.type(screen.getByLabelText("Name"), "Material{Enter}");
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("can be cancelled, and says whose field it is", async () => {
    const { user, onCancel } = setup(undefined, "variant");
    expect(screen.getByText("New custom field for combinations")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
