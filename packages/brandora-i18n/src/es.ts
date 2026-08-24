import type { Catalogue } from "./en.js";

/** Spanish. Typed as `Catalogue`, so omitting a key fails the build. */
export const es: Catalogue = {
  "nav.home": "Inicio",
  "nav.create": "Crear mi marca",
  "nav.catalog": "Catálogo",
  "nav.package": "Mi paquete",
  "nav.pricing": "Cómo funcionan nuestros precios",
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
  "sourcing.lede": "Lo que Brandora est\u00e1 buscando ahora, con fabricantes con los que hablamos directamente.",
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
  "footer.privacy": "Política de privacidad",
  "footer.terms": "Términos de servicio",
  "footer.newsletter.heading": "Mantente al tanto",
  "footer.newsletter.label": "Tu correo",
  "footer.newsletter.cta": "Suscribirme",

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
  "catalog.category.label":
    "Categoría",
  "catalog.category.all":
    "Todas",
  "catalog.search.label":
    "Buscar",
  "catalog.search.placeholder":
    "vasos, pegatinas, cajas…",
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
  "auth.forgot-password":
    "¿Olvidaste tu contraseña?",
  "auth.google.signin":
    "Iniciar sesión con Google",
  "auth.or-divider":
    "o",
  "auth.forgot.title":
    "Restablece tu contraseña",
  "auth.forgot.lede":
    "Indica tu correo y te enviaremos un enlace para restablecerla.",
  "auth.forgot.submit":
    "Enviar enlace",
  "auth.forgot.sent":
    "Si existe una cuenta para esa dirección, un enlace de restablecimiento está en camino. Revisa tu bandeja de entrada.",
  "auth.back-to-login":
    "Volver a iniciar sesión",
  "auth.reset.title":
    "Elige una nueva contraseña",
  "auth.reset.lede":
    "Introduce una nueva contraseña para tu cuenta.",
  "auth.reset.new-password":
    "Nueva contraseña",
  "auth.reset.submit":
    "Actualizar contraseña",
  "auth.reset.done":
    "Tu contraseña se ha actualizado. Iniciando sesión…",
  "auth.reset.no-token":
    "Este enlace no tiene token.",
  "auth.reset.request-new":
    "Solicitar un nuevo enlace",

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
  "error.auth.reset-invalid": "Este enlace de restablecimiento no es válido o ha caducado. Solicita uno nuevo.",
  "error.input.invalid": "Algo en el formulario no está bien. Revísalo e inténtalo de nuevo.",
  "error.rate.limited": "Son muchas peticiones. Espera un momento e inténtalo de nuevo.",
  "error.internal": "Algo ha fallado por nuestra parte. Estamos en ello.",
  "error.storage.not-configured": "El almacenamiento de imágenes aún no está configurado. El producto se guardó sin esta foto.",
  "error.storage.upload-failed": "No se pudo subir la imagen. Verifica el tipo y el tamaño del archivo e inténtalo de nuevo.",
  "error.storage.delete-failed": "No se pudo eliminar esa imagen en este momento. Inténtalo de nuevo.",
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
  "ui.catalog.quote-on-request":
    "Precio a solicitud",
  "ui.catalog.request-quote":
    "Solicitar una cotización",
  "ui.catalog.sourced-from":
    "Suministrado por {supplier}",
  "ui.catalog.sourcing-in-progress":
    "Brandora está buscando un fabricante para este producto — aún no hay ninguno confirmado",
  "ui.catalog.moq-unconfirmed":
    "Cantidad aún no confirmada",
  "ui.catalog.confidence.verified":
    "Confirmado: puede llevar su logo",
  "ui.catalog.confidence.reported":
    "El proveedor declara poder personalizarlo — se confirma antes del pago",
  "ui.catalog.confidence.unavailable":
    "No se puede personalizar",
  "ui.catalog.confidence.unknown":
    "Personalización no confirmada",
  "ui.quote-request.photo-label":
    "Solicitar una cotización para {product}",
  "ui.quote-request.title":
    "Solicitud de cotización — {product}",
  "ui.quote-request.lede":
    "Cuéntanos qué necesitas. Te responderemos por correo electrónico.",
  "ui.quote-request.moq-label":
    "Cantidad mínima de pedido",
  "ui.quote-request.color-label":
    "Color (opcional)",
  "ui.quote-request.material-label":
    "Material / textura (opcional)",
  "ui.quote-request.logo-label":
    "Sube tu logo (opcional)",
  "ui.quote-request.note-label":
    "¿Algo más que debamos saber? (opcional)",
  "ui.quote-request.submit":
    "Enviar solicitud",
  "ui.quote-request.sending":
    "Enviando…",
  "ui.quote-request.sent-title":
    "Solicitud enviada",
  "ui.quote-request.sent-body":
    "Te responderemos en un plazo de 48 horas.",
  "ui.quote-request.close":
    "Cerrar",
  "ui.quote-request.moq-invalid":
    "Introduce un número entero mayor que cero.",
  "ui.quote-request.logo-too-large":
    "Ese archivo de logo es demasiado grande — usa uno de menos de 150 KB.",
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
  "ui.assistant.product-meta-sourcing":
    "{category} \u00b7 cantidad a\u00fan no confirmada",
  "ui.assistant-widget.open":
    "Preguntar a Brandora",
  "ui.assistant-widget.title":
    "Preguntar a Brandora",
  "ui.assistant-widget.close":
    "Cerrar",
  "ui.assistant-widget.placeholder":
    "Haga una pregunta…",
  "ui.assistant-widget.send":
    "Enviar",
  "ui.assistant-widget.open-full":
    "Abrir el asistente completo",
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
  "nav.skip":
    "Ir al contenido",
  "founder.p1":
    "Cre\u00e9 Brandora Union porque vi un vac\u00edo que no pod\u00eda ignorar.",
  "founder.p2":
    "Por toda \u00c1frica hay emprendedores incre\u00edbles construyendo marcas ambiciosas y creando productos realmente buenos. Pero con demasiada frecuencia, la presentaci\u00f3n f\u00edsica de esos productos no refleja la calidad de lo que hay dentro.",
  "founder.p3":
    "Comprend\u00ed que el envase no es solo un envase. Suele ser la primera conversaci\u00f3n que un cliente tiene con una marca. Antes de probar, llevar, usar o experimentar un producto, lo ven. La forma, los materiales, los detalles, los colores \u2014 todo ello crea una impresi\u00f3n inmediata de lo que hay dentro.",
  "founder.pull1":
    "Un envase bonito y bien pensado hace que un producto se sienta intencionado, fiable y digno de descubrir.",
  "founder.p4":
    "Sin embargo, para muchas marcas africanas, acceder a envases personalizados de calidad y a socios de fabricaci\u00f3n fiables sigue siendo dif\u00edcil, caro o innecesariamente complicado.",
  "founder.p5":
    "Quise cambiar eso.",
  "founder.p6":
    "Cre\u00e9 Brandora Union para que a los emprendedores africanos les resulte m\u00e1s f\u00e1cil construir marcas tan excepcionales como los productos que crean \u2014 conect\u00e1ndolos con los productos, los envases, los fabricantes y, con el tiempo, toda la infraestructura necesaria para llevar sus ideas al mundo f\u00edsico.",
  "founder.p7":
    "\u00c1frica tiene las ideas. \u00c1frica tiene el talento. Creo que nuestras marcas merecen una infraestructura a la altura.",
  "founder.pull2":
    "Y es en Costa de Marfil donde empiezo.",
  "assistant.lede":
    "Pregunta sobre productos, envases, cantidades o por d\u00f3nde empezar. Las respuestas salen de tu marca y del cat\u00e1logo real.",
  "assistant.q1":
    "\u00bfQu\u00e9 productos encajan con mi marca?",
  "assistant.q2":
    "\u00bfQu\u00e9 envase deber\u00eda usar?",
  "assistant.q3":
    "\u00bfCon qu\u00e9 deber\u00eda empezar?",
  "assistant.q4":
    "Crear un lote de lanzamiento",
  "assistant.label":
    "Tu pregunta",
  "assistant.placeholder":
    "Productos, envases, cantidades\u2026",
  "assistant.footnote":
    "Brandora responde a partir del cat\u00e1logo que puede pedir de verdad. Te dir\u00e1 cu\u00e1ndo no encaja nada en lugar de sugerir algo que no existe.",
  "brand.section.brand":
    "La marca",
  "brand.palette.note":
    "Derivada de tus respuestas y comprobada en contraste antes de mostr\u00e1rtela.",
  "brand.section.mark":
    "El logotipo",
  "brand.mark.note":
    "Una direcci\u00f3n, escrita para entregarla a un dise\u00f1ador o a un modelo de imagen.",
  "brand.section.world":
    "En el mundo real",
  "brand.world.note":
    "Tus colores y tus letras en los objetos que el cliente sostiene de verdad.",
  "brand.cta.products":
    "Elegir tus productos",
  "brand.cta.guidelines":
    "Descargar el manual de marca",
  "brand.empty.title":
    "Aqu\u00ed todav\u00eda no hay marca",
  "brand.empty.body":
    "Responde a la entrevista y Brandora construir\u00e1 una.",
  "brand.loading":
    "Cargando tu marca\u2026",
  "catalog.lede":
    "Dinos cu\u00e1ntos necesitas. Brandora solo te ofrece lo que puedes pedir de verdad en esa cantidad.",
  "catalog.quantity.label":
    "\u00bfCu\u00e1ntos necesitas?",
  "catalog.near.title":
    "Disponibles, pero no en esta cantidad",
  "catalog.near.note":
    "Estos necesitan un pedido mayor. El m\u00ednimo se indica en cada uno.",
  "home.catalog.loading":
    "Cargando el cat\u00e1logo\u2026",
  "interview.dont-know":
    "No lo s\u00e9 \u2014 ay\u00fadame",
  "package.recs.note":
    "Ordenados seg\u00fan lo que nos contaste, no por precio. Todos se pueden pedir en la cantidad que has fijado.",
  "order.title":
    "Tu pedido",
  "order.what":
    "Lo que has pedido",
  "order.pay":
    "Continuar al pago",
  "order.check-again":
    "He pagado \u2014 comprobar de nuevo",
  "quote.place-order":
    "Realizar este pedido",
  "error.reason-label": "Motivo t\u00e9cnico",
  "sourcing.floor.title":
    "Desde la f\u00e1brica",
  "sourcing.floor.caption":
    "Etiquetas hologr\u00e1ficas de seguridad, fotografiadas en el fabricante con el que trabajamos. Todav\u00eda no est\u00e1 en el cat\u00e1logo \u2014 estamos negociando cantidades peque\u00f1as.",
  "sourcing.floor.alt":
    "Una hoja de etiquetas hologr\u00e1ficas doradas redondas en su caja de env\u00edo",
  "sourcing.gallery.title":
    "Lo que podemos mandar fabricar",
  "sourcing.gallery.note":
    "Fotos de los fabricantes con los que trabajamos \u2014 ejemplos de lo que producen. Los precios y las cantidades m\u00ednimas dependen de tu proyecto; confirmamos ambos antes de presupuestar.",
  "sourcing.alt.cartons":
    "Estuches plegables impresos en varios colores",
  "sourcing.alt.display":
    "Expositores de mostrador impresos y cajas peque\u00f1as a juego",
  "sourcing.alt.rigid":
    "Caja r\u00edgida de regalo con funda impresa e inserciones",
  "sourcing.alt.mailer":
    "Caja de env\u00edo impresa en verde",
  "sourcing.alt.small":
    "Cajas peque\u00f1as impresas para velas",
  "sourcing.alt.colour":
    "Cajas impresas en rosa y amarillo",
  "sourcing.alt.drawer":
    "Cajas caj\u00f3n en tres colores",
  "sourcing.alt.gable":
    "Caja de pasteler\xeda blanca con asa, cerrada",
  "sourcing.alt.gableOpen":
    "La misma caja vista desde arriba, con los paneles del asa abiertos",
  "sourcing.alt.carrier":
    "Caja de transporte con asa troquelada, vista de lado",
  "sourcing.alt.carrierHand":
    "Una mano llevando la caja por el asa",
  "sourcing.alt.carrierOpen":
    "La caja de transporte con las solapas abiertas",
  "sourcing.alt.lids":
    "Nueve perfiles de tapas transparentes para vasos",
  "sourcing.alt.cupDims":
    "Vaso PET transparente con sus medidas: 92 a 93 mm de boca, 56 mm de alto, 55 mm de base",
  "sourcing.alt.iceCups":
    "Vasos de papel para helado impresos con un motivo de hoja",
  "sourcing.alt.cutlery":
    "Seis formas de cubiertos de madera sobre pizarra, con una funda de papel",
  "sourcing.alt.spoon":
    "Una cuchara desechable blanca",
  "sourcing.alt.cupsSet":
    "Un vaso para bebida fr\xeda, su tapa abovedada y una pajita",
  "sourcing.alt.cupChart":
    "La tabla de tama\xf1os de un proveedor para vasos de porci\xf3n transparentes, de 30 a 300ml",
  "sourcing.alt.bagsColour":
    "Bolsas con asa troquelada en cinco colores",
  "sourcing.alt.cupDomeNavy":
    "Un vaso transparente con tapa abovedada",
  "sourcing.alt.boxKraftSmall":
    "Una caja kraft peque\xf1a, cerrada y luego abierta",
  "sourcing.alt.boxKraftStacked":
    "Dos cajas kraft apiladas",
  "sourcing.alt.boxShippingPink":
    "Una caja de env\xedo rosa abierta sobre su relleno de papel triturado",
  "sourcing.alt.trayBagasse":
    "Una bandeja de fibra con compartimentos y su tapa",
  "sourcing.alt.boxKraftWindow":
    "Una caja kraft con ventana transparente, cerrada y luego abierta",
  "sourcing.alt.bagsKraftHandles":
    "Bolsas kraft con asas de cuerda, varios tama\xf1os",
  "sourcing.alt.pouchStandup":
    "Bolsas kraft autoportantes con ventana transparente",
  "sourcing.alt.bagsBakeryHand":
    "Tres tama\xf1os de bolsa de panader\xeda con ventana, una sostenida a mano",
  "sourcing.alt.cakeCarrierStripe":
    "Una caja porta-tartas blanca con rayas rosas, sujeta por su asa",
  "sourcing.alt.labels":
    "Etiquetas hologr\u00e1ficas doradas en su caja",
  "brand.app.carton":
    "Estuche plegable",
  "brand.app.mailer":
    "Caja de env\u00edo",
  "brand.app.small":
    "Caja peque\u00f1a impresa",
  "brand.app.gift":
    "Caja r\u00edgida de regalo",
  "brand.app.display":
    "Expositor de mostrador",
  "brand.app.label":
    "Etiqueta",
  "brand.world.caveat":
    "Tus colores y tus letras sobre los materiales reales que Brandora consigue. Una indicaci\u00f3n, no una prueba de impresi\u00f3n \u2014 la produce el fabricante cuando reciba tus archivos.",

  "legal.eyebrow": "Aviso legal",

  "legal.privacy.title": "Pol\u00edtica de privacidad",
  "legal.privacy.updated": "\u00daltima actualizaci\u00f3n en agosto de 2026.",
  "legal.privacy.intro":
    "Brandora Union (\u00abBrandora\u00bb, \u00abnosotros\u00bb) crea marcas y fabrica los productos f\u00edsicos que las llevan para peque\u00f1as empresas, desde Abiy\u00e1n, Costa de Marfil. Esta p\u00e1gina describe qu\u00e9 recopilamos a trav\u00e9s de brandoraunion.online, por qu\u00e9, y qu\u00e9 puedes pedirnos al respecto.",
  "legal.privacy.h.collect": "Qu\u00e9 recopilamos",
  "legal.privacy.p.collect-1":
    "Al crear tu cuenta: tu nombre, correo electr\u00f3nico y contrase\u00f1a, y \u2014 solo si eliges darlos \u2014 tu pa\u00eds y n\u00famero de tel\u00e9fono.",
  "legal.privacy.p.collect-2":
    "Al usar el creador de marca: tus respuestas a las preguntas de la entrevista (tu negocio, producto, p\u00fablico y posicionamiento), y la marca, identidad y paquete que Brandora genera a partir de ellas.",
  "legal.privacy.p.collect-3":
    "Al solicitar una cotizaci\u00f3n, hacer un pedido, o subir un logo para un fabricante: los datos que introduces en ese formulario, y el archivo mismo.",
  "legal.privacy.p.collect-4":
    "Si inicias sesi\u00f3n con Google, recibimos el nombre, correo electr\u00f3nico y foto de perfil que Google comparte para ese fin \u2014 nada m\u00e1s de tu cuenta de Google.",
  "legal.privacy.h.use": "Por qu\u00e9 lo usamos",
  "legal.privacy.p.use":
    "Para gestionar tu cuenta, generar tu marca, calcular y cumplir tus pedidos, responder tus solicitudes de cotizaci\u00f3n, y responderte cuando nos contactas. No vendemos tus datos ni los usamos para mostrarte publicidad.",
  "legal.privacy.h.share": "Con qui\u00e9n los compartimos",
  "legal.privacy.p.share-1":
    "Un peque\u00f1o n\u00famero de proveedores procesan datos en nuestro nombre, solo para el fin indicado: Anthropic genera tu estrategia de marca e identidad a partir de tus respuestas a la entrevista; Resend entrega nuestros correos transaccionales (cuenta, pedidos, cotizaciones); Paystack procesa los pagos \u2014 Brandora nunca ve ni guarda los datos de tu tarjeta; y, si los usas, Google para iniciar sesi\u00f3n y Calendly para reservar una llamada aplican su propia pol\u00edtica de privacidad para esa interacci\u00f3n.",
  "legal.privacy.p.share-2":
    "No compartimos tus datos con nadie m\u00e1s, y no usamos rastreadores publicitarios ni anal\u00edticos en este sitio.",
  "legal.privacy.h.cookies": "Cookies y almacenamiento local",
  "legal.privacy.p.cookies":
    "Una sola cookie te mantiene conectado \u2014 identifica tu sesi\u00f3n y nada m\u00e1s, y ning\u00fan script de esta p\u00e1gina puede leerla. Tu idioma, tu preferencia de tema claro u oscuro, y en qu\u00e9 marca estabas trabajando se guardan en el almacenamiento de tu propio navegador, en tu dispositivo, para que volver al sitio no los pierda.",
  "legal.privacy.h.retention": "Cu\u00e1nto tiempo los guardamos",
  "legal.privacy.p.retention-1":
    "Guardamos tus datos mientras tu cuenta est\u00e9 activa. Todav\u00eda no tenemos una forma de autoservicio para exportar o eliminar tu cuenta \u2014 escribe a",
  "legal.privacy.p.retention-2":
    "y lo gestionaremos directamente.",
  "legal.privacy.h.rights": "Tus derechos",
  "legal.privacy.p.rights":
    "Puedes pedirnos qu\u00e9 tenemos sobre ti, pedirnos que lo corrijamos, o pedirnos que lo eliminemos, en la misma direcci\u00f3n. Actuaremos sobre una solicitud de eliminaci\u00f3n salvo que debamos conservar algo \u2014 el registro de un pedido pagado, por ejemplo \u2014 por razones contables o legales.",
  "legal.privacy.h.children": "Menores",
  "legal.privacy.p.children":
    "Brandora es un servicio para empresas y no est\u00e1 dirigido a menores. No recopilamos a sabiendas datos de nadie menor de 16 a\u00f1os.",
  "legal.privacy.h.changes": "Cambios en esta pol\u00edtica",
  "legal.privacy.p.changes":
    "Si esta pol\u00edtica cambia de forma significativa, actualizaremos la fecha en la parte superior de esta p\u00e1gina y, para un cambio importante, te avisaremos por correo electr\u00f3nico.",
  "legal.privacy.h.contact": "Contacto",

  "legal.terms.title": "T\u00e9rminos de servicio",
  "legal.terms.updated": "\u00daltima actualizaci\u00f3n en agosto de 2026.",
  "legal.terms.intro":
    "Estos son los t\u00e9rminos para usar brandoraunion.online, operado por Brandora Union desde Abiy\u00e1n, Costa de Marfil. Crear una cuenta, solicitar una cotizaci\u00f3n o hacer un pedido significa que los aceptas.",
  "legal.terms.h.service": "El servicio",
  "legal.terms.p.service-1":
    "Brandora genera una marca \u2014 un nombre, posicionamiento, paleta e identidad \u2014 a partir de tus respuestas, y te ayuda a convertirla en productos f\u00edsicos de nuestro cat\u00e1logo. Algunos productos tienen un precio fijo a una cantidad dada; otros est\u00e1n marcados \u00abprecio a consultar\u00bb porque el costo depende de una cotizaci\u00f3n de flete que a\u00fan no hemos obtenido, y nunca te mostraremos una cifra inventada en su lugar.",
  "legal.terms.p.service-2":
    "Todav\u00eda no existe un mercado de fabricantes en Brandora. Al hacer clic en la foto de un producto para solicitar una cotizaci\u00f3n se env\u00eda tu solicitud por correo electr\u00f3nico; te contactamos directamente en lugar de a trav\u00e9s de un portal automatizado.",
  "legal.terms.h.accounts": "Cuentas",
  "legal.terms.p.accounts":
    "Eres responsable de la exactitud de la informaci\u00f3n de tu cuenta y de mantener tu contrase\u00f1a confidencial. Debes tener capacidad para celebrar un contrato vinculante para crear una.",
  "legal.terms.h.orders": "Pedidos, precios y pago",
  "legal.terms.p.orders-1":
    "Los precios se muestran en francos CFA de \u00c1frica Occidental (XOF) e incluyen el margen de abastecimiento y coordinaci\u00f3n de Brandora. Una cotizaci\u00f3n es v\u00e1lida por el per\u00edodo indicado en ella; despu\u00e9s de eso, los precios pueden haber cambiado y se necesita una nueva cotizaci\u00f3n.",
  "legal.terms.p.orders-2":
    "El pago se procesa a trav\u00e9s de Paystack. Nunca vemos ni guardamos los datos de tu tarjeta. Un pedido se confirma una vez que el pago se verifica como recibido.",
  "legal.terms.h.delivery": "Entrega",
  "legal.terms.p.delivery":
    "Los cargos de entrega mostrados al pagar son nuestra propia tarifa de entrega local, no una cotizaci\u00f3n de transportista \u2014 no publicamos una fecha de entrega hasta que haya sido realmente confirmada para tu pedido.",
  "legal.terms.h.cancellation": "Cancelaciones",
  "legal.terms.p.cancellation":
    "Como la mayor\u00eda de los pedidos se fabrican para ti en lugar de mantenerse en inventario, las condiciones de cancelaci\u00f3n dependen de cu\u00e1nto haya avanzado la producci\u00f3n cuando lo pidas \u2014 cont\u00e1ctanos en cuanto lo sepas, y te diremos exactamente en qu\u00e9 punto est\u00e1n las cosas.",
  "legal.terms.h.ip": "Propiedad intelectual",
  "legal.terms.p.ip":
    "La marca, el nombre y la identidad que Brandora genera para ti son tuyos una vez que tu pedido est\u00e1 pagado. Brandora Union conserva la propiedad del software, el cat\u00e1logo y el sitio en s\u00ed.",
  "legal.terms.h.liability": "Responsabilidad",
  "legal.terms.p.liability":
    "Trabajamos para que la informaci\u00f3n de precios, disponibilidad y entrega sea correcta, pero Brandora no es responsable de p\u00e9rdidas indirectas derivadas de retrasos o errores fuera de nuestro control razonable, incluidos los de nuestros proveedores o de nuestro procesador de pagos.",
  "legal.terms.h.law": "Ley aplicable",
  "legal.terms.p.law":
    "Estos t\u00e9rminos se rigen por la ley de Costa de Marfil.",
  "legal.terms.h.changes": "Cambios en estos t\u00e9rminos",
  "legal.terms.p.changes":
    "Si cambiamos estos t\u00e9rminos de forma significativa, actualizaremos la fecha en la parte superior de esta p\u00e1gina.",
  "legal.terms.h.contact": "Contacto",

  "ui.catalog.see-details": "Ver detalles de {product}",
  "ui.catalog.see-details-short": "Ver detalles",

  "product.back": "← Volver al catálogo",
  "product.not-found": "No se encontró este producto. Puede haber sido retirado del catálogo.",
  "product.quote.title": "Solicitar una cotización",
  "product.quote.lede": "No necesitas una cuenta. Descríbenos lo que necesitas y te responderemos por correo.",
  "product.quote.not-instant": "Esto es una solicitud de personalización, no una compra instantánea: Brandora Union confirma el costo de envío y el plazo exacto después de revisar tu solicitud.",
  "product.quote.name": "Tu nombre",
  "product.quote.company": "Empresa / marca (opcional)",
  "product.quote.email": "Correo electrónico",
  "product.quote.phone": "Teléfono (opcional)",
  "product.quote.quantity": "Cantidad deseada",
  "product.quote.material": "Material",
  "product.quote.shape": "Forma",
  "product.quote.dimensions": "Dimensiones",
  "product.quote.quality": "Calidad / especificación",
  "product.quote.quality-placeholder": "Ej. grado alimentario, acabado mate",
  "product.quote.color": "Color / preferencia",
  "product.quote.color-placeholder": "Ej. azul marino, kraft natural",
  "product.quote.timeframe": "Plazo de envío / entrega deseado (opcional)",
  "product.quote.timeframe-placeholder": "Ej. en un plazo de 4 semanas",
  "product.quote.deliveryMethod": "Entrega o recogida",
  "product.quote.deliveryMethod.unset": "Aún no decidido",
  "product.quote.deliveryMethod.delivery": "Entrega",
  "product.quote.deliveryMethod.pickup": "Recogida",
  "product.quote.customization": "Personalización deseada",
  "product.quote.custom.logo": "Logo",
  "product.quote.custom.design": "Diseño completo",
  "product.quote.custom.printing": "Impresión",
  "product.quote.custom.sticker": "Sticker",
  "product.quote.custom.embossing": "Repujado",
  "product.quote.custom.other": "Otro",
  "product.quote.logo": "Sube tu logo / diseño (opcional)",
  "product.quote.destination": "Destino",
  "product.quote.destination-placeholder": "Ciudad, país",
  "product.quote.message": "Mensaje adicional (opcional)",
  "product.quote.submit": "Solicitar una cotización",
  "product.quote.sent-title": "Solicitud enviada",
  "product.quote.sent-body": "Hemos recibido tu solicitud. Te responderemos por correo electrónico.",
  "product.quote.bad-quantity": "Introduce un número entero mayor que cero.",
  "product.detail.height": "altura",
  "product.detail.no-photo": "Todavía no hay foto.",
  "product.detail.material": "Material",
  "product.detail.shape": "Forma",
  "product.detail.dimensions": "Dimensiones",
  "product.detail.colors": "Colores",
  "product.detail.minimum": "Pedido mínimo",
  "product.detail.minimum-unconfirmed": "Aún no confirmado — dinos cuántos necesitas",
  "product.detail.price": "Precio",
  "product.detail.customization": "Personalización",
  "product.detail.notes": "Notas",
  "product.detail.not-confirmed": "Aún no confirmado por el proveedor — dinos lo que necesitas.",

  "gate.eyebrow": "Crear mi marca",
  "gate.title": "¿Ya tienes una marca?",
  "gate.lede": "Esto decide cuál de los dos caminos te conviene — cualquiera de los dos toma menos de un minuto para empezar.",
  "gate.has-brand.title": "Sí — ya tengo mi marca",
  "gate.has-brand.body": "Tienes un nombre, un logo, un eslogan. Ve directo al catálogo, sube tu logo en un producto, y pide una cotización.",
  "gate.needs-brand.title": "No — quiero crear mi marca",
  "gate.needs-brand.body": "Una breve entrevista sobre tu negocio, tu producto y tu público — Brandora construye a partir de ella un nombre, un posicionamiento, una paleta y una identidad.",

  "pricing.eyebrow": "Precios",
  "pricing.title": "Cómo funcionan nuestros precios",
  "pricing.lede": "Una fórmula, no una estimación a ojo. Esto es exactamente lo que compone el precio que ves, y por qué.",
  "pricing.formula.label": "La fórmula",
  "pricing.formula.text": "Precio final = Costo del producto + Costo de envío + Margen de servicio Brandora",
  "pricing.h.product-cost": "Costo del producto",
  "pricing.p.product-cost": "Lo que el fabricante cobra por el producto en sí, al proveedor real detrás de cada artículo del catálogo — nunca una cifra aproximada.",
  "pricing.h.shipping-cost": "Costo de envío",
  "pricing.p.shipping-cost": "El costo logístico estimado — o, una vez confirmado, real — asociado a tu pedido: flete internacional, aduana y entrega local, según corresponda.",
  "pricing.h.margin": "Margen de servicio Brandora",
  "pricing.p.margin-1": "Un porcentaje transparente, añadido sobre el costo del producto y el costo de envío juntos, para cubrir el abastecimiento, la coordinación con el proveedor, el control de calidad, la gestión del pedido y el funcionamiento de la plataforma. Esta tasa es configurable en lugar de estar fija en el código — actualmente está fijada en",
  "pricing.p.margin-2": ", dentro de un rango declarado del 25 al 35 %.",
  "pricing.h.example": "Un ejemplo numérico",
  "pricing.example.product": "Costo del producto",
  "pricing.example.shipping": "Costo de envío",
  "pricing.example.margin": "Margen Brandora",
  "pricing.example.total": "Precio final",
  "pricing.example.note": "Solo a modo de ilustración — tus cotizaciones reales se muestran en francos CFA de África Occidental (XOF).",
  "pricing.h.states": "Estimado, luego confirmado",
  "pricing.states.estimated-label": "Precio estimado",
  "pricing.p.states-1": "— calculado a partir del producto elegido, la cantidad, y un costo de proveedor y de envío estimados. Esto es lo que ves al navegar el catálogo.",
  "pricing.states.confirmed-label": "Cotización confirmada",
  "pricing.p.states-2": "— una vez que hemos hablado con el fabricante: precio final del proveedor, envío confirmado, y el mismo margen Brandora. Los precios de fabricación varían según la cantidad mínima, el material, la personalización, el empaque, el destino y el método de envío — la cotización confirmada tiene en cuenta todo eso.",
  "pricing.h.transparency": "Lo que mostramos, lo que mantenemos privado",
  "pricing.p.transparency": "Somos transparentes sobre el método: tu precio es costo del producto + envío + margen de servicio Brandora. El costo exacto negociado con cada proveedor permanece en nuestro sistema interno — ser transparentes sobre la fórmula no significa revelar los términos comerciales confidenciales de nuestros proveedores.",
};
