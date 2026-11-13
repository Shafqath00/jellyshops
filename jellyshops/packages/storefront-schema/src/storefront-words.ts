/**
 * Built-in storefront words: the text the platform itself draws (buttons, list toolbars, the bag, search), as opposed
 * to the text a merchant writes in section settings (translated in the editor's Language menu). Shopify themes keep
 * the same kind of words in locale files.
 *
 * English is the source; other languages are starter translations (check them with a native speaker before relying on
 * them). A word missing in a language falls back to English, so adding a word never breaks a translated store.
 * `{name}` marks a value filled in when the word is drawn.
 */
export const STOREFRONT_WORDS = {
  "list.sortBy": "Sort by",
  "list.sort.featured": "Featured",
  "list.sort.priceAsc": "Price, low to high",
  "list.sort.priceDesc": "Price, high to low",
  "list.sort.nameAsc": "Name, A to Z",
  "list.filter": "Filter",
  "list.filters": "Filters",
  "list.inStock": "In stock",
  "list.inStockOnly": "In stock only",
  "list.availability": "Availability",
  "list.price": "Price",
  "list.from": "From",
  "list.to": "To",
  "list.any": "Any",
  "list.clearAll": "Clear all",
  "list.clearFilters": "Clear filters",
  "list.noMatches": "No products match these filters.",
  "list.loading": "Loading…",
  "list.showMore": "Show more products",
  "list.oneProduct": "1 product",
  "list.products": "{count} products",
  "list.showing": "Showing {shown} of {total}",
  "list.readMore": "Read more",
  "product.addToCart": "Add to cart",
  "product.buyNow": "Buy now",
  "product.pleaseWait": "Please wait…",
  "product.quantity": "Quantity",
  "product.decrease": "Decrease quantity",
  "product.increase": "Increase quantity",
  "product.added": "Added to your bag.",
  "product.unableToAdd": "Unable to add this product.",
  "product.details": "Product details",
  "product.description": "Description",
  "product.related": "You may also like",
  "cart.title": "Your bag",
  "cart.shippingNote": "Shipping is calculated at checkout.",
  "cart.loading": "Loading your bag…",
  "cart.remove": "Remove",
  "cart.summary": "Order summary",
  "cart.subtotal": "Subtotal",
  "cart.checkout": "Checkout",
  "cart.continue": "Continue shopping",
  "search.title": "Search",
  "search.label": "Search products",
  "search.placeholder": "What are you looking for?",
  "search.button": "Search",
  "search.enterWords": "Enter a word or two to find products.",
  "search.noResults": "No products match “{query}”. Check the spelling or try a broader word.",
  "search.oneResult": "1 result for “{query}”",
  "search.results": "{count} results for “{query}”",
  "search.heading": "Search results",
  "search.noMatch": "No products match your search.",
  "notFound.heading": "We couldn't find that page",
  "notFound.body": "The page may have moved, but there is plenty more to discover.",
  "notFound.back": "Back to the shop",
} as const;

export type StorefrontWordKey = keyof typeof STOREFRONT_WORDS;

/** Starter translations by language code (as in theme settings > Languages). */
export const STOREFRONT_WORD_TRANSLATIONS: Readonly<Record<string, Partial<Record<StorefrontWordKey, string>>>> = {
  fr: {
    "list.sortBy": "Trier par", "list.sort.featured": "En vedette", "list.sort.priceAsc": "Prix croissant", "list.sort.priceDesc": "Prix décroissant", "list.sort.nameAsc": "Nom, de A à Z",
    "list.filter": "Filtrer", "list.filters": "Filtres", "list.inStock": "En stock", "list.inStockOnly": "En stock uniquement", "list.availability": "Disponibilité", "list.price": "Prix",
    "list.from": "De", "list.to": "À", "list.any": "Tous", "list.clearAll": "Tout effacer", "list.clearFilters": "Effacer les filtres", "list.noMatches": "Aucun produit ne correspond à ces filtres.",
    "list.loading": "Chargement…", "list.showMore": "Afficher plus de produits", "list.oneProduct": "1 produit", "list.products": "{count} produits", "list.showing": "{shown} sur {total}", "list.readMore": "En savoir plus",
    "product.addToCart": "Ajouter au panier", "product.buyNow": "Acheter maintenant", "product.pleaseWait": "Veuillez patienter…", "product.quantity": "Quantité", "product.decrease": "Diminuer la quantité",
    "product.increase": "Augmenter la quantité", "product.added": "Ajouté à votre panier.", "product.unableToAdd": "Impossible d’ajouter ce produit.", "product.details": "Détails du produit",
    "product.description": "Description", "product.related": "Vous aimerez aussi",
    "cart.title": "Votre panier", "cart.shippingNote": "Les frais de livraison sont calculés au paiement.", "cart.loading": "Chargement de votre panier…", "cart.remove": "Retirer",
    "cart.summary": "Récapitulatif", "cart.subtotal": "Sous-total", "cart.checkout": "Paiement", "cart.continue": "Continuer mes achats",
    "search.title": "Recherche", "search.label": "Rechercher des produits", "search.placeholder": "Que cherchez-vous ?", "search.button": "Rechercher", "search.enterWords": "Saisissez un ou deux mots pour trouver des produits.",
    "search.noResults": "Aucun produit ne correspond à « {query} ». Vérifiez l’orthographe ou essayez un mot plus général.", "search.oneResult": "1 résultat pour « {query} »", "search.results": "{count} résultats pour « {query} »",
    "search.heading": "Résultats de recherche", "search.noMatch": "Aucun produit ne correspond à votre recherche.", "notFound.heading": "Page introuvable", "notFound.body": "La page a peut-être été déplacée, mais il reste beaucoup à découvrir.", "notFound.back": "Retour à la boutique",
  },
  es: {
    "list.sortBy": "Ordenar por", "list.sort.featured": "Destacados", "list.sort.priceAsc": "Precio: de menor a mayor", "list.sort.priceDesc": "Precio: de mayor a menor", "list.sort.nameAsc": "Nombre: de la A a la Z",
    "list.filter": "Filtrar", "list.filters": "Filtros", "list.inStock": "En stock", "list.inStockOnly": "Solo en stock", "list.availability": "Disponibilidad", "list.price": "Precio",
    "list.from": "Desde", "list.to": "Hasta", "list.any": "Cualquiera", "list.clearAll": "Borrar todo", "list.clearFilters": "Borrar filtros", "list.noMatches": "Ningún producto coincide con estos filtros.",
    "list.loading": "Cargando…", "list.showMore": "Ver más productos", "list.oneProduct": "1 producto", "list.products": "{count} productos", "list.showing": "{shown} de {total}", "list.readMore": "Leer más",
    "product.addToCart": "Añadir a la cesta", "product.buyNow": "Comprar ahora", "product.pleaseWait": "Espera un momento…", "product.quantity": "Cantidad", "product.decrease": "Reducir cantidad",
    "product.increase": "Aumentar cantidad", "product.added": "Añadido a tu cesta.", "product.unableToAdd": "No se ha podido añadir este producto.", "product.details": "Detalles del producto",
    "product.description": "Descripción", "product.related": "También te puede gustar",
    "cart.title": "Tu cesta", "cart.shippingNote": "El envío se calcula al pagar.", "cart.loading": "Cargando tu cesta…", "cart.remove": "Eliminar",
    "cart.summary": "Resumen del pedido", "cart.subtotal": "Subtotal", "cart.checkout": "Pagar", "cart.continue": "Seguir comprando",
    "search.title": "Buscar", "search.label": "Buscar productos", "search.placeholder": "¿Qué estás buscando?", "search.button": "Buscar", "search.enterWords": "Escribe una o dos palabras para encontrar productos.",
    "search.noResults": "Ningún producto coincide con «{query}». Revisa la ortografía o prueba una palabra más general.", "search.oneResult": "1 resultado para «{query}»", "search.results": "{count} resultados para «{query}»",
    "search.heading": "Resultados de búsqueda", "search.noMatch": "Ningún producto coincide con tu búsqueda.", "notFound.heading": "No hemos encontrado esa página", "notFound.body": "Puede que la página se haya movido, pero hay mucho más por descubrir.", "notFound.back": "Volver a la tienda",
  },
  de: {
    "list.sortBy": "Sortieren nach", "list.sort.featured": "Empfohlen", "list.sort.priceAsc": "Preis aufsteigend", "list.sort.priceDesc": "Preis absteigend", "list.sort.nameAsc": "Name, A bis Z",
    "list.filter": "Filtern", "list.filters": "Filter", "list.inStock": "Auf Lager", "list.inStockOnly": "Nur auf Lager", "list.availability": "Verfügbarkeit", "list.price": "Preis",
    "list.from": "Von", "list.to": "Bis", "list.any": "Beliebig", "list.clearAll": "Alle löschen", "list.clearFilters": "Filter zurücksetzen", "list.noMatches": "Keine Produkte entsprechen diesen Filtern.",
    "list.loading": "Wird geladen…", "list.showMore": "Weitere Produkte anzeigen", "list.oneProduct": "1 Produkt", "list.products": "{count} Produkte", "list.showing": "{shown} von {total}", "list.readMore": "Mehr erfahren",
    "product.addToCart": "In den Warenkorb", "product.buyNow": "Jetzt kaufen", "product.pleaseWait": "Bitte warten…", "product.quantity": "Menge", "product.decrease": "Menge verringern",
    "product.increase": "Menge erhöhen", "product.added": "Zum Warenkorb hinzugefügt.", "product.unableToAdd": "Dieses Produkt kann nicht hinzugefügt werden.", "product.details": "Produktdetails",
    "product.description": "Beschreibung", "product.related": "Das könnte dir auch gefallen",
    "cart.title": "Dein Warenkorb", "cart.shippingNote": "Versandkosten werden an der Kasse berechnet.", "cart.loading": "Warenkorb wird geladen…", "cart.remove": "Entfernen",
    "cart.summary": "Bestellübersicht", "cart.subtotal": "Zwischensumme", "cart.checkout": "Zur Kasse", "cart.continue": "Weiter einkaufen",
    "search.title": "Suche", "search.label": "Produkte suchen", "search.placeholder": "Wonach suchst du?", "search.button": "Suchen", "search.enterWords": "Gib ein oder zwei Wörter ein, um Produkte zu finden.",
    "search.noResults": "Keine Produkte entsprechen „{query}“. Prüfe die Schreibweise oder versuche ein allgemeineres Wort.", "search.oneResult": "1 Ergebnis für „{query}“", "search.results": "{count} Ergebnisse für „{query}“",
    "search.heading": "Suchergebnisse", "search.noMatch": "Keine Produkte entsprechen deiner Suche.", "notFound.heading": "Diese Seite wurde nicht gefunden", "notFound.body": "Die Seite wurde vielleicht verschoben, aber es gibt noch viel zu entdecken.", "notFound.back": "Zurück zum Shop",
  },
  hi: {
    "list.sortBy": "इसके अनुसार क्रमबद्ध करें", "list.sort.featured": "विशेष", "list.sort.priceAsc": "कीमत: कम से ज़्यादा", "list.sort.priceDesc": "कीमत: ज़्यादा से कम", "list.sort.nameAsc": "नाम: A से Z",
    "list.filter": "फ़िल्टर", "list.filters": "फ़िल्टर", "list.inStock": "स्टॉक में", "list.inStockOnly": "केवल स्टॉक में", "list.availability": "उपलब्धता", "list.price": "कीमत",
    "list.from": "से", "list.to": "तक", "list.any": "कोई भी", "list.clearAll": "सब हटाएँ", "list.clearFilters": "फ़िल्टर हटाएँ", "list.noMatches": "इन फ़िल्टर से कोई उत्पाद मेल नहीं खाता।",
    "list.loading": "लोड हो रहा है…", "list.showMore": "और उत्पाद देखें", "list.oneProduct": "1 उत्पाद", "list.products": "{count} उत्पाद", "list.showing": "{total} में से {shown}", "list.readMore": "और पढ़ें",
    "product.addToCart": "कार्ट में जोड़ें", "product.buyNow": "अभी खरीदें", "product.pleaseWait": "कृपया प्रतीक्षा करें…", "product.quantity": "मात्रा", "product.decrease": "मात्रा घटाएँ",
    "product.increase": "मात्रा बढ़ाएँ", "product.added": "आपके कार्ट में जोड़ दिया गया।", "product.unableToAdd": "यह उत्पाद जोड़ा नहीं जा सका।", "product.details": "उत्पाद विवरण",
    "product.description": "विवरण", "product.related": "आपको यह भी पसंद आ सकता है",
    "cart.title": "आपका कार्ट", "cart.shippingNote": "शिपिंग की गणना चेकआउट पर होगी।", "cart.loading": "आपका कार्ट लोड हो रहा है…", "cart.remove": "हटाएँ",
    "cart.summary": "ऑर्डर सारांश", "cart.subtotal": "उप-योग", "cart.checkout": "चेकआउट", "cart.continue": "खरीदारी जारी रखें",
    "search.title": "खोजें", "search.label": "उत्पाद खोजें", "search.placeholder": "आप क्या ढूँढ रहे हैं?", "search.button": "खोजें", "search.enterWords": "उत्पाद खोजने के लिए एक या दो शब्द लिखें।",
    "search.noResults": "“{query}” से कोई उत्पाद मेल नहीं खाता। वर्तनी जाँचें या कोई सामान्य शब्द आज़माएँ।", "search.oneResult": "“{query}” के लिए 1 परिणाम", "search.results": "“{query}” के लिए {count} परिणाम",
    "search.heading": "खोज परिणाम", "search.noMatch": "आपकी खोज से कोई उत्पाद मेल नहीं खाता।", "notFound.heading": "हमें वह पेज नहीं मिला", "notFound.body": "हो सकता है पेज हट गया हो, लेकिन देखने के लिए और भी बहुत कुछ है।", "notFound.back": "दुकान पर वापस जाएँ",
  },
};

/** The built-in word in `language` (main language or unknown = English), with `{name}` values filled in. */
export function storefrontWord(key: StorefrontWordKey, language?: string | null, values?: Record<string, string | number>): string {
  const code = language?.toLowerCase().split("-")[0];
  const text = (code && STOREFRONT_WORD_TRANSLATIONS[code]?.[key]) || STOREFRONT_WORDS[key];
  return values ? text.replace(/\{(\w+)\}/g, (match, name: string) => name in values ? String(values[name]) : match) : text;
}
