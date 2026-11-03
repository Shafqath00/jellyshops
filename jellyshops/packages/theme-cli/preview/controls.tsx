import type { ControlDefinition } from "@jelly/storefront-registry";

/** A setting the panel can draw: a registry control or a theme.json setting, reduced to what the inputs need. */
export interface Field {
  key: string;
  label: string;
  type: string;
  description?: string;
  group?: string;
  options?: Array<{ label: string; value: string }>;
  min?: number;
  max?: number;
  step?: number;
  showWhen?: { key: string; equals: unknown };
}

export function fieldsFromControls(controls: ControlDefinition[]): Field[] {
  return controls.map((control) => ({
    key: control.key, label: control.label, type: control.type, description: control.description, group: control.group, showWhen: control.showWhen,
    ...("options" in control ? { options: control.options } : {}),
    ...("min" in control ? { min: control.min, max: control.max } : {}),
    ...("step" in control ? { step: control.step } : {}),
  }));
}

const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "6px 8px", border: "1px solid #cbd1d8", borderRadius: 6, font: "inherit", fontSize: 13, background: "#fff", color: "#1c1b19" };

function Input({ field, value, onChange }: { field: Field; value: unknown; onChange: (next: unknown) => void }) {
  const id = `field-${field.key}`;
  switch (field.type) {
    case "checkbox":
      return <input id={id} type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />;
    case "select":
    case "segmented":
    case "radio":
    case "alignment":
      return <select id={id} style={input} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
        {!(field.options ?? []).some((option) => option.value === String(value ?? "")) && <option value={String(value ?? "")}>{String(value ?? "") || "Default"}</option>}
        {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>;
    case "number":
    case "range":
    case "spacing":
      return <input id={id} style={input} type="number" min={field.min} max={field.max} step={field.step} value={typeof value === "number" ? value : ""} onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))} />;
    case "color":
      return <span style={{ display: "flex", gap: 6 }}>
        <input aria-label={`${field.label} picker`} type="color" value={/^#[0-9a-f]{6}$/i.test(String(value ?? "")) ? String(value) : "#ffffff"} onChange={(event) => onChange(event.target.value)} style={{ width: 36, height: 30, padding: 0, border: "1px solid #cbd1d8", borderRadius: 6 }} />
        <input id={id} style={input} value={String(value ?? "")} placeholder="Default" onChange={(event) => onChange(event.target.value)} />
      </span>;
    case "textarea":
    case "richtext":
    case "rich-text":
      return <textarea id={id} style={{ ...input, minHeight: 64 }} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />;
    default:
      return <input id={id} style={input} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />;
  }
}

/** Draws labelled inputs for a list of settings. Controls with `showWhen` appear only while their condition holds. */
export function Fields({ fields, read, onChange }: { fields: Field[]; read: (key: string) => unknown; onChange: (key: string, value: unknown) => void }) {
  return <div style={{ display: "grid", gap: 10 }}>
    {fields.filter((field) => !field.showWhen || read(field.showWhen.key) === field.showWhen.equals).map((field) => {
      const check = field.type === "checkbox";
      return <div key={field.key} style={{ display: "grid", gap: 4, gridTemplateColumns: check ? "auto 1fr" : undefined, alignItems: "center" }}>
        {check && <Input field={field} value={read(field.key)} onChange={(value) => onChange(field.key, value)} />}
        <label htmlFor={`field-${field.key}`} style={{ fontSize: 12, fontWeight: 600, color: "#3b424a" }}>{field.label}</label>
        {!check && <Input field={field} value={read(field.key)} onChange={(value) => onChange(field.key, value)} />}
        {field.description && <small style={{ gridColumn: "1 / -1", color: "#6b7580" }}>{field.description}</small>}
      </div>;
    })}
  </div>;
}

/** Fields grouped under collapsible headings (content stays open, style and advanced start closed). */
export function GroupedFields({ fields, read, onChange }: { fields: Field[]; read: (key: string) => unknown; onChange: (key: string, value: unknown) => void }) {
  const groups = [...new Set(fields.map((field) => field.group ?? "Settings"))];
  return <>{groups.map((group) => <details key={group} open={group === "content" || group === "Settings"} style={{ marginBottom: 8 }}>
    <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, textTransform: "capitalize", padding: "4px 0" }}>{group}</summary>
    <div style={{ paddingTop: 8 }}><Fields fields={fields.filter((field) => (field.group ?? "Settings") === group)} read={read} onChange={onChange} /></div>
  </details>)}</>;
}
