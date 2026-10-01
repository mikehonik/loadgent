// ================= Versión =================
// VERSION es el número que ve el usuario (arriba, junto al nombre, y en los archivos exportados). Se sube
// a mano en package.json cada vez que se publica una mejora, siguiendo GUIA_PUBLICAR.md:
//   1.1.0 → 1.1.1  corrección pequeña     ·   1.1.0 → 1.2.0  funcionalidad nueva
// BUILD cambia solo en cada publicación: es el commit que compiló Cloudflare. Sirve para saber
// exactamente qué código tiene la versión que alguien está usando, aunque no se haya subido el número.
// Los valores los inyecta vite.config.js al compilar; en pruebas sin compilar quedan como "dev".
/* global __VERSION__, __BUILD__, __FECHA_BUILD__ */
export const VERSION = typeof __VERSION__ !== "undefined" ? __VERSION__ : "dev";
export const BUILD = typeof __BUILD__ !== "undefined" ? __BUILD__ : "";
export const FECHA_BUILD = typeof __FECHA_BUILD__ !== "undefined" ? __FECHA_BUILD__ : "";
export const NOMBRE_VERSION = `DarnelCube 3D v${VERSION}`;
export const VERSION_COMPLETA = `v${VERSION}${BUILD ? ` · ${BUILD}` : ""}${FECHA_BUILD ? ` · ${FECHA_BUILD}` : ""}`;

// Novedades que se muestran en Ayuda. Al subir la versión, agrega arriba una entrada con lo que cambió,
// escrito para quien usa la herramienta (no para programadores).
export const NOVEDADES = [
  {
    version: "1.6.5", fecha: "30/09/2026",
    cambios: [
      "Cuando el último vehículo se va llevando solo Bundles, ahora se prueba abriendo exactamente esos antes que cualquier otra cosa. Pasaba que un pedido salía con un segundo contenedor cargando UN solo Bundle mientras al primero le sobraban 11 m³: la búsqueda general reparte los Bundles abiertos entre todas las líneas y se evalúa en nivel rápido, así que ese caso se le escapaba.",
      "Orden de cargue con Bundles, como lo pidió el andén: primero los pallets, después la pared con las cajas de los Bundles que hubo que abrir, y al final los Bundles enteros, que son un movimiento cada uno. Cuántos Bundles se abren lo sigue decidiendo el espacio: se abren los menos posibles.",
      "15 mm de sobresaliente por lado en el pallet, y no solo para los nuevos: al abrir tu cuenta, los pallets que ya tenías guardados con 0 quedan en 15 (en planta la caja nunca queda exactamente al ras de la tarima). Si capturaste otro número, ese se respeta.",
      "Nueva opción por pallet, encendida por omisión: «Subir hasta el techo cuando el estándar no cabe». Si las cajas por pallet o los niveles que trae el maestro no caben en la altura máxima del catálogo, el pallet se arma contra el techo del vehículo en lugar de recortarse, y lo avisa. La idea es simple: si en planta lo arman más alto que esa altura, la que está mal es la altura del catálogo, no el estándar. Si el estándar sí cabe, se respeta el tope de siempre.",
    ],
  },
  {
    version: "1.6.4", fecha: "30/09/2026",
    cambios: [
      "Orden de cargue: en cualquier carga que mezcle pallets y cajas sueltas, ahora entran primero los pallets y después lo suelto. Antes lo suelto ganaba el lugar (empaca mejor que un pallet), se llevaba los primeros vehículos completos y los pallets terminaban viajando solos, a media altura y sin nada encima. Medido en un pedido de 3 SKUs paletizados y 2 sueltos: pasó de 11 vehículos a 10 y subieron 302 cajas al techo de los pallets. Se apaga con la regla «Orden de cargue».",
      "Un pallet cuyo último nivel queda incompleto ya puede recibir cajas encima, sobre la parte que sí está completa. Antes se prohibía todo el nivel de arriba y ese espacio se perdía entero. Sigue mandando el soporte mínimo: lo que quede volando sobre el hueco no se coloca. Para poner otro PALLET encima se sigue exigiendo el techo plano completo.",
      "En el Pedido, junto a «Ver medidas», un nuevo «Ver descripción» muestra la descripción del maestro en la tabla.",
      "La cota del sobresaliente sale con una línea guía hacia afuera del pallet: son milímetros sobre una tarima de más de un metro, y dibujada a escala no se apreciaba.",
    ],
  },
  {
    version: "1.6.3", fecha: "30/09/2026",
    cambios: [
      "Corrección importante: al final del acomodo el motor podía acostar un pallet armado de costado para meterlo en el hueco de arriba. El 3D lo seguía dibujando de pie, así que se veía carga saliéndose del techo del contenedor, y en el instructivo salían pallets del mismo SKU unos a lo largo y otros a lo ancho. Ahora el pallet siempre va de pie.",
      "Al agregar un pallet en Paletizado, la pantalla baja hasta él y deja el cursor en su nombre. Antes se agregaba al final de la lista, fuera de la vista, y parecía que el botón no había hecho nada.",
      "Los campos numéricos se seleccionan al entrar, así el primer número que escribes reemplaza lo que había. Antes se pegaba al 0 y quedaban valores como 070.",
      "«Medidas» ahora acota también lo que mide la carga, al estilo de CubeMaster: en azul el largo, el ancho y el alto total de lo cargado y, sobre un pallet, cuánto sobresale de la tarima por cada lado (con una línea guía hacia afuera, porque son milímetros sobre una tarima de más de un metro y a escala no se verían); en rojo sigue lo que quedó libre al frente. Las cotas van chicas a propósito, como en un plano, y se ajustan solas al tamaño de lo que estás viendo: se leen igual en un contenedor de 12 m que en un pallet de 1.2 m.",
      "Cuando el maestro cargado no trae ningún Bundle configurado, el aviso lo dice así en lugar de señalar SKU por SKU: casi siempre es que falta la hoja «Bundles» o que el maestro no se ha guardado.",
    ],
  },
  {
    version: "1.6.2", fecha: "30/09/2026",
    cambios: [
      "La holgura de «Simular la carga real» pasó de cobrarse por caja a cobrarse por bloque. Antes, con 4 SKUs o más se le sumaban 6 mm al largo y ancho de cada caja, así que una fila de 24 cajas iguales perdía 14 cm de contenedor. Ahora las cajas de un mismo bloque van pegadas (que es como quedan de verdad) y la holgura solo se paga en la junta contra el bloque de al lado. En un caso real de 4 SKUs el primer contenedor pasó de 78% a 89% de ocupación.",
      "Nuevo botón «Medidas» sobre el 3D: acota en el dibujo el fondo, el ancho y el alto que quedaron libres al frente de la carga, en la unidad que tengas elegida. Va apagado por omisión para no ensuciar la imagen, y no sale en el instructivo.",
      "Cuando sobra un vehículo, o al pedir una sugerencia, la herramienta corre también el cálculo sin «Simular la carga real» y avisa si la simulación te está costando un vehículo o 2 puntos de ocupación, con un botón para ver el resultado sin ella. La simulación sigue encendida por omisión porque se parece más a lo que pasa en el andén.",
    ],
  },
  {
    version: "1.6.0", fecha: "29/09/2026",
    cambios: [
      "El catálogo de pallets nuevo viene con carga máxima de 1,500 kg (antes 1,200 y 1,000): con el tope viejo, un SKU de 22 kg por caja se quedaba en 54 cajas por pallet en lugar de 60. Los pallets que ya tengas guardados no cambian; se ajustan en Paletizado.",
      "Cuando el maestro pide un número de cajas por nivel menor al que cabe (20 de 30, por ejemplo), el pallet se arma como un bloque rectangular completo y centrado (4 × 5), no con las cajas más centradas de la rejilla, que salía escalonado.",
      "En Herramientas, «Calcular carga» muestra los avisos de ese cálculo junto a su resultado, y el panel de abajo aclara que lo que se ve ahí sigue siendo tu carga.",
      "«Llenar con pedido sugerido» ya no tiene tope: se ofrece siempre que quepa algo más, aunque el vehículo vaya al 91%. También puede aumentar las líneas que van en Bundle (de Bundle en Bundle).",
      "Candado por línea en el pedido: las líneas fijas no las cambia ninguna sugerencia (ni llenar ni disminuir). Se puede fijar desde la tabla o desde la vista previa.",
      "Los Bundles ahora también se abren para llenar: si no se ahorra un vehículo, se abren los menos posibles para dejar el último lo más vacío posible y que los demás vayan llenos. En Reglas se elige la política (para ahorrar y llenar, solo para ahorrar, o nunca).",
      "Con Bundles en la carga, el orden de cargue queda fijo dentro de cada entrega: primero los pallets, luego los Bundles completos y al final lo suelto, que rellena los huecos que dejaron los dos anteriores.",
      "Un SKU con sufijo de variante («DU4051199V-R006940») toma el Bundle de su SKU base cuando no tiene fila propia, tanto al leer el maestro como al importar el CS-BDL.",
      "Aviso cuando un SKU empieza con DU y no tiene Bundle capturado: sale al cargar el pedido y como regla nueva en Calidad del maestro.",
      "Regla explícita para las cantidades con decimales (hacia arriba, hacia abajo o al más cercano). La cantidad original siempre queda a la vista junto a la cubicada.",
      "Debajo de cada SKU del pedido se ve lo pedido y su equivalencia logística («7 PLT + 20 cajas», «153 BDL»), y las etiquetas PM, BDL y ajustado ya no tapan la cantidad.",
      "Nuevo interruptor por línea «Sin límite de altura»: el pallet se apila hasta el techo del vehículo en lugar de la altura del catálogo, avisando si al SKU le falta el peso máximo encima para validar la torre.",
      "En Herramientas, cuando no caben las cajas por pallet que pediste, ahora se dice cuál límite manda y con qué número (por ejemplo, «60 cajas pesarían 1,329 kg y el pallet aguanta 1,200 kg»), y el armado muestra los niveles reales cuando el último va incompleto.",
    ],
  },
  {
    version: "1.5.2", fecha: "24/09/2026",
    cambios: [
      "Corrección: con el archivo CS-BDL, las cajas por Bundle salían con decimales (4.8 ÷ 0.2 = 23.999…) y el cálculo rechazaba la línea con «la cantidad debe ser un entero». Ahora siempre se redondean a entero.",
    ],
  },
  {
    version: "1.5.1", fecha: "24/09/2026",
    cambios: [
      "Con el pedido listo, en lugar del cuadro «Para calcular la carga» encima del 3D aparece un botón chico abajo, para no tapar la imagen mientras se ajusta.",
      "Guardar el maestro muestra «Guardando…» mientras sube (con un maestro grande tarda unos segundos y parecía no hacer nada). Guardar lo deja en tu cuenta; el Excel con su hoja Bundles se baja con «Descargar ▾ → Copia del maestro en Excel».",
      "Nueva «Descargar ▾ → Plantilla de Bundles» (SKU, cajas por Bundle, medidas y peso), que se sube con «Importar ▾ → Bundle».",
      "Los menús «Importar ▾» y «Descargar ▾» se abren hacia arriba cuando están al final del panel; antes se cortaban y al bajar para verlos se cerraban.",
      "«Nueva carga» ahora sí deja el pedido vacío (antes quedaba una línea «SKU 1» de 50 cajas) y pide confirmación con una ventana propia de la página, que el navegador no puede bloquear.",
    ],
  },
  {
    version: "1.5.0", fecha: "24/09/2026",
    cambios: [
      "Bundles desde el maestro: nueva hoja «Bundles» (SKU, cajas por Bundle, medidas y peso). En cada línea del pedido se elige cómo se carga: suelta, pallet de un SKU, pallet mixto o Bundle (solo para los SKUs de esa hoja).",
      "El Bundle se calcula como en el andén: primero todos los Bundles completos y, solo si así se ocupa un vehículo más, se abren los menos posibles para llenar los huecos con cajas sueltas. El resumen muestra el mix Bundle / suelto que resultó; ya no se captura un porcentaje.",
      "En el 3D, al terminar el cálculo: «Llenar con pedido sugerido» (agranda el pedido en la misma proporción y llena los huecos) y «Sugerir disminución del pedido» (primero intenta reacomodar sin cambiar cantidades). Calculan en nivel 4, muestran una vista previa, una línea se puede fijar con el candado y se puede deshacer. Reemplazan «¿Qué más cabe?» e «Intentar consolidar».",
      "Herramientas de capacidad: el cálculo completo tardaba hasta 40 segundos y ahora tarda unos pocos. En pallets completos se puede ver el vehículo lleno o el pallet armado.",
      "Botón ES | EN arriba (y en la pantalla de entrada): toda la herramienta en inglés, también el Excel de resultados, el instructivo y el PDF. Las plantillas de intercambio (maestro, carga y vehículos) siguen en español para que se puedan volver a subir.",
      "Primeros pasos en el 3D vacío: una lista con lo que falta (maestro, pedido y vehículo) y el botón Calcular. Ctrl+Enter calcula desde cualquier lugar.",
      "Las columnas Entrega, Pedido y Destino solo aparecen si se usan (o con «Entrega y pedido»), para que la tabla del pedido no se salga de la pantalla.",
      "En Maestro, los ocho enlaces se juntaron en dos menús: «Importar» y «Descargar».",
      "Los mensajes flotan abajo a la izquierda y se ocultan solos; ya no empujan la pantalla.",
      "Ayuda empieza con «Cómo se usa» en 4 pasos; el significado de cada campo va plegado por tema y las novedades quedan al final.",
      "Herramientas nuevas: Calidad del maestro (medidas en cero o de relleno, pesos que no cuadran con el tamaño, SKUs que no caben en ningún vehículo, repetidos), Comparar pallets, Vehículos necesarios (con flete total y por caja si hay tarifas) y Convertidor de unidades.",
      "El semáforo de paletizado lleva además un símbolo (✓ ! ✕) para quien no distingue bien los colores, y en modo pallet las acciones sugeridas dicen «pallet» en lugar de «vehículo».",
    ],
  },
  {
    version: "1.4.0", fecha: "23/09/2026",
    cambios: [
      "«Mercancía» ahora se llama «Pedido», y en toda la herramienta se dice «pallet» en lugar de «tarima». Los maestros viejos (con la columna «Tarima») se siguen leyendo.",
      "Paletizado queda solo como catálogo de pallets: se crean, duplican y quitan ahí, y se eligen en cada línea del pedido. El Maestro ya no tiene el botón «+ carga»: al pedido se agrega desde Pedido.",
      "Con más de 3 vehículos, arriba del 3D aparece un selector con flechas para pasar de uno en uno, en vez de muchos botones amontonados.",
      "Herramientas por secciones plegables. En capacidad suelta y en pallets completos, «Calcular carga» corre el cálculo completo (con el nivel y las reglas activas) y lo muestra en el 3D; «Volver a mi carga» regresa al pedido. En suelta se eligen las rotaciones (todas por omisión); en pallets completos, el pallet y la configuración (estándar del SKU, óptima o a mano).",
      "Nueva herramienta «Pallet óptimo y paletizado para fabricación»: para una altura objetivo compara entrelazado, columnas e híbrido, con semáforo de estabilidad, centro de gravedad y compresión (con el BCT de la caja, la humedad y el tiempo en almacén, o con el peso máximo encima). Si ninguno aguanta, sugiere cuántos niveles sí. Cada patrón se ve en el 3D con las capas en dos tonos.",
      "Listado de SKUs en Excel (con BCT opcional por SKU) para calcular el paletizado de todos, verlos uno por uno en el 3D, bajar el resultado en Excel y generar un PDF con una hoja por SKU, al estilo del reporte de CubeMaster.",
      "Edición a mano en el 3D: «Editar a mano» permite elegir una caja o pallet con clic y girarla, moverla (cae sola hasta donde tenga apoyo), recorrerla hasta topar, quitarla y volverla a colocar, con deshacer. Cada cambio se valida en vivo: se marca en rojo lo que quede flotando, encimado, fuera del vehículo, en una orientación no permitida, sobre algo que no aguanta o arriba del peso máximo. Lo editado sale en el Excel y el instructivo.",
    ],
  },
  {
    version: "1.3.0", fecha: "23/09/2026",
    cambios: [
      "Acciones sugeridas arriba de los resultados, en cuanto termina el cálculo: en rojo lo que no se cargó, en verde si sobra espacio (con un botón «¿Qué más cabe?» que busca con qué completar el vehículo usando SKUs del mismo pedido) y en amarillo los avisos del armado. Antes estaba escondido en las últimas pestañas.",
      "«Acepta otro pallet encima» ahora explica cuando no se puede: por ejemplo, si el pallet termina con un nivel incompleto (20 cajas con 9 por nivel) no queda plano arriba, y te dice con cuántas cajas sí se apila (18 o 27). También avisa si dos pallets no caben en la altura del vehículo.",
      "La pestaña «Completar espacios» ahora se llama «¿Qué más cabe?».",
    ],
  },
  {
    version: "1.2.5", fecha: "23/09/2026",
    cambios: [
      "Herramientas ya no se traba. Con SKU muy chicos (por ejemplo los que traen 10 × 10 × 10 mm de relleno) la página intentaba acomodar cientos de miles de piezas una por una y dejaba de responder. Ahora responde al instante y, en esos casos, da un aproximado en rejilla.",
      "El SKU se busca escribiendo el código o parte de la descripción, en vez de una lista con los 26 mil productos. Debajo se ven sus medidas y peso.",
      "Si el SKU tiene medidas diminutas, avisa que pueden ser datos de relleno en el maestro. Un SKU con alguna medida en cero ya no deja la página pensando: dice que no cabe.",
    ],
  },
  {
    version: "1.2.4", fecha: "23/09/2026",
    cambios: [
      "«Nueva carga» vuelve a estar a la vista, junto al nombre de la carga. Si ya hay un pedido capturado, pregunta antes de borrarlo.",
    ],
  },
  {
    version: "1.2.3", fecha: "23/09/2026",
    cambios: [
      "Los Excel que descarga la herramienta pesan como los de Excel: el maestro completo pasa de 45 MB a unos 5 MB. Aplica al maestro, las plantillas, los vehículos y los resultados; el contenido es el mismo.",
    ],
  },
  {
    version: "1.2.2", fecha: "23/09/2026",
    cambios: [
      "Barra de arriba más ligera: el correo, Nueva carga, los ejemplos y Cerrar sesión pasan al menú de tres puntos (···). Ya no se corta en laptops ni con el zoom de Windows al 125% o 150%.",
      "La separación entre la tabla y la vista 3D se puede mover: arrastra la línea del centro. Arranca mitad y mitad y recuerda tu ajuste.",
      "Los indicadores del resumen (utilización, peso, bultos, centro de gravedad) se acomodan al ancho del panel y ya no se amontonan.",
      "Las pestañas de resultados se deslizan de lado cuando no caben, y Excel e Instructivo siempre quedan a la vista.",
    ],
  },
  {
    version: "1.2.1", fecha: "23/09/2026",
    cambios: [
      "El maestro se guarda comprimido en la nube: un maestro de 26 mil productos pasa de 20 MB a poco más de 1 MB. Carga más rápido y cuida el límite gratuito de Supabase. Los maestros ya guardados se siguen abriendo igual.",
    ],
  },
  {
    version: "1.2.0", fecha: "23/09/2026",
    cambios: [
      "Unidades americanas: arriba eliges mm · kg o in · lb. Toda la pantalla, la captura, el Excel de resultados y el instructivo cambian a pulgadas, libras, pies³ y pies. Se recuerda en tu usuario.",
      "Al subir un maestro, dimensiones, Bundle o catálogo de vehículos puedes elegir en qué unidades viene (mm, cm, m o pulgadas y libras), o dejar que la herramienta lo detecte por el encabezado, por ejemplo «Largo (in)».",
      "Los archivos que descargas salen en tu unidad, con la unidad en el encabezado, y se reconocen solos al volver a subirlos.",
      "El cálculo no cambia: por dentro todo se sigue calculando en milímetros y kilogramos.",
    ],
  },
  {
    version: "1.1.2", fecha: "23/09/2026",
    cambios: [
      "El guion en el SKU ahora cuenta: 852-10 y 85210 son productos distintos. Antes el maestro los tomaba como repetidos y se quedaba solo con uno.",
      "Si un pedido trae el código sin guion y en el maestro solo hay uno parecido, lo sigue encontrando.",
    ],
  },
  {
    version: "1.1.1", fecha: "23/09/2026",
    cambios: [
      "Los escenarios guardados antes de la 1.1.0 ya muestran los vehículos nuevos (53FT-DryVan y 48FT-DryVan) sin perder los que tenían.",
      "El nombre de la herramienta ya no se parte en dos líneas en pantallas medianas.",
    ],
  },
  {
    version: "1.1.0", fecha: "23/09/2026",
    cambios: [
      "Bundles (BDL): al cargar un pedido, los SKUs de manufactura propia se dividen solos en Bundles completos y cajas sueltas. Nuevo importador del archivo CS-BDL en Maestro.",
      "Completar espacios: sugiere cuántas cajas más de los SKUs del pedido caben en el espacio que sobra, sin agregar vehículos.",
      "Consolidar: si el último vehículo va casi vacío (menos del 5%), intenta meter todo en uno menos; si no se puede, dice qué cantidades reducir.",
      "Herramientas: capacidad máxima suelta de un SKU, pallets completos que caben y mejor armado de pallet.",
      "Instructivo completo: un solo documento con el paso a paso de todos los vehículos.",
      "Vehículos 53FT-DryVan y 48FT-DryVan (EE.UU.).",
      "«Simular la carga real» reproduce cómo se carga en el piso: bultos de pie, holgura entre SKUs y compresión solo en bolsas.",
    ],
  },
  { version: "1.0.0", fecha: "20/09/2026", cambios: ["Primera versión publicada: maestro, pedido, cubicaje 3D, paletizado, entregas, instructivo y Excel de resultados."] },
];
