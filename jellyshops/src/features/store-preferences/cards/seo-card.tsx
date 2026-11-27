"use client";

/** How a result may look on Google: title, address, description, cut where Google usually cuts them. */
export function SearchPreview({ title, address, description }: { title: string; address: string; description: string }) {
  return <div className="jk-search-preview" role="group" aria-label="Search result preview">
    <p className="jk-cell-sub">How it may look on Google</p>
    <p className="jk-search-preview-title">{title}</p>
    <p className="jk-search-preview-address">{address}</p>
    <p className="jk-search-preview-text">{description.length > 160 ? `${description.slice(0, 157)}…` : description}</p>
  </div>;
}
