/**
 * First clean-up of HTML pasted from Word, Google Docs or web pages, before the editor reads it. The editor's
 * schema then keeps only what the rich text format allows, and the server cleans every saved document again, so
 * this step is about tidiness (no stray Office markup, no fixed fonts or black-on-white colours), not safety alone.
 */
export function cleanPastedHtml(html: string): string {
  return html
    // Office conditional comments, XML islands, ordinary comments and <style>/<script>/<meta>/<link> blocks.
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(style|script|xml|meta|link|title)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(meta|link)\b[^>]*\/?>/gi, "")
    // Word's list bullets are written as text inside <span style="mso-list:Ignore">.
    .replace(/<span[^>]*mso-list:\s*Ignore[^>]*>(?:[^<]|<span[^>]*>[^<]*<\/span>)*<\/span>/gi, "")
    // Office namespaced tags (<o:p>, <w:sdt>, <v:shape>) keep their text only.
    .replace(/<\/?[a-z]+:[a-z]+\b[^>]*>/gi, "")
    // Event handlers and classes never carry anything we keep.
    .replace(/\s(on[a-z]+|class|id|lang|dir)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\sstyle\s*=\s*("([^"]*)"|'([^']*)')/gi, (_match, _quoted, double: string | undefined, single: string | undefined) => {
      const kept = keepStyles(double ?? single ?? "");
      return kept ? ` style="${kept}"` : "";
    });
}

/** Only the styles the editor understands, without "no colour" values that Word and Docs write everywhere. */
function keepStyles(style: string): string {
  const kept: string[] = [];
  for (const part of style.split(";")) {
    const index = part.indexOf(":");
    if (index < 0) continue;
    const name = part.slice(0, index).trim().toLowerCase();
    const value = part.slice(index + 1).trim().toLowerCase();
    if (name === "font-weight" && /^(bold|bolder|[6-9]00|normal|400)$/.test(value)) kept.push(`font-weight: ${value}`);
    else if (name === "font-style" && /^(italic|normal)$/.test(value)) kept.push(`font-style: ${value}`);
    else if ((name === "text-decoration" || name === "text-decoration-line") && /(underline|line-through)/.test(value)) kept.push(`text-decoration: ${value.match(/underline|line-through/)![0]}`);
    else if (name === "text-align" && /^(center|right|justify)$/.test(value)) kept.push(`text-align: ${value}`);
    else if (name === "color" && !/^(black|#000000|#000|rgb\(0,\s*0,\s*0\)|windowtext|inherit|initial)$/.test(value)) kept.push(`color: ${value}`);
    else if (name === "background-color" && !/^(white|#ffffff|#fff|transparent|rgb\(255,\s*255,\s*255\)|inherit|initial)$/.test(value)) kept.push(`background-color: ${value}`);
  }
  return kept.join("; ");
}
