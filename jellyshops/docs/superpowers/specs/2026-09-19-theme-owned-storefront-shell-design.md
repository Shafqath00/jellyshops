# Theme-owned storefront shell

`StorefrontFrame` currently owns two concerns: it reads shared store/cart state
and it renders header/footer/cart markup. This slice retains the first concern
in core and moves the second behind `@jelly/storefront-themes` shell extension
points.

The canonical theme definition gains optional `Layout`, `Header`, `Footer`,
and `CartPanel` components. A single resolver selects active theme, default
theme, then a caller-supplied shared component. Theme components receive only
serializable store/navigation/settings views plus event callbacks and children;
they do not query repositories or call checkout APIs.

`StorefrontFrame` reads published V4 theme data for the current store, resolves
the shell, and keeps cart state/actions in core. The Store Editor passes its
draft `ThemeConfiguration` through the same resolver to make shell settings
visible without publishing. Boutique supplies the full presentation set.
