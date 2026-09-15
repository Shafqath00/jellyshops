# Store Theme Library Design

## Goal

Give each store a Shopify-like Online Store experience: browse bundled starter themes, add one, and edit its private copy.

## Experience

The Online Store landing page presents an active-theme card and a catalog containing Sweet Bakes, Modern Retail, and Minimal Catalog. Selecting **Add** creates a store-specific theme configuration and starter home template. **Edit theme** opens the existing visual editor for that store copy.

## Data Model

Bundled theme definitions live in code and are immutable. A store records its selected theme through `ThemeConfiguration`; its editable templates and workspace generation live in the existing Supabase tables. Theme selection creates or replaces only the store's workspace records, never the shared definition.

## API

Add authenticated endpoints to list the bundled catalog, read the active theme, and install a theme. Installation runs in a PostgreSQL transaction, updates the theme configuration, seeds templates, and increments workspace generation.

## Verification

Tests cover catalog visibility, theme installation, store isolation, and successful editor loading with an installed theme.
