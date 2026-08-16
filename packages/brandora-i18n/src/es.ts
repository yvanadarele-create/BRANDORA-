import type { Catalogue } from "./en.js";

/** Spanish. Typed as `Catalogue`, so omitting a key fails the build. */
export const es: Catalogue = {
  "nav.home": "Inicio",
  "nav.create": "Crear mi marca",
  "nav.catalog": "Catálogo",
  "nav.package": "Mi paquete",
  "nav.visualizer": "Visualizador",
  "nav.quote": "Presupuesto",
  "nav.orders": "Pedidos",
  "nav.trends": "Tendencias",
  "nav.assistant": "Preguntar a Brandora",
  "nav.settings": "Ajustes",
  "nav.dashboard": "Panel",
  "nav.login": "Iniciar sesión",
  "nav.signup": "Crear cuenta",
  "nav.logout": "Cerrar sesión",

  /* La empresa.

     «Brandora Union» es la empresa; «Brandora» sigue siendo el producto — por
     eso nav.assistant sigue diciendo «Preguntar a Brandora». */
  "brand.company": "Brandora Union",
  "brand.tagline": "Donde las marcas toman forma.",
  "brand.what": "Infraestructura para crear marcas físicas.",

  "chain.title": "Una empresa, toda la cadena",
  "chain.lede":
    "En esta cadena es donde una marca pequeña pierde dinero — un proveedor que no puede con la cantidad, una producción fuera de especificación, un envío que nadie sigue. Brandora Union gestiona los seis eslabones, para que ninguno sea el problema de otro.",
  "chain.brands": "Marcas",
  "chain.products": "Productos",
  "chain.manufacturers": "Fabricantes",
  "chain.production": "Producción",
  "chain.quality": "Calidad",
  "chain.logistics": "Logística",

  "contact.title": "Contáctanos",
  "contact.email": "Correo",
  "contact.phone": "Teléfono",

  "sourcing.eyebrow": "Lo que puedes abastecer",
  "sourcing.title": "Empaque, impresión y producto",
  "sourcing.lede": "Todo lo de abajo está hoy en el catálogo, con precio y pedible en cantidades pequeñas.",
  "sourcing.browse": "Ver todo el catálogo",

  "ask.eyebrow": "Preguntar a Brandora",
  "ask.title": "¿No sabes qué abastecer?",
  "ask.lede":
    "Describe lo que necesitas con tus palabras. Brandora lee la petición, busca en el catálogo real y te dice qué se puede pedir de verdad a tu cantidad.",
  "ask.grounding":
    "Responde desde el catálogo y tu marca guardada — nunca a ojo. Si nada encaja, lo dice en vez de sugerir algo que no existe.",
  "ask.cta": "Preguntar a Brandora",
  "ask.example.q": "Necesito 2.000 cajas cosméticas de lujo, negro mate, con mi logo, entregadas en Abiyán.",
  "ask.example.a":
    "Lee la cantidad, el material, el acabado, el marcado y el destino — y solo preselecciona lo registrado como pedible a 2.000, diciendo qué falta en vez de rellenarlo.",

  "network.eyebrow": "La unión",
  "network.title": "Entre la marca y la fábrica",
  "network.lede":
    "Una fundadora en Abiyán y un fabricante capaz de hacer lo que necesita son dos personas que nunca se encontrarán. Brandora Union es esa conexión — con el control de calidad, los documentos y el envío que la acompañan.",
  "network.brands": "Marcas",
  "network.brands.note": "Una idea, una identidad y una cantidad lo bastante pequeña para probar.",
  "network.makers": "Fabricantes",
  "network.makers.note": "Capacidad, herramental y un precio que solo se sostiene con volumen.",

  "founder.eyebrow": "La fundadora",
  "founder.role": "Fundadora, Brandora Union — Abiyán, Costa de Marfil",

  "join.title": "Sigue lo que estamos construyendo.",
  "join.lede": "Novedades sobre fabricantes, productos, oportunidades de abastecimiento y lanzamientos de Brandora Union.",
  "join.label": "Tu correo",
  "join.placeholder": "tu@ejemplo.com",
  "join.cta": "Unirme a la red",

  "footer.platform": "Plataforma",
  "footer.company": "Empresa",
  "footer.sourcing": "Abastecimiento",
  "footer.network": "Fabricantes",
  "footer.about": "Nosotros",
  "footer.contact": "Contacto",
  "footer.place": "Abiyán, Costa de Marfil",

  "network.stat.makers": "Fabricantes",
  "network.stat.countries": "Países",
  "words.eyebrow": "En sus palabras",
  "words.title": "Lo que dicen las personas con las que trabajamos",

  /* Errores. */
  "error.auth.invalid": "Tu correo o tu contraseña no son correctos.",
  "error.network": "No podemos conectar con Brandora. Revisa tu conexión e inténtalo de nuevo.",
  "error.CONFIGURATION_INCOMPLETE": "El servicio aún no está completamente configurado. Nada de lo que escribiste se ha perdido — nuestro equipo ha sido avisado.",
  "error.SERVICE_UNAVAILABLE": "El servicio no está disponible temporalmente. Nada de lo que escribiste se ha perdido — inténtalo en un momento.",
  "error.unknown": "Algo salió mal. Inténtalo de nuevo.",

  "state.loading": "Cargando…",
  "state.catalog.loading": "Cargando el catálogo…",
  "state.catalog.empty": "Ningún producto coincide con tu búsqueda.",
  "state.catalog.unavailable": "No podemos cargar el catálogo en este momento.",
  "state.catalog.preparing": "Nuestro catálogo está en preparación. Vuelve pronto, o dinos qué buscas.",
  "state.interview.loading": "Preparando tu entrevista…",
  "state.interview.error": "No pudimos cargar tu entrevista.",
  "state.account.creating": "Creando tu cuenta…",
  "state.signing-in": "Iniciando sesión…",
  "state.session.expired": "Tu sesión ha caducado. Inicia sesión de nuevo.",

  "hero.headline": "Crea tu marca. Nosotros la hacemos real.",
  "hero.subheadline":
    "Identidad de marca, productos, empaque y fabricación — conectados en una sola plataforma.",
  "hero.cta.primary": "Empezar",
  "hero.cta.secondary": "Explorar sourcing",
  "hero.cta.ai": "Preguntar a Brandora",
  "hero.positioning": "De la idea a la identidad, hasta la marca física.",

  "how.title": "Cómo funciona",
  "how.01": "Cuéntanos tu idea",
  "how.02": "Construye tu identidad",
  "how.03": "Elige tus productos",
  "how.04": "Visualiza tu marca",
  "how.05": "Recibe tu presupuesto",
  "how.06": "Haz el pedido",

  "section.brand.title": "Creación de marca",
  "section.brand.body": "La idea se vuelve identidad. La identidad se vuelve un logo que es tuyo.",
  "section.physical.title": "Marca física",
  "section.physical.body": "Tu logo en vasos, cajas, bolsas, pegatinas y tarjetas.",
  "section.sourcing.title": "Abastecimiento con IA",
  "section.sourcing.body":
    "Dile a Brandora qué necesitas. Busca proveedores, compara las opciones y devuelve un presupuesto.",
  "section.visualizer.title": "Visualizador",
  "section.visualizer.body": "Ve tu marca en productos reales antes de gastar nada.",
  "section.africa.title": "Pensado para cómo arrancan de verdad los negocios pequeños",
  "section.africa.body":
    "Cantidades pequeñas, abastecimiento flexible, entrega local, primero móvil y métodos de pago que funcionan donde estás.",
  "cta.final": "Tu idea merece una marca.",

  "builder.title": "Construyamos tu marca.",
  "builder.step.interview": "Entrevista",
  "builder.step.strategy": "Estrategia",
  "builder.step.identity": "Identidad",
  "builder.step.logo": "Logo",
  "builder.dontknow": "No lo sé — ayúdame",
  "builder.next": "Continuar",
  "builder.back": "Atrás",
  "builder.regenerate": "Regenerar",
  "builder.save": "Guardar mi marca",
  "builder.generating": "Creando tu marca…",

  "brand.name": "Nombre de la marca",
  "brand.description": "Descripción",
  "brand.positioning": "Posicionamiento",
  "brand.target": "Cliente objetivo",
  "brand.personality": "Personalidad",
  "brand.promise": "Promesa",
  "brand.mission": "Misión",
  "brand.vision": "Visión",
  "brand.slogan": "Eslogan",
  "brand.tone": "Tono de voz",
  "brand.story": "Historia de la marca",
  "brand.palette": "Paleta de colores",
  "brand.typography": "Tipografía",
  "brand.logoBrief": "Dirección del logo",
  "brand.kit.download": "Descargar kit de marca",

  "catalog.title": "Catálogo",
  "catalog.category.packaging": "Empaque",
  "catalog.category.brand-materials": "Materiales de marca",
  "catalog.category.tableware": "Vajilla",
  "catalog.category.merchandise": "Merchandising",
  "catalog.moq": "Desde {min} unidades",
  "catalog.customizable": "Personalización disponible",
  "catalog.customization.unknown": "Personalización sin confirmar",
  "catalog.add": "Añadir a mi paquete",
  "catalog.empty": "Todavía no hay nada aquí.",

  "sourcing.best": "Mejor opción",
  "sourcing.cheapest": "Precio más bajo",
  "sourcing.fastest": "Opción más rápida",
  "sourcing.score": "Puntuación Brandora",
  "sourcing.quantity.ok": "Cantidad: compatible",
  "sourcing.quantity.no": "Cantidad: no disponible en este volumen",
  "sourcing.shipping.ok": "Envío: disponible",
  "sourcing.delivery.unavailable": "Estimación de entrega no disponible",
  "sourcing.stale": "Precios confirmados {when}",

  "package.title": "Paquete de marca",
  "package.add": "Añadir producto",
  "package.remove": "Quitar",
  "package.quantity": "Cantidad",
  "package.total": "Total estimado",
  "package.empty": "Tu paquete está vacío. Añade un producto para empezar.",

  "quote.title": "Presupuesto Brandora",
  "quote.reference": "Referencia",
  "quote.products": "Coste de productos",
  "quote.customization": "Personalización",
  "quote.shipping": "Envío",
  "quote.logistics": "Logística",
  "quote.service": "Servicio Brandora",
  "quote.total": "Total",
  "quote.validUntil": "Válido hasta el {date}",
  "quote.approve": "Aprobar presupuesto",
  "quote.modify": "Modificar",

  "checkout.title": "Pago",
  "checkout.name": "Nombre completo",
  "checkout.email": "Correo electrónico",
  "checkout.phone": "Teléfono",
  "checkout.whatsapp": "WhatsApp",
  "checkout.address": "Dirección de entrega",
  "checkout.city": "Ciudad",
  "checkout.country": "País",
  "checkout.instructions": "Instrucciones de entrega",
  "checkout.terms": "Acepto los términos",
  "checkout.submit": "Realizar pedido",

  "order.status.quote": "Presupuesto",
  "order.status.pending-approval": "Pendiente de aprobación",
  "order.status.confirmed": "Confirmado",
  "order.status.supplier-processing": "En proceso con el proveedor",
  "order.status.shipped": "Enviado",
  "order.status.in-transit": "En tránsito",
  "order.status.delivered": "Entregado",
  "order.status.cancelled": "Cancelado",
  "order.tracking": "Número de seguimiento",
  "order.carrier": "Transportista",

  "notify.quote.ready": "Tu presupuesto está listo.",
  "notify.order.confirmed": "Tu pedido al proveedor está confirmado.",
  "notify.order.shipped": "Tu paquete ha salido.",
  "notify.order.delivered": "Tu pedido ha sido entregado.",

  "settings.title": "Ajustes",
  "settings.language": "Idioma",
  "settings.currency": "Moneda",
  "settings.theme": "Apariencia",
  "settings.theme.dark": "Oscuro",
  "settings.theme.light": "Claro",
  "settings.country": "País",
  "settings.save": "Guardar cambios",
  "settings.saved": "Guardado",

  /* Cuenta y panel */
  "nav.admin": "Administración",
  "cta.book": "Reservar una llamada",
  "assistant.send": "Preguntar",
  "auth.eyebrow": "Tu cuenta",
  "auth.email": "Correo electrónico",
  "auth.password": "Contraseña",
  "auth.password.hint":
    "Al menos 10 caracteres. Una frase que recuerdes vale más que una contraseña corta llena de símbolos.",
  "auth.name": "Tu nombre",
  "auth.country": "País",
  "auth.login.title": "Bienvenido de nuevo",
  "auth.login.lede": "Tus marcas, paquetes y pedidos están donde los dejaste.",
  "auth.login.submit": "Iniciar sesión",
  "auth.login.alt": "¿Nuevo en Brandora?",
  "auth.signup.title": "Crear una cuenta",
  "auth.signup.lede": "Una cuenta para cada marca que construyas, cada presupuesto y cada pedido.",
  "auth.signup.submit": "Crear mi cuenta",
  "auth.signup.alt": "¿Ya tienes una cuenta?",

  "dashboard.title": "Tu trabajo",
  "dashboard.brands": "Mis marcas",
  "dashboard.quotes": "Mis presupuestos",
  "dashboard.orders": "Mis pedidos",

  "builder.generate": "Crear mi marca",
  "builder.step.review": "Listo",
  "package.quote": "Obtener mi presupuesto",
  "package.recommended": "Recomendado para tu marca",

  "error.sourcing.unavailable":
    "No hemos podido obtener este producto ahora mismo. Prueba con otra opción.",
  "error.sourcing.no-results":
    "Todavía no encontramos una coincidencia. Prueba con otra cantidad o estilo.",
  "error.freight.unavailable": "Estimación de entrega no disponible",
  "error.brand.generation-failed":
    "No hemos podido terminar tu marca. Tus respuestas están guardadas — inténtalo de nuevo.",
  "error.brand.interview-incomplete":
    "Responde primero a las preguntas que faltan y después construimos tu marca.",
  "error.brand.not-generated": "Crea primero tu marca — esto parte de lo que dice.",
  "error.package.empty": "Añade al menos un producto antes de pedir un presupuesto.",
  "error.payment.not-started": "Todavía no se ha iniciado ningún pago para este pedido.",
  "error.quote.expired": "Este presupuesto ha caducado. Podemos preparar uno nuevo.",
  "error.order.not-found": "No hemos encontrado ese pedido.",
  "error.auth.required": "Inicia sesión para continuar.",
  "error.auth.weak-password": "Elige una contraseña más larga: al menos 10 caracteres.",
  "error.auth.forbidden": "No tienes acceso a esto.",
  "error.input.invalid": "Algo en el formulario no está bien. Revísalo e inténtalo de nuevo.",
  "error.rate.limited": "Son muchas peticiones. Espera un momento e inténtalo de nuevo.",
  "error.internal": "Algo ha fallado por nuestra parte. Estamos en ello.",
  "ui.catalog.add-to-package":
    "A\u00f1adir a mi lote",
  "ui.catalog.raise-quantity":
    "Pedido m\u00ednimo: {min}. Aumenta tu cantidad para a\u00f1adirlo.",
  "ui.catalog.per-unit":
    "{price} por unidad",
  "ui.catalog.minimum":
    "M\u00ednimo {min}",
  "ui.catalog.delivery-later":
    "La estimaci\u00f3n de entrega estar\u00e1 disponible cuando se confirme tu pedido.",
  "ui.catalog.no-match":
    "Nada coincide por ahora. Prueba otra categor\u00eda u otra cantidad.",
  "ui.catalog.preparing":
    "Nuestro cat\u00e1logo est\u00e1 en preparaci\u00f3n. Estamos reuniendo nuestras primeras referencias.",
  "ui.catalog.count":
    "{shown} de {total} productos se pueden pedir con {quantity} unidades.",
  "ui.catalog.browsing-for":
    "Est\u00e1s explorando para {brand}. Los productos que recomendamos est\u00e1n se\u00f1alados.",
  "ui.catalog.recommended":
    "Recomendado: {reason}",
  "ui.catalog.see-in-catalogue":
    "Ver en el cat\u00e1logo",
  "ui.catalog.load-failed":
    "No se ha podido cargar el cat\u00e1logo en este momento. ",
  "ui.catalog.browse-directly":
    "Explorarlo directamente",
  "ui.catalog.from-units":
    " \u00b7 desde {min} unidades",
  "ui.catalog.from-unit":
    " \u00b7 desde {min} unidad",
  "ui.package.open-brand-book":
    "Abrir el libro de marca \u2192",
  "ui.package.with-logo":
    "Con tu logotipo \u00b7 {method}",
  "ui.package.rounded-up":
    "Pediste {requested}; este producto empieza en {charged}, as\u00ed que eso es lo que se cotiza.",
  "ui.package.add-to-see-total":
    "A\u00f1ade un producto para ver tu total.",
  "ui.package.totals":
    "Totales del lote",
  "ui.package.delivery-note":
    "El env\u00edo es una tarifa de Brandora, no un presupuesto de transportista. La estimaci\u00f3n se confirma al pedir.",
  "ui.dashboard.items-in-package":
    "{count} productos en el lote",
  "ui.dashboard.item-in-package":
    "{count} producto en el lote",
  "ui.dashboard.brand-book":
    "Libro de marca",
  "ui.dashboard.no-brands":
    "A\u00fan no hay marcas",
  "ui.dashboard.no-brands-hint":
    "La entrevista lleva unos minutos y podr\u00e1s cambiarlo todo despu\u00e9s.",
  "ui.dashboard.no-quotes":
    "A\u00fan no hay presupuestos.",
  "ui.dashboard.no-orders":
    "A\u00fan no hay pedidos.",
  "ui.assistant.searching":
    "Buscando en el cat\u00e1logo\u2026",
  "ui.assistant.product-meta":
    "M\u00ednimo {min} \u00b7 {category}",
  "ui.assistant.needs-brand":
    "Crea primero una marca \u2014 el asistente responde a partir de ella. ",
  "ui.assistant.placeholder-hint":
    "Productos, embalaje, cantidades, por d\u00f3nde empezar \u2014 respondido a partir de {brand}.",
  "ui.order.reference":
    "Pedido {reference}",
  "ui.quote.held-until":
    "V\u00e1lido hasta el {date}",
  "ui.network.being-built":
    "La red de fabricantes se est\u00e1 construyendo. Los socios verificados aparecer\u00e1n aqu\u00ed a medida que se incorporen.",
  "ui.booking.book-a-call":
    "Reservar una llamada",
  "ui.booking.load-failed":
    "No se ha podido cargar la agenda. ",
  "ui.booking.open-new-tab":
    "Abrirla en una pesta\u00f1a nueva",
  "ui.interview.unavailable":
    "La entrevista necesita el servicio de Brandora, que no responde ahora mismo. Nada de lo que ya has respondido se ha perdido.",
  "ui.interview.retry":
    "Reintentar",
  "ui.quote.validity":
    "V\u00e1lido hasta el {date}. Los precios del transporte y de los proveedores cambian, as\u00ed que un presupuesto no dura para siempre.",
  "ui.quote.reference":
    "Presupuesto {reference}",
  "join.name":
    "Tu nombre",
  "join.business":
    "Tu negocio",
  "join.interest":
    "Qu\u00e9 quieres fabricar",
  "join.interest-placeholder":
    "Cajas, vasos, bolsas, pegatinas\u2026",
  "join.quantity":
    "Aproximadamente cu\u00e1ntos",
  "join.quantity-placeholder":
    "30",
  "join.optional":
    "Opcional \u2014 nos ayuda a encontrar el fabricante adecuado para ti.",
  "join.sending":
    "Enviando\u2026",
  "join.bad-email":
    "Eso no parece una direcci\u00f3n de correo.",
  "join.ok":
    "Est\u00e1s en la lista. Te escribiremos a medida que esto crezca.",
  "join.too-many":
    "Demasiados intentos desde aqu\u00ed. Int\u00e9ntalo un poco m\u00e1s tarde.",
  "join.failed":
    "No se ha enviado. Int\u00e9ntalo de nuevo o escribe a brandora.union@gmail.com.",
  "error.not-found": "No hemos encontrado eso.",
};
