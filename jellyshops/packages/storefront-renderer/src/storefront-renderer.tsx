import type { CSSProperties } from "react";
import {
  getStorefrontPage,
  type StorefrontDocument,
} from "@jelly/storefront-schema";
import { resolveDesignTokens } from "@jelly/storefront-themes";
import { PageRenderer } from "./page-renderer";
import { RegistrySectionRenderer } from "./registry-section-renderer";
import type { StorefrontRendererProps } from "./types";

function isStorefrontDocument(
  document: StorefrontRendererProps["document"],
): document is StorefrontDocument {
  return document.schemaVersion === 3;
}

export function StorefrontRenderer({ document, page = "home", pageId, mode, commerce, selected, onSelect, onSectionError }: StorefrontRendererProps) {
  if (isStorefrontDocument(document)) {
    const activeSections = pageId
      ? getStorefrontPage(document, pageId)?.sections ??
        document.pages.find((entry) => entry.type === "home")?.sections ??
        []
      : document.regions.template;
    const style = resolveDesignTokens(document.theme.presetId, document.theme.settings) as CSSProperties;
    const renderRegion = (region: "header" | "footer") => document.regions[region].map((section) => <RegistrySectionRenderer key={section.id} section={section} mode={mode} commerce={commerce} region={region} themeId={document.theme.presetId} selected={selected} onSelect={onSelect} />);
    return <div className="jelly-storefront" data-jelly-theme={document.theme.presetId} style={style}>{renderRegion("header")}<main>{activeSections.map((section) => <RegistrySectionRenderer key={section.id} section={section} mode={mode} commerce={commerce} region="template" themeId={document.theme.presetId} selected={selected} onSelect={onSelect} />)}</main>{renderRegion("footer")}</div>;
  }
  const style = resolveDesignTokens(document.theme.id, document.globalSettings) as CSSProperties;
  return <div className="jelly-storefront" data-jelly-theme={document.theme.id} style={style}><RegistrySectionRenderer section={document.header} mode={mode} commerce={commerce} /><main><PageRenderer page={document.pages[page]} mode={mode} commerce={commerce} onSectionError={onSectionError} /></main><RegistrySectionRenderer section={document.footer} mode={mode} commerce={commerce} /></div>;
}
