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
  "nav.pricing": "Comment fonctionnent nos prix",
  "nav.visualizer": "Visualiseur",
  "nav.quote": "Devis",
  "nav.orders": "Commandes",
  "nav.trends": "Tendances",
  "nav.assistant": "Demander à Brandora",
  "nav.settings": "Paramètres",
  "nav.dashboard": "Tableau de bord",
  "nav.account": "Mon compte",
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
  "sourcing.lede": "Ce que Brandora source actuellement, aupr\u00e8s de fabricants avec qui nous \u00e9changeons directement.",
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
  "footer.privacy": "Politique de confidentialité",
  "footer.terms": "Conditions d'utilisation",
  "footer.newsletter.heading": "Restez informé",
  "footer.newsletter.label": "Votre e-mail",
  "footer.newsletter.cta": "S'abonner",

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
  "catalog.category.label":
    "Catégorie",
  "catalog.category.all":
    "Toutes",
  "catalog.search.label":
    "Recherche",
  "catalog.search.placeholder":
    "gobelets, autocollants, boîtes…",
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
  "auth.forgot-password":
    "Mot de passe oublié ?",
  "auth.google.signin":
    "Se connecter avec Google",
  "auth.or-divider":
    "ou",
  "auth.forgot.title":
    "Réinitialiser votre mot de passe",
  "auth.forgot.lede":
    "Indiquez votre e-mail et nous vous enverrons un lien pour le réinitialiser.",
  "auth.forgot.submit":
    "Envoyer le lien",
  "auth.forgot.sent":
    "Si un compte existe pour cette adresse, un lien de réinitialisation est en route. Vérifiez votre boîte de réception.",
  "auth.back-to-login":
    "Retour à la connexion",
  "auth.reset.title":
    "Choisissez un nouveau mot de passe",
  "auth.reset.lede":
    "Saisissez un nouveau mot de passe pour votre compte.",
  "auth.reset.new-password":
    "Nouveau mot de passe",
  "auth.reset.submit":
    "Mettre à jour le mot de passe",
  "auth.reset.done":
    "Votre mot de passe a été mis à jour. Connexion en cours…",
  "auth.reset.no-token":
    "Ce lien n'a pas de jeton.",
  "auth.reset.request-new":
    "Demander un nouveau lien",

  "account.noscript": "Activez JavaScript pour gérer votre compte.",
  "account.signed-out": "Connectez-vous pour gérer votre compte.",
  "account.title": "Paramètres du compte",
  "account.lede":
    "Consultez les informations de votre compte, et changez votre mot de passe ou votre adresse e-mail quand vous le souhaitez — sans avoir besoin de personne d'autre.",
  "account.field.name": "Nom",
  "account.field.email": "E-mail",
  "account.field.role": "Rôle",
  "account.password.title": "Changer le mot de passe",
  "account.password.current": "Mot de passe actuel",
  "account.password.new": "Nouveau mot de passe",
  "account.password.confirm": "Confirmer le nouveau mot de passe",
  "account.password.submit": "Changer le mot de passe",
  "account.password.success":
    "Mot de passe changé. Vous êtes toujours connecté sur cet appareil — toutes les autres sessions ont été déconnectées.",
  "account.password.mismatch": "Le nouveau mot de passe et sa confirmation ne correspondent pas.",
  "account.email.title": "Changer l'adresse e-mail",
  "account.email.current": "Mot de passe actuel",
  "account.email.new": "Nouvelle adresse e-mail",
  "account.email.submit": "Changer l'adresse e-mail",
  "account.email.success": "Adresse e-mail mise à jour.",

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
  "error.auth.reset-invalid": "Ce lien de réinitialisation est invalide ou a expiré. Demandez-en un nouveau.",
  "error.auth.email-taken": "Cette adresse e-mail est déjà utilisée par un autre compte.",
  "error.input.invalid": "Un champ ne semble pas correct. Vérifiez et réessayez.",
  "error.rate.limited": "Cela fait beaucoup de requêtes. Patientez un instant et réessayez.",
  "error.internal": "Un problème est survenu de notre côté. Nous nous en occupons.",
  "error.storage.not-configured": "Le stockage des images n'est pas encore configuré. Le produit a été enregistré sans cette photo.",
  "error.storage.upload-failed": "Impossible de téléverser l'image. Vérifiez le type et la taille du fichier, puis réessayez.",
  "error.storage.delete-failed": "Impossible de supprimer cette image pour le moment. Veuillez réessayer.",
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
  "ui.catalog.quote-on-request":
    "Sur devis",
  "ui.catalog.request-quote":
    "Demander un devis",
  "ui.catalog.sourced-from":
    "Fourni par {supplier}",
  "ui.catalog.sourcing-in-progress":
    "Brandora recherche un fabricant pour ce produit — aucun n'est encore confirmé",
  "ui.catalog.moq-unconfirmed":
    "Quantité pas encore confirmée",
  "ui.catalog.confidence.verified":
    "Confirmé : peut porter votre logo",
  "ui.catalog.confidence.reported":
    "Le fournisseur déclare pouvoir le personnaliser — à confirmer avant paiement",
  "ui.catalog.confidence.unavailable":
    "Ne peut pas être personnalisé",
  "ui.catalog.confidence.unknown":
    "Personnalisation non confirmée",
  "ui.quote-request.photo-label":
    "Demander un devis pour {product}",
  "ui.quote-request.title":
    "Demande de devis — {product}",
  "ui.quote-request.lede":
    "Dites-nous ce qu'il vous faut. Nous vous répondrons par e-mail.",
  "ui.quote-request.moq-label":
    "Quantité minimale de commande",
  "ui.quote-request.color-label":
    "Couleur (facultatif)",
  "ui.quote-request.material-label":
    "Matière / texture (facultatif)",
  "ui.quote-request.logo-label":
    "Téléversez votre logo (facultatif)",
  "ui.quote-request.note-label":
    "Autre chose à préciser ? (facultatif)",
  "ui.quote-request.submit":
    "Envoyer la demande",
  "ui.quote-request.sending":
    "Envoi…",
  "ui.quote-request.sent-title":
    "Demande envoyée",
  "ui.quote-request.sent-body":
    "Nous vous répondrons sous 48 heures.",
  "ui.quote-request.close":
    "Fermer",
  "ui.quote-request.moq-invalid":
    "Indiquez un nombre entier supérieur à zéro.",
  "ui.quote-request.logo-too-large":
    "Ce fichier logo est trop volumineux — utilisez-en un de moins de 150 Ko.",
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
  "ui.assistant.product-meta-sourcing":
    "{category} \u00b7 quantit\u00e9 pas encore confirm\u00e9e",
  "ui.assistant-widget.open":
    "Demander à Brandora",
  "ui.assistant-widget.title":
    "Demander à Brandora",
  "ui.assistant-widget.close":
    "Fermer",
  "ui.assistant-widget.placeholder":
    "Posez une question…",
  "ui.assistant-widget.send":
    "Envoyer",
  "ui.assistant-widget.open-full":
    "Ouvrir l'assistant complet",
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
  "nav.skip":
    "Aller au contenu",
  "founder.p1":
    "J'ai cr\u00e9\u00e9 Brandora Union parce que j'ai remarqu\u00e9 un manque que je ne pouvais pas ignorer.",
  "founder.p2":
    "Partout en Afrique, des entrepreneurs formidables construisent des marques ambitieuses et cr\u00e9ent des produits vraiment excellents. Mais trop souvent, la pr\u00e9sentation physique de ces produits ne refl\u00e8te pas la qualit\u00e9 de ce qu'il y a \u00e0 l'int\u00e9rieur.",
  "founder.p3":
    "J'ai compris qu'un emballage n'est pas qu'un emballage. C'est souvent la premi\u00e8re conversation qu'un client a avec une marque. Avant de go\u00fbter, de porter, d'utiliser ou de vivre un produit, on le voit. La forme, les mati\u00e8res, les d\u00e9tails, les couleurs \u2014 tout cela cr\u00e9e une impression imm\u00e9diate de ce qu'il y a \u00e0 l'int\u00e9rieur.",
  "founder.pull1":
    "Un emballage beau et pens\u00e9 donne au produit un air intentionnel, digne de confiance, et qui m\u00e9rite d'\u00eatre d\u00e9couvert.",
  "founder.p4":
    "Pourtant, pour beaucoup de marques africaines, acc\u00e9der \u00e0 des emballages personnalis\u00e9s de qualit\u00e9 et \u00e0 des partenaires de fabrication fiables reste difficile, co\u00fbteux ou inutilement compliqu\u00e9.",
  "founder.p5":
    "J'ai voulu changer cela.",
  "founder.p6":
    "J'ai cr\u00e9\u00e9 Brandora Union pour que les entrepreneurs africains puissent plus facilement construire des marques aussi exceptionnelles que les produits qu'ils cr\u00e9ent \u2014 en les mettant en relation avec les bons produits, les bons emballages, les bons fabricants, et \u00e0 terme toute l'infrastructure n\u00e9cessaire pour faire exister leurs id\u00e9es dans le monde physique.",
  "founder.p7":
    "L'Afrique a les id\u00e9es. L'Afrique a le talent. Je crois que nos marques m\u00e9ritent une infrastructure \u00e0 la hauteur.",
  "founder.pull2":
    "Et c'est en C\u00f4te d'Ivoire que je commence.",
  "assistant.lede":
    "Posez vos questions sur les produits, les emballages, les quantit\u00e9s ou par quoi commencer. Les r\u00e9ponses viennent de votre marque et du catalogue r\u00e9el.",
  "assistant.q1":
    "Quels produits conviennent \u00e0 ma marque ?",
  "assistant.q2":
    "Quel emballage utiliser ?",
  "assistant.q3":
    "Par quoi commencer ?",
  "assistant.q4":
    "Composer un lot de lancement",
  "assistant.label":
    "Votre question",
  "assistant.placeholder":
    "Produits, emballages, quantit\u00e9s\u2026",
  "assistant.footnote":
    "Brandora r\u00e9pond \u00e0 partir du catalogue qu'elle peut r\u00e9ellement commander. Elle vous dira quand rien ne convient plut\u00f4t que de proposer quelque chose qui n'existe pas.",
  "brand.section.brand":
    "La marque",
  "brand.palette.note":
    "D\u00e9riv\u00e9e de vos r\u00e9ponses, puis v\u00e9rifi\u00e9e en contraste avant de vous \u00eatre montr\u00e9e.",
  "brand.section.mark":
    "Le logo",
  "brand.mark.note":
    "Une direction, \u00e9crite pour \u00eatre confi\u00e9e \u00e0 un graphiste ou \u00e0 un mod\u00e8le d'image.",
  "brand.section.world":
    "Dans le monde r\u00e9el",
  "brand.world.note":
    "Vos couleurs et vos lettres sur les objets que le client tient vraiment.",
  "brand.cta.products":
    "Choisir vos produits",
  "brand.cta.guidelines":
    "T\u00e9l\u00e9charger la charte de marque",
  "brand.empty.title":
    "Aucune marque ici pour l'instant",
  "brand.empty.body":
    "R\u00e9pondez \u00e0 l'entretien et Brandora en construira une.",
  "brand.loading":
    "Chargement de votre marque\u2026",
  "catalog.lede":
    "Dites-nous combien il vous en faut. Brandora ne vous propose que ce que vous pouvez r\u00e9ellement commander \u00e0 cette quantit\u00e9.",
  "catalog.quantity.label":
    "Combien vous en faut-il ?",
  "catalog.near.title":
    "Disponibles, mais pas \u00e0 cette quantit\u00e9",
  "catalog.near.note":
    "Ceux-ci demandent une commande plus importante. Le minimum est indiqu\u00e9 sur chacun.",
  "home.catalog.loading":
    "Chargement du catalogue\u2026",
  "interview.dont-know":
    "Je ne sais pas \u2014 aidez-moi",
  "package.recs.note":
    "Class\u00e9s selon ce que vous nous avez dit, pas par prix. Chacun peut \u00eatre command\u00e9 \u00e0 la quantit\u00e9 que vous avez choisie.",
  "order.title":
    "Votre commande",
  "order.what":
    "Ce que vous avez command\u00e9",
  "order.pay":
    "Passer au paiement",
  "order.check-again":
    "J'ai pay\u00e9 \u2014 v\u00e9rifier \u00e0 nouveau",
  "quote.place-order":
    "Passer cette commande",
  "error.reason-label": "Raison technique",
  "sourcing.floor.title":
    "Depuis l'atelier",
  "sourcing.floor.caption":
    "\u00c9tiquettes holographiques de s\u00e9curit\u00e9, photographi\u00e9es chez le fabricant avec qui nous travaillons. Pas encore au catalogue \u2014 nous n\u00e9gocions des quantit\u00e9s adapt\u00e9es \u00e0 une boulangerie.",
  "sourcing.floor.alt":
    "Une planche d'\u00e9tiquettes holographiques dor\u00e9es rondes dans son carton d'exp\u00e9dition",
  "sourcing.gallery.title":
    "Ce que nous pouvons faire fabriquer",
  "sourcing.gallery.note":
    "Photos des fabricants avec qui nous travaillons \u2014 des exemples de ce qu'ils produisent. Les prix et les quantit\u00e9s minimales d\u00e9pendent de votre projet ; nous confirmons les deux avant tout devis.",
  "sourcing.alt.cartons":
    "\u00c9tuis pliants imprim\u00e9s, plusieurs couleurs",
  "sourcing.alt.display":
    "Pr\u00e9sentoirs de comptoir imprim\u00e9s et petites bo\u00eetes assorties",
  "sourcing.alt.rigid":
    "Coffret rigide avec fourreau imprim\u00e9 et calages",
  "sourcing.alt.mailer":
    "Bo\u00eete d'exp\u00e9dition imprim\u00e9e, verte",
  "sourcing.alt.small":
    "Petites bo\u00eetes imprim\u00e9es pour bougies",
  "sourcing.alt.colour":
    "Bo\u00eetes imprim\u00e9es en rose et jaune",
  "sourcing.alt.drawer":
    "Bo\u00eetes tiroir en trois couleurs",
  "sourcing.alt.gable":
    "Bo\xeete \xe0 g\xe2teau blanche \xe0 poign\xe9e, ferm\xe9e",
  "sourcing.alt.gableOpen":
    "La m\xeame bo\xeete vue de dessus, panneaux de poign\xe9e ouverts",
  "sourcing.alt.carrier":
    "Bo\xeete de transport \xe0 poign\xe9e d\xe9coup\xe9e, vue de c\xf4t\xe9",
  "sourcing.alt.carrierHand":
    "Une main qui porte la bo\xeete par sa poign\xe9e",
  "sourcing.alt.carrierOpen":
    "La bo\xeete de transport, rabats ouverts",
  "sourcing.alt.lids":
    "Neuf profils de couvercles transparents pour gobelets",
  "sourcing.alt.cupDims":
    "Gobelet PET transparent avec ses dimensions : 92 \xe0 93 mm au bord, 56 mm de haut, 55 mm au fond",
  "sourcing.alt.iceCups":
    "Pots \xe0 glace en carton imprim\xe9s d'un motif de feuille",
  "sourcing.alt.cutlery":
    "Six formes de couverts en bois pos\xe9es sur de l'ardoise, avec un sachet papier",
  "sourcing.alt.spoon":
    "Une cuill\xe8re jetable blanche",
  "sourcing.alt.cupsSet":
    "Un gobelet \xe0 boisson glac\xe9e, son couvercle bomb\xe9 et une paille",
  "sourcing.alt.cupChart":
    "Le tableau des tailles d'un fournisseur pour des pots transparents, de 30 \xe0 300ml",
  "sourcing.alt.bagsColour":
    "Sacs \xe0 poign\xe9e d\xe9coup\xe9e en cinq couleurs",
  "sourcing.alt.cupDomeNavy":
    "Un gobelet transparent \xe0 couvercle bomb\xe9",
  "sourcing.alt.boxKraftSmall":
    "Une petite bo\xeete kraft, ferm\xe9e puis ouverte",
  "sourcing.alt.boxKraftStacked":
    "Deux bo\xeetes kraft empil\xe9es",
  "sourcing.alt.boxShippingPink":
    "Une bo\xeete d'exp\xe9dition rose ouverte sur son calage en papier froiss\xe9",
  "sourcing.alt.trayBagasse":
    "Un plateau en fibre \xe0 compartiments, avec son couvercle",
  "sourcing.alt.boxKraftWindow":
    "Une bo\xeete kraft \xe0 fen\xeatre transparente, ferm\xe9e puis ouverte",
  "sourcing.alt.bagsKraftHandles":
    "Sacs kraft \xe0 poign\xe9es cord\xe9es, plusieurs tailles",
  "sourcing.alt.pouchStandup":
    "Pochettes kraft autoportantes \xe0 fen\xeatre transparente",
  "sourcing.alt.bagsBakeryHand":
    "Trois tailles de sac boulangerie \xe0 fen\xeatre, l'un tenu \xe0 la main",
  "sourcing.alt.cakeCarrierStripe":
    "Une bo\xeete g\xe2teau blanche \xe0 rayures roses, port\xe9e par sa poign\xe9e",
  "sourcing.alt.labels":
    "\u00c9tiquettes holographiques dor\u00e9es dans leur carton",
  "brand.app.carton":
    "\u00c9tui pliant",
  "brand.app.mailer":
    "Bo\u00eete d'exp\u00e9dition",
  "brand.app.small":
    "Petite bo\u00eete imprim\u00e9e",
  "brand.app.gift":
    "Coffret rigide",
  "brand.app.display":
    "Pr\u00e9sentoir de comptoir",
  "brand.app.label":
    "\u00c9tiquette",
  "brand.world.caveat":
    "Vos couleurs et vos lettres sur les mati\u00e8res r\u00e9elles que Brandora source. Une indication, pas un bon \u00e0 tirer \u2014 c'est le fabricant qui le produit une fois vos fichiers re\u00e7us.",

  "legal.eyebrow": "Mentions l\u00e9gales",

  "legal.privacy.title": "Politique de confidentialit\u00e9",
  "legal.privacy.updated": "Derni\u00e8re mise \u00e0 jour en ao\u00fbt 2026.",
  "legal.privacy.intro":
    "Brandora Union (\u00ab Brandora \u00bb, \u00ab nous \u00bb) cr\u00e9e des marques et fait fabriquer les produits qui les portent pour de petites entreprises, depuis Abidjan, C\u00f4te d'Ivoire. Cette page d\u00e9crit ce que nous collectons sur brandoraunion.online, pourquoi, et ce que vous pouvez nous demander \u00e0 ce sujet.",
  "legal.privacy.h.collect": "Ce que nous collectons",
  "legal.privacy.p.collect-1":
    "\u00c0 la cr\u00e9ation de votre compte : votre nom, votre adresse e-mail et votre mot de passe, ainsi que \u2014 seulement si vous choisissez de les donner \u2014 votre pays et votre num\u00e9ro de t\u00e9l\u00e9phone.",
  "legal.privacy.p.collect-2":
    "Quand vous utilisez le cr\u00e9ateur de marque : vos r\u00e9ponses aux questions de l'entretien (votre activit\u00e9, votre produit, votre public, votre positionnement), et la marque, l'identit\u00e9 et le pack que Brandora en g\u00e9n\u00e8re.",
  "legal.privacy.p.collect-3":
    "Quand vous demandez un devis, passez une commande, ou t\u00e9l\u00e9versez un logo pour un fabricant : les informations que vous saisissez dans ce formulaire, et le fichier lui-m\u00eame.",
  "legal.privacy.p.collect-4":
    "Si vous vous connectez avec Google, nous recevons le nom, l'adresse e-mail et la photo de profil que Google partage \u00e0 cette fin \u2014 rien d'autre de votre compte Google.",
  "legal.privacy.h.use": "Pourquoi nous l'utilisons",
  "legal.privacy.p.use":
    "Pour faire fonctionner votre compte, g\u00e9n\u00e9rer votre marque, calculer et honorer vos commandes, r\u00e9pondre \u00e0 vos demandes de devis, et vous r\u00e9pondre quand vous nous contactez. Nous ne vendons pas vos donn\u00e9es et ne les utilisons pas pour vous montrer de la publicit\u00e9.",
  "legal.privacy.h.share": "Avec qui nous les partageons",
  "legal.privacy.p.share-1":
    "Un petit nombre de prestataires traitent des donn\u00e9es pour notre compte, uniquement dans le but indiqu\u00e9 : Anthropic g\u00e9n\u00e8re votre strat\u00e9gie de marque et votre identit\u00e9 \u00e0 partir de vos r\u00e9ponses \u00e0 l'entretien ; Resend d\u00e9livre nos e-mails transactionnels (compte, commandes, devis) ; Paystack traite les paiements \u2014 Brandora ne voit ni ne conserve jamais les donn\u00e9es de votre carte ; et, si vous les utilisez, Google pour la connexion et Calendly pour r\u00e9server un appel appliquent leur propre politique de confidentialit\u00e9 pour cette interaction.",
  "legal.privacy.p.share-2":
    "Nous ne partageons vos donn\u00e9es avec personne d'autre, et nous n'utilisons aucun traceur publicitaire ni analytique sur ce site.",
  "legal.privacy.h.cookies": "Cookies et stockage local",
  "legal.privacy.p.cookies":
    "Un seul cookie vous garde connect\u00e9 \u2014 il identifie votre session et rien d'autre, et aucun script de cette page ne peut le lire. Votre langue, votre pr\u00e9f\u00e9rence clair ou sombre, et la marque sur laquelle vous travailliez sont conserv\u00e9es dans le stockage de votre propre navigateur, sur votre appareil, pour que revenir sur le site ne les efface pas.",
  "legal.privacy.h.retention": "Combien de temps nous les gardons",
  "legal.privacy.p.retention-1":
    "Nous gardons vos donn\u00e9es tant que votre compte est actif. Nous n'avons pas encore de moyen en libre-service d'exporter ou de supprimer votre compte \u2014 \u00e9crivez \u00e0",
  "legal.privacy.p.retention-2":
    "et nous nous en occuperons directement.",
  "legal.privacy.h.rights": "Vos droits",
  "legal.privacy.p.rights":
    "Vous pouvez nous demander ce que nous d\u00e9tenons sur vous, nous demander de le corriger, ou nous demander de le supprimer, \u00e0 la m\u00eame adresse. Nous donnerons suite \u00e0 une demande de suppression, sauf si nous devons conserver quelque chose \u2014 l'historique d'une commande pay\u00e9e, par exemple \u2014 pour des raisons comptables ou l\u00e9gales.",
  "legal.privacy.h.children": "Enfants",
  "legal.privacy.p.children":
    "Brandora est un service destin\u00e9 aux entreprises et ne s'adresse pas aux enfants. Nous ne collectons pas sciemment de donn\u00e9es de personnes de moins de 16 ans.",
  "legal.privacy.h.changes": "Modifications de cette politique",
  "legal.privacy.p.changes":
    "Si cette politique change de fa\u00e7on significative, nous mettrons \u00e0 jour la date en haut de cette page et, pour un changement important, nous vous pr\u00e9viendrons par e-mail.",
  "legal.privacy.h.contact": "Contact",

  "legal.terms.title": "Conditions d'utilisation",
  "legal.terms.updated": "Derni\u00e8re mise \u00e0 jour en ao\u00fbt 2026.",
  "legal.terms.intro":
    "Voici les conditions d'utilisation de brandoraunion.online, exploit\u00e9 par Brandora Union depuis Abidjan, C\u00f4te d'Ivoire. Cr\u00e9er un compte, demander un devis ou passer une commande signifie que vous les acceptez.",
  "legal.terms.h.service": "Le service",
  "legal.terms.p.service-1":
    "Brandora g\u00e9n\u00e8re une marque \u2014 un nom, un positionnement, une palette et une identit\u00e9 \u2014 \u00e0 partir de vos r\u00e9ponses, et vous aide \u00e0 la transformer en produits physiques de notre catalogue. Certains produits ont un prix fixe \u00e0 une quantit\u00e9 donn\u00e9e ; d'autres sont marqu\u00e9s \u00ab prix sur demande \u00bb parce que le co\u00fbt d\u00e9pend d'un tarif de fret que nous n'avons pas encore obtenu, et nous ne vous montrerons jamais un chiffre invent\u00e9 \u00e0 sa place.",
  "legal.terms.p.service-2":
    "Il n'existe pas encore de place de march\u00e9 pour les fabricants sur Brandora. Cliquer sur la photo d'un produit pour demander un devis envoie votre demande par e-mail ; nous vous recontactons directement plut\u00f4t que via un portail automatis\u00e9.",
  "legal.terms.h.accounts": "Comptes",
  "legal.terms.p.accounts":
    "Vous \u00eates responsable de l'exactitude des informations de votre compte et de la confidentialit\u00e9 de votre mot de passe. Vous devez \u00eatre en capacit\u00e9 de conclure un contrat pour en cr\u00e9er un.",
  "legal.terms.h.orders": "Commandes, tarifs et paiement",
  "legal.terms.p.orders-1":
    "Les prix sont affich\u00e9s en francs CFA ouest-africains (XOF) et incluent la marge de sourcing et de coordination de Brandora. Un devis est valable pour la dur\u00e9e indiqu\u00e9e dessus ; pass\u00e9 ce d\u00e9lai, les prix peuvent avoir chang\u00e9 et un nouveau devis est n\u00e9cessaire.",
  "legal.terms.p.orders-2":
    "Le paiement est trait\u00e9 par Paystack. Nous ne voyons ni ne conservons jamais les donn\u00e9es de votre carte. Une commande est confirm\u00e9e une fois le paiement v\u00e9rifi\u00e9 comme re\u00e7u.",
  "legal.terms.h.delivery": "Livraison",
  "legal.terms.p.delivery":
    "Les frais de livraison affich\u00e9s au paiement sont notre propre frais de livraison locale, pas un tarif transporteur \u2014 nous ne publions une date de livraison qu'une fois qu'elle a r\u00e9ellement \u00e9t\u00e9 confirm\u00e9e pour votre commande.",
  "legal.terms.h.cancellation": "Annulations",
  "legal.terms.p.cancellation":
    "Comme la plupart des commandes sont fabriqu\u00e9es pour vous plut\u00f4t que stock\u00e9es, les conditions d'annulation d\u00e9pendent de l'avancement de la production au moment o\u00f9 vous demandez \u2014 contactez-nous d\u00e8s que possible, et nous vous dirons pr\u00e9cis\u00e9ment o\u00f9 en sont les choses.",
  "legal.terms.h.ip": "Propri\u00e9t\u00e9 intellectuelle",
  "legal.terms.p.ip":
    "La marque, le nom et l'identit\u00e9 que Brandora g\u00e9n\u00e8re pour vous vous appartiennent une fois votre commande pay\u00e9e. Brandora Union conserve la propri\u00e9t\u00e9 du logiciel, du catalogue et du site lui-m\u00eame.",
  "legal.terms.h.liability": "Responsabilit\u00e9",
  "legal.terms.p.liability":
    "Nous nous effor\u00e7ons de fournir des informations de prix, de disponibilit\u00e9 et de livraison exactes, mais Brandora n'est pas responsable des pertes indirectes r\u00e9sultant de retards ou d'erreurs hors de notre contr\u00f4le raisonnable, y compris de la part de nos fournisseurs ou de notre prestataire de paiement.",
  "legal.terms.h.law": "Droit applicable",
  "legal.terms.p.law":
    "Ces conditions sont r\u00e9gies par le droit de C\u00f4te d'Ivoire.",
  "legal.terms.h.changes": "Modifications de ces conditions",
  "legal.terms.p.changes":
    "Si nous modifions ces conditions de fa\u00e7on significative, nous mettrons \u00e0 jour la date en haut de cette page.",
  "legal.terms.h.contact": "Contact",

  "ui.catalog.see-details": "Voir les détails de {product}",
  "ui.catalog.see-details-short": "Voir les détails",

  "product.back": "← Retour au catalogue",
  "product.not-found": "Ce produit est introuvable. Il a peut-être été retiré du catalogue.",
  "product.quote.title": "Demander un devis",
  "product.quote.lede": "Aucun compte n'est nécessaire. Décrivez ce qu'il vous faut et nous vous répondrons par e-mail.",
  "product.quote.not-instant": "Ceci est une demande de personnalisation, pas un achat instantané : Brandora Union confirme le coût de livraison et le délai exact après examen de votre demande.",
  "product.quote.name": "Votre nom",
  "product.quote.company": "Entreprise / marque (optionnel)",
  "product.quote.email": "E-mail",
  "product.quote.phone": "Téléphone (optionnel)",
  "product.quote.quantity": "Quantité souhaitée",
  "product.quote.material": "Matière",
  "product.quote.shape": "Forme",
  "product.quote.dimensions": "Dimensions",
  "product.quote.quality": "Qualité / spécification",
  "product.quote.quality-placeholder": "Ex. qualité alimentaire, finition mate",
  "product.quote.color": "Couleur / préférence",
  "product.quote.color-placeholder": "Ex. bleu marine, kraft naturel",
  "product.quote.timeframe": "Délai de livraison souhaité (optionnel)",
  "product.quote.timeframe-placeholder": "Ex. sous 4 semaines",
  "product.quote.deliveryMethod": "Livraison ou retrait",
  "product.quote.deliveryMethod.unset": "Pas encore décidé",
  "product.quote.deliveryMethod.delivery": "Livraison",
  "product.quote.deliveryMethod.pickup": "Retrait",
  "product.quote.customization": "Personnalisation souhaitée",
  "product.quote.custom.logo": "Logo",
  "product.quote.custom.design": "Design complet",
  "product.quote.custom.printing": "Impression",
  "product.quote.custom.sticker": "Sticker",
  "product.quote.custom.embossing": "Gaufrage",
  "product.quote.custom.other": "Autre",
  "product.quote.logo": "Téléverser votre logo / design (optionnel)",
  "product.quote.destination": "Destination",
  "product.quote.destination-placeholder": "Ville, pays",
  "product.quote.message": "Message additionnel (optionnel)",
  "product.quote.submit": "Demander un devis",
  "product.quote.sent-title": "Demande envoyée",
  "product.quote.sent-body": "Nous avons bien reçu votre demande. Nous vous répondrons par e-mail.",
  "product.quote.bad-quantity": "Indiquez un nombre entier supérieur à zéro.",
  "product.detail.height": "hauteur",
  "product.detail.no-photo": "Pas encore de photo.",
  "product.detail.material": "Matière",
  "product.detail.shape": "Forme",
  "product.detail.dimensions": "Dimensions",
  "product.detail.colors": "Couleurs",
  "product.detail.minimum": "Quantité minimale",
  "product.detail.minimum-unconfirmed": "Pas encore confirmée — dites-nous combien il vous faut",
  "product.detail.price": "Prix",
  "product.detail.customization": "Personnalisation",
  "product.detail.notes": "Notes",
  "product.detail.not-confirmed": "Non confirmé par le fabricant pour le moment — dites-nous ce qu'il vous faut.",

  "gate.eyebrow": "Créer ma marque",
  "gate.title": "Avez-vous déjà une marque ?",
  "gate.lede": "Cela détermine lequel des deux parcours ci-dessous vous convient — chacun prend moins d'une minute pour démarrer.",
  "gate.has-brand.title": "Oui — j'ai déjà ma marque",
  "gate.has-brand.body": "Vous avez un nom, un logo, un slogan. Allez directement au catalogue, téléversez votre logo sur un produit, et demandez un devis.",
  "gate.needs-brand.title": "Non — je veux créer ma marque",
  "gate.needs-brand.body": "Un court entretien sur votre activité, votre produit et votre public — Brandora en tire un nom, un positionnement, une palette et une identité.",

  "pricing.eyebrow": "Tarification",
  "pricing.title": "Comment fonctionnent nos prix",
  "pricing.lede": "Une formule, pas une estimation à l'œil. Voici exactement ce qui compose le prix que vous voyez, et pourquoi.",
  "pricing.formula.label": "La formule",
  "pricing.formula.text": "Prix final = Coût produit + Coût de livraison + Marge de service Brandora",
  "pricing.h.product-cost": "Coût produit",
  "pricing.p.product-cost": "Ce que le fabricant facture pour le produit lui-même, au fournisseur réel derrière chaque article du catalogue — jamais un chiffre approximatif.",
  "pricing.h.shipping-cost": "Coût de livraison",
  "pricing.p.shipping-cost": "Le coût logistique estimé — ou, une fois confirmé, réel — associé à votre commande : fret international, douane et livraison locale selon le cas.",
  "pricing.h.margin": "Marge de service Brandora",
  "pricing.p.margin-1": "Un pourcentage transparent, ajouté sur le coût produit et le coût de livraison réunis, pour couvrir le sourcing, la coordination avec le fournisseur, le contrôle qualité, la gestion de commande et le fonctionnement de la plateforme. Ce taux est configurable plutôt que codé en dur — il est actuellement fixé à",
  "pricing.p.margin-2": ", dans une fourchette annoncée de 25 à 35 %.",
  "pricing.h.example": "Exemple chiffré",
  "pricing.example.product": "Coût produit",
  "pricing.example.shipping": "Coût de livraison",
  "pricing.example.margin": "Marge Brandora",
  "pricing.example.total": "Prix final",
  "pricing.example.note": "À titre d'illustration uniquement — vos devis réels sont exprimés en francs CFA (XOF).",
  "pricing.h.states": "Estimé, puis confirmé",
  "pricing.states.estimated-label": "Prix estimé",
  "pricing.p.states-1": "— calculé à partir du produit choisi, de la quantité, et d'un coût fournisseur et d'une livraison estimés. C'est ce que vous voyez en parcourant le catalogue.",
  "pricing.states.confirmed-label": "Devis confirmé",
  "pricing.p.states-2": "— une fois que nous avons échangé avec le fabricant : prix fournisseur final, livraison confirmée, et la même marge Brandora. Les prix de fabrication varient selon la quantité minimale, la matière, la personnalisation, l'emballage, la destination et le mode d'expédition — le devis confirmé tient compte de tout cela.",
  "pricing.h.transparency": "Ce que nous montrons, ce que nous gardons privé",
  "pricing.p.transparency": "Nous sommes transparents sur la méthode : votre prix, c'est coût produit + livraison + marge de service Brandora. Le coût exact négocié avec chaque fournisseur reste dans notre système interne — la transparence sur la formule ne veut pas dire divulguer les conditions commerciales confidentielles de nos fournisseurs.",
};
