import type { Catalogue } from "./en.js";

/**
 * French. Typed as `Catalogue`, so omitting a key fails the build.
 *
 * West African French is the first audience, so this uses the vocabulary a
 * business owner in Abidjan or Dakar actually uses — "devis" for quote, "livraison"
 * for delivery — rather than literal translations of the English.
 */
export const fr: Catalogue = {
  "nav.home": "Accueil",
  "nav.create": "Créer ma marque",
  "nav.catalog": "Catalogue",
  "nav.package": "Mon pack",
  "nav.visualizer": "Visualiseur",
  "nav.quote": "Devis",
  "nav.orders": "Commandes",
  "nav.trends": "Tendances",
  "nav.assistant": "Demander à Brandora",
  "nav.settings": "Paramètres",
  "nav.dashboard": "Tableau de bord",
  "nav.login": "Se connecter",
  "nav.signup": "S'inscrire",
  "nav.logout": "Se déconnecter",

  /* L'entreprise.

     « Brandora Union » est l'entreprise ; « Brandora » reste le produit — c'est
     pourquoi nav.assistant dit toujours « Demander à Brandora ». */
  "brand.company": "Brandora Union",
  "brand.tagline": "Là où les marques prennent forme.",
  "brand.what": "L'infrastructure pour créer des marques physiques.",

  "chain.title": "Une seule entreprise, toute la chaîne",
  "chain.lede":
    "C'est sur cette chaîne qu'une petite marque perd de l'argent — un fournisseur qui ne peut pas faire la quantité, une production hors spécification, une expédition que personne ne suit. Brandora Union gère les six maillons, pour qu'aucun ne devienne le problème de quelqu'un d'autre.",
  "chain.brands": "Marques",
  "chain.products": "Produits",
  "chain.manufacturers": "Fabricants",
  "chain.production": "Production",
  "chain.quality": "Qualité",
  "chain.logistics": "Logistique",

  "contact.title": "Nous contacter",
  "contact.email": "E-mail",
  "contact.phone": "Téléphone",

  "sourcing.eyebrow": "Ce que vous pouvez sourcer",
  "sourcing.title": "Emballage, impression et produit",
  "sourcing.lede": "Tout ce qui suit est au catalogue aujourd'hui, chiffré et commandable en petites quantités.",
  "sourcing.browse": "Voir tout le catalogue",

  "ask.eyebrow": "Demander à Brandora",
  "ask.title": "Vous ne savez pas quoi sourcer ?",
  "ask.lede":
    "Décrivez ce qu'il vous faut avec vos mots. Brandora lit la demande, cherche dans le vrai catalogue et vous dit ce qui est réellement commandable à votre quantité.",
  "ask.grounding":
    "Elle répond à partir du catalogue et de votre marque enregistrée — jamais au jugé. Si rien ne convient, elle le dit plutôt que de proposer ce qui n'existe pas.",
  "ask.cta": "Demander à Brandora",
  "ask.example.q": "Il me faut 2 000 boîtes cosmétiques haut de gamme, noir mat, avec mon logo, livrées à Abidjan.",
  "ask.example.a":
    "Elle lit la quantité, la matière, la finition, le marquage et la destination — puis ne retient que ce qui est enregistré comme commandable à 2 000, et dit ce qui manque au lieu de le combler.",

  "network.eyebrow": "L'union",
  "network.title": "Entre la marque et l'usine",
  "network.lede":
    "Une fondatrice à Abidjan et un fabricant capable de produire ce qu'il lui faut sont deux personnes qui ne se rencontreront jamais. Brandora Union est ce lien — avec le contrôle qualité, les documents et l'expédition qui vont avec.",
  "network.brands": "Marques",
  "network.brands.note": "Une idée, une identité, et une quantité assez petite pour tester.",
  "network.makers": "Fabricants",
  "network.makers.note": "De la capacité, de l'outillage et un prix qui ne tient qu'au volume.",

  "founder.eyebrow": "La fondatrice",
  "founder.role": "Fondatrice, Brandora Union — Abidjan, Côte d'Ivoire",

  "join.title": "Suivez ce que nous construisons.",
  "join.lede": "Des nouvelles des fabricants, des produits, des opportunités de sourcing et des lancements Brandora Union.",
  "join.label": "Votre e-mail",
  "join.placeholder": "vous@exemple.com",
  "join.cta": "Rejoindre le réseau",

  "footer.platform": "Plateforme",
  "footer.company": "Entreprise",
  "footer.sourcing": "Sourcing",
  "footer.network": "Fabricants",
  "footer.about": "À propos",
  "footer.contact": "Contact",
  "footer.place": "Abidjan, Côte d'Ivoire",

  "network.stat.makers": "Fabricants",
  "network.stat.countries": "Pays",
  "words.eyebrow": "Leurs mots",
  "words.title": "Ce que disent les personnes avec qui nous travaillons",

  /* Erreurs. */
  "error.auth.invalid": "Votre adresse e-mail ou votre mot de passe est incorrect.",
  "error.network": "Nous n'arrivons pas à joindre Brandora. Vérifiez votre connexion et réessayez.",
  "error.CONFIGURATION_INCOMPLETE": "Le service n'est pas encore entièrement configuré. Rien de ce que vous avez saisi n'est perdu — notre équipe a été informée.",
  "error.SERVICE_UNAVAILABLE": "Le service est temporairement indisponible. Rien de ce que vous avez saisi n'est perdu — réessayez dans quelques instants.",
  "error.unknown": "Un problème est survenu. Veuillez réessayer.",

  "state.loading": "Chargement…",
  "state.catalog.loading": "Chargement du catalogue…",
  "state.catalog.empty": "Aucun produit ne correspond à votre recherche.",
  "state.catalog.unavailable": "Nous ne pouvons pas charger le catalogue pour le moment.",
  "state.catalog.preparing": "Notre catalogue est en préparation. Revenez bientôt, ou dites-nous ce que vous cherchez.",
  "state.interview.loading": "Préparation de votre entretien…",
  "state.interview.error": "Nous n'avons pas pu charger votre entretien.",
  "state.account.creating": "Création de votre compte…",
  "state.signing-in": "Connexion en cours…",
  "state.session.expired": "Votre session a expiré. Veuillez vous reconnecter.",

  "hero.headline": "Créez votre marque. Nous la rendons réelle.",
  "hero.subheadline":
    "Identité de marque, produits, emballage et fabrication — réunis sur une seule plateforme.",
  "hero.cta.primary": "Commencer",
  "hero.cta.secondary": "Explorer le sourcing",
  "hero.cta.ai": "Demander à Brandora",
  "hero.positioning": "De l'idée à l'identité, jusqu'à la marque physique.",

  "how.title": "Comment ça marche",
  "how.01": "Racontez-nous votre idée",
  "how.02": "Construisez votre identité",
  "how.03": "Choisissez vos produits",
  "how.04": "Visualisez votre marque",
  "how.05": "Recevez votre devis",
  "how.06": "Commandez",

  "section.brand.title": "Création de marque",
  "section.brand.body": "L'idée devient identité. L'identité devient un logo qui vous appartient.",
  "section.physical.title": "Marque physique",
  "section.physical.body": "Votre logo sur les gobelets, boîtes, sacs, stickers et cartes.",
  "section.sourcing.title": "Sourcing par l'IA",
  "section.sourcing.body":
    "Dites à Brandora ce qu'il vous faut. Elle cherche les fournisseurs, compare les options et renvoie un devis.",
  "section.visualizer.title": "Visualiseur",
  "section.visualizer.body":
    "Voyez votre marque sur de vrais produits avant de dépenser quoi que ce soit.",
  "section.africa.title": "Pensé pour la façon dont les petites entreprises démarrent vraiment",
  "section.africa.body":
    "Petites quantités, sourcing flexible, livraison locale, mobile d'abord, et des moyens de paiement adaptés à votre pays.",
  "cta.final": "Votre idée mérite une marque.",

  "builder.title": "Construisons votre marque.",
  "builder.step.interview": "Entretien",
  "builder.step.strategy": "Stratégie",
  "builder.step.identity": "Identité",
  "builder.step.logo": "Logo",
  "builder.dontknow": "Je ne sais pas — aidez-moi",
  "builder.next": "Continuer",
  "builder.back": "Retour",
  "builder.regenerate": "Régénérer",
  "builder.save": "Enregistrer ma marque",
  "builder.generating": "Création de votre marque…",

  "brand.name": "Nom de la marque",
  "brand.description": "Description",
  "brand.positioning": "Positionnement",
  "brand.target": "Client cible",
  "brand.personality": "Personnalité",
  "brand.promise": "Promesse",
  "brand.mission": "Mission",
  "brand.vision": "Vision",
  "brand.slogan": "Slogan",
  "brand.tone": "Ton de voix",
  "brand.story": "Histoire de la marque",
  "brand.palette": "Palette de couleurs",
  "brand.typography": "Typographie",
  "brand.logoBrief": "Direction du logo",
  "brand.kit.download": "Télécharger le kit de marque",

  "catalog.title": "Catalogue",
  "catalog.category.packaging": "Emballage",
  "catalog.category.brand-materials": "Supports de marque",
  "catalog.category.tableware": "Vaisselle",
  "catalog.category.merchandise": "Goodies",
  "catalog.moq": "À partir de {min} unités",
  "catalog.customizable": "Personnalisation disponible",
  "catalog.customization.unknown": "Personnalisation non confirmée",
  "catalog.add": "Ajouter à mon pack",
  "catalog.empty": "Rien ici pour l'instant.",

  "sourcing.best": "Meilleure option",
  "sourcing.cheapest": "Prix le plus bas",
  "sourcing.fastest": "Option la plus rapide",
  "sourcing.score": "Score Brandora",
  "sourcing.quantity.ok": "Quantité : compatible",
  "sourcing.quantity.no": "Quantité : indisponible à ce volume",
  "sourcing.shipping.ok": "Livraison : disponible",
  "sourcing.delivery.unavailable": "Estimation de livraison indisponible",
  "sourcing.stale": "Prix confirmés {when}",

  "package.title": "Pack de marque",
  "package.add": "Ajouter un produit",
  "package.remove": "Retirer",
  "package.quantity": "Quantité",
  "package.total": "Total estimé",
  "package.empty": "Votre pack est vide. Ajoutez un produit pour commencer.",

  "quote.title": "Devis Brandora",
  "quote.reference": "Référence",
  "quote.products": "Coût des produits",
  "quote.customization": "Personnalisation",
  "quote.shipping": "Livraison",
  "quote.logistics": "Logistique",
  "quote.service": "Service Brandora",
  "quote.total": "Total",
  "quote.validUntil": "Valable jusqu'au {date}",
  "quote.approve": "Approuver le devis",
  "quote.modify": "Modifier",

  "checkout.title": "Commande",
  "checkout.name": "Nom complet",
  "checkout.email": "E-mail",
  "checkout.phone": "Téléphone",
  "checkout.whatsapp": "WhatsApp",
  "checkout.address": "Adresse de livraison",
  "checkout.city": "Ville",
  "checkout.country": "Pays",
  "checkout.instructions": "Instructions de livraison",
  "checkout.terms": "J'accepte les conditions",
  "checkout.submit": "Passer la commande",

  "order.status.quote": "Devis",
  "order.status.pending-approval": "En attente d'approbation",
  "order.status.confirmed": "Confirmée",
  "order.status.supplier-processing": "Traitement fournisseur",
  "order.status.shipped": "Expédiée",
  "order.status.in-transit": "En transit",
  "order.status.delivered": "Livrée",
  "order.status.cancelled": "Annulée",
  "order.tracking": "Numéro de suivi",
  "order.carrier": "Transporteur",

  "notify.quote.ready": "Votre devis est prêt.",
  "notify.order.confirmed": "Votre commande fournisseur est confirmée.",
  "notify.order.shipped": "Votre colis est expédié.",
  "notify.order.delivered": "Votre commande a été livrée.",

  "settings.title": "Paramètres",
  "settings.language": "Langue",
  "settings.currency": "Devise",
  "settings.theme": "Apparence",
  "settings.theme.dark": "Sombre",
  "settings.theme.light": "Clair",
  "settings.country": "Pays",
  "settings.save": "Enregistrer",
  "settings.saved": "Enregistré",

  /* Compte et tableau de bord */
  "nav.admin": "Administration",
  "cta.book": "Réserver un appel",
  "assistant.send": "Demander",
  "auth.eyebrow": "Votre compte",
  "auth.email": "E-mail",
  "auth.password": "Mot de passe",
  "auth.password.hint":
    "Au moins 10 caractères. Une phrase dont vous vous souviendrez vaut mieux qu'un mot de passe court plein de symboles.",
  "auth.name": "Votre nom",
  "auth.country": "Pays",
  "auth.login.title": "Bon retour",
  "auth.login.lede": "Vos marques, vos paquets et vos commandes sont là où vous les avez laissés.",
  "auth.login.submit": "Se connecter",
  "auth.login.alt": "Nouveau sur Brandora ?",
  "auth.signup.title": "Créer un compte",
  "auth.signup.lede": "Un seul compte pour toutes vos marques, vos devis et vos commandes.",
  "auth.signup.submit": "Créer mon compte",
  "auth.signup.alt": "Vous avez déjà un compte ?",

  "dashboard.title": "Votre travail",
  "dashboard.brands": "Mes marques",
  "dashboard.quotes": "Mes devis",
  "dashboard.orders": "Mes commandes",

  "builder.generate": "Créer ma marque",
  "builder.step.review": "Prêt",
  "package.quote": "Obtenir mon devis",
  "package.recommended": "Recommandé pour votre marque",

  "error.sourcing.unavailable":
    "Nous n'arrivons pas à récupérer ce produit pour le moment. Essayez une autre option.",
  "error.sourcing.no-results":
    "Nous n'avons pas encore trouvé de correspondance. Essayez une autre quantité ou un autre style.",
  "error.freight.unavailable": "Estimation de livraison indisponible",
  "error.brand.generation-failed":
    "Nous n'avons pas pu terminer votre marque. Vos réponses sont enregistrées — réessayez.",
  "error.brand.interview-incomplete":
    "Répondez d'abord aux questions restantes, puis nous construirons votre marque.",
  "error.brand.not-generated":
    "Créez d'abord votre marque — cette page s'appuie sur ce qu'elle dit.",
  "error.package.empty": "Ajoutez au moins un produit avant de demander un devis.",
  "error.payment.not-started": "Aucun paiement n'a encore été lancé pour cette commande.",
  "error.quote.expired": "Ce devis a expiré. Nous pouvons en préparer un nouveau.",
  "error.order.not-found": "Nous n'avons pas trouvé cette commande.",
  "error.auth.required": "Connectez-vous pour continuer.",
  "error.auth.weak-password": "Choisissez un mot de passe plus long — au moins 10 caractères.",
  "error.auth.forbidden": "Vous n'avez pas accès à cette page.",
  "error.input.invalid": "Un champ ne semble pas correct. Vérifiez et réessayez.",
  "error.rate.limited": "Cela fait beaucoup de requêtes. Patientez un instant et réessayez.",
  "error.internal": "Un problème est survenu de notre côté. Nous nous en occupons.",
  "ui.catalog.add-to-package":
    "Ajouter \u00e0 mon lot",
  "ui.catalog.raise-quantity":
    "Commande minimum : {min}. Augmentez votre quantit\u00e9 pour l'ajouter.",
  "ui.catalog.per-unit":
    "{price} l'unit\u00e9",
  "ui.catalog.minimum":
    "Minimum {min}",
  "ui.catalog.delivery-later":
    "L'estimation de livraison sera disponible une fois votre commande confirm\u00e9e.",
  "ui.catalog.no-match":
    "Rien ne correspond pour l'instant. Essayez une autre cat\u00e9gorie ou une autre quantit\u00e9.",
  "ui.catalog.preparing":
    "Notre catalogue est en cours de pr\u00e9paration. Nous rassemblons actuellement nos premi\u00e8res r\u00e9f\u00e9rences.",
  "ui.catalog.count":
    "{shown} produits sur {total} peuvent \u00eatre command\u00e9s \u00e0 {quantity} unit\u00e9s.",
  "ui.catalog.browsing-for":
    "Vous parcourez le catalogue pour {brand}. Les produits que nous recommandons sont signal\u00e9s.",
  "ui.catalog.recommended":
    "Recommand\u00e9 : {reason}",
  "ui.catalog.see-in-catalogue":
    "Voir dans le catalogue",
  "ui.catalog.load-failed":
    "Le catalogue n'a pas pu \u00eatre charg\u00e9 pour le moment. ",
  "ui.catalog.browse-directly":
    "Le parcourir directement",
  "ui.catalog.from-units":
    " \u00b7 \u00e0 partir de {min} unit\u00e9s",
  "ui.catalog.from-unit":
    " \u00b7 \u00e0 partir de {min} unit\u00e9",
  "ui.package.open-brand-book":
    "Ouvrir le livre de marque \u2192",
  "ui.package.with-logo":
    "Avec votre logo \u00b7 {method}",
  "ui.package.rounded-up":
    "Vous avez demand\u00e9 {requested} ; ce produit d\u00e9marre \u00e0 {charged}, c'est donc ce qui est factur\u00e9.",
  "ui.package.add-to-see-total":
    "Ajoutez un produit pour voir votre total.",
  "ui.package.totals":
    "Totaux du lot",
  "ui.package.delivery-note":
    "La livraison est un tarif Brandora, pas un devis de transporteur. Une estimation transporteur est confirm\u00e9e \u00e0 la commande.",
  "ui.dashboard.items-in-package":
    "{count} produits dans le lot",
  "ui.dashboard.item-in-package":
    "{count} produit dans le lot",
  "ui.dashboard.brand-book":
    "Livre de marque",
  "ui.dashboard.no-brands":
    "Aucune marque pour l'instant",
  "ui.dashboard.no-brands-hint":
    "L'entretien prend quelques minutes et vous pourrez tout modifier ensuite.",
  "ui.dashboard.no-quotes":
    "Aucun devis pour l'instant.",
  "ui.dashboard.no-orders":
    "Aucune commande pour l'instant.",
  "ui.assistant.searching":
    "Recherche dans le catalogue\u2026",
  "ui.assistant.product-meta":
    "Minimum {min} \u00b7 {category}",
  "ui.assistant.needs-brand":
    "Cr\u00e9ez d'abord une marque \u2014 l'assistant r\u00e9pond \u00e0 partir d'elle. ",
  "ui.assistant.placeholder-hint":
    "Produits, emballages, quantit\u00e9s, par quoi commencer \u2014 r\u00e9pondu \u00e0 partir de {brand}.",
  "ui.order.reference":
    "Commande {reference}",
  "ui.quote.held-until":
    "Valable jusqu'au {date}",
  "ui.network.being-built":
    "Le r\u00e9seau de fabricants est en cours de constitution. Les partenaires v\u00e9rifi\u00e9s appara\u00eetront ici au fur et \u00e0 mesure.",
  "ui.booking.book-a-call":
    "R\u00e9server un appel",
  "ui.booking.load-failed":
    "L'agenda n'a pas pu se charger. ",
  "ui.booking.open-new-tab":
    "L'ouvrir dans un nouvel onglet",
  "ui.interview.unavailable":
    "L'entretien a besoin du service Brandora, qui ne r\u00e9pond pas pour le moment. Rien de ce que vous avez d\u00e9j\u00e0 r\u00e9pondu n'a \u00e9t\u00e9 perdu.",
  "ui.interview.retry":
    "R\u00e9essayer",
  "ui.quote.validity":
    "Valable jusqu'au {date}. Les prix du fret et des fournisseurs \u00e9voluent : un devis ne tient pas ind\u00e9finiment.",
  "ui.quote.reference":
    "Devis {reference}",
  "join.name":
    "Votre nom",
  "join.business":
    "Votre entreprise",
  "join.interest":
    "Ce que vous voulez faire fabriquer",
  "join.interest-placeholder":
    "Bo\u00eetes, gobelets, sacs, stickers\u2026",
  "join.quantity":
    "Environ combien",
  "join.quantity-placeholder":
    "30",
  "join.optional":
    "Facultatif \u2014 cela nous aide \u00e0 trouver le bon fabricant pour vous.",
  "join.sending":
    "Envoi\u2026",
  "join.bad-email":
    "Cela ne ressemble pas \u00e0 une adresse e-mail.",
  "join.ok":
    "Vous \u00eates sur la liste. Nous vous \u00e9crirons au fur et \u00e0 mesure.",
  "join.too-many":
    "Trop de tentatives depuis cet appareil. R\u00e9essayez un peu plus tard.",
  "join.failed":
    "L'envoi n'a pas abouti. R\u00e9essayez ou \u00e9crivez \u00e0 brandora.union@gmail.com.",
  "error.not-found": "Nous n'avons pas trouv\u00e9 cela.",
};
