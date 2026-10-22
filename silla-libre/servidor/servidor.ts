import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync } from "node:fs";
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import nodemailer from "nodemailer";
import { loadEnvFile } from "node:process";

if (existsSync(".env.local")) loadEnvFile(".env.local");

interface DatosReserva {
  restaurante: string;
  fecha: string;
  hora: string;
  personas: number;
  correo: string;
}

interface SolicitudRestaurante {
  nombre: string;
  direccion: string;
  comida: string;
  correoPropietario: string;
  certificado: {
    nombre: string;
    tipo: string;
    contenido: string;
  };
}

const puerto = Number(process.env.PUERTO ?? 3001);
const remitente = process.env.CORREO_REMITENTE ?? "reservas@sillalibre.co";
const destinatario = process.env.CORREO_SOLICITUDES ?? "essillalibre@gmail.com";
const transportador =
  process.env.SMTP_HOST && process.env.SMTP_USUARIO && process.env.SMTP_CONTRASEÑA
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USUARIO,
          pass: process.env.SMTP_CONTRASEÑA,
        },
      })
    : null;
const limitesPorIp = new Map<string, { cantidad: number; reinicio: number }>();
const ventanaLimite = 15 * 60 * 1000;
const maxSolicitudesPorVentana = 5;
const maximoCuerpo = 14 * 1024 * 1024;
const maximoArchivo = 10 * 1024 * 1024;
const correoAdministrador = (
  process.env.ADMIN_EMAIL ?? process.env.VITE_ADMIN_EMAIL ?? ""
).trim().toLowerCase();

class ErrorHttp extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

function serviciosFirebaseAdmin() {
  const proyectoId = process.env.VITE_FIREBASE_PROJECT_ID;
  if (!proyectoId) {
    throw new Error("Falta VITE_FIREBASE_PROJECT_ID en el entorno del servidor.");
  }
  const aplicacion =
    getApps()[0] ??
    initializeApp({
      credential: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
        ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
        : applicationDefault(),
      projectId: proyectoId,
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    });
  return {
    autenticacion: getAuth(aplicacion),
    baseDatos: getFirestore(aplicacion),
    almacenamiento: getStorage(aplicacion).bucket(),
  };
}

async function verificarAdministrador(
  solicitud: IncomingMessage,
): Promise<DecodedIdToken> {
  if (!correoAdministrador) {
    throw new ErrorHttp(503, "El correo administrador no está configurado en el servidor.");
  }
  const encabezado = solicitud.headers.authorization;
  const token = encabezado?.startsWith("Bearer ")
    ? encabezado.slice("Bearer ".length)
    : "";
  if (!token) throw new ErrorHttp(401, "Inicia sesión para continuar.");
  const autenticacion = serviciosFirebaseAdmin().autenticacion;
  let identidad: DecodedIdToken;
  try {
    identidad = await autenticacion.verifyIdToken(token);
  } catch (error) {
    const codigo =
      error && typeof error === "object" && "code" in error
        ? error.code
        : undefined;
    if (typeof codigo === "string" && codigo.startsWith("auth/")) {
      throw new ErrorHttp(401, "La sesión no es válida. Inicia sesión nuevamente.");
    }
    throw error;
  }
  if (
    !identidad.email_verified ||
    identidad.email?.trim().toLowerCase() !== correoAdministrador
  ) {
    throw new ErrorHttp(403, "La cuenta no tiene permisos de administración.");
  }
  return identidad;
}

async function listarCuentasAdministrador() {
  const { autenticacion, baseDatos } = serviciosFirebaseAdmin();
  const [perfiles, restaurantes] = await Promise.all([
    baseDatos.collection("perfiles").get(),
    baseDatos.collection("restaurantes").get(),
  ]);
  const tiposCuenta = new Map<string, "usuario" | "restaurante">();
  perfiles.docs.forEach((perfil) => {
    if (perfil.data().tipo === "restaurante") {
      tiposCuenta.set(perfil.id, "restaurante");
    }
  });
  restaurantes.docs.forEach((restaurante) => {
    const propietario = restaurante.data().propietario;
    if (typeof propietario === "string") {
      tiposCuenta.set(propietario, "restaurante");
    }
  });

  const usuarios = [];
  let pagina: string | undefined;
  do {
    const resultado = await autenticacion.listUsers(1000, pagina);
    usuarios.push(...resultado.users);
    pagina = resultado.pageToken;
  } while (pagina);

  const cuentas = usuarios.map((usuario) => ({
    uid: usuario.uid,
    correo: usuario.email ?? "",
    nombre: usuario.displayName ?? "",
    tipo: tiposCuenta.get(usuario.uid) ?? "usuario",
    creadoEn: new Date(usuario.metadata.creationTime).toISOString(),
  }));
  const hoy = new Date();
  const meses = Array.from({ length: 6 }, (_, indice) => {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - 5 + indice, 1);
    return {
      clave: `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`,
      mes: new Intl.DateTimeFormat("es-CO", {
        month: "short",
        year: "numeric",
      }).format(fecha),
      usuarios: 0,
      restaurantes: 0,
    };
  });
  const mesPorClave = new Map(meses.map((mes) => [mes.clave, mes]));
  cuentas.forEach((cuenta) => {
    const mes = mesPorClave.get(cuenta.creadoEn.slice(0, 7));
    if (mes) mes[cuenta.tipo === "restaurante" ? "restaurantes" : "usuarios"] += 1;
  });
  return {
    cuentas,
    estadisticas: {
      usuarios: cuentas.filter((cuenta) => cuenta.tipo === "usuario").length,
      restaurantes: cuentas.filter((cuenta) => cuenta.tipo === "restaurante").length,
      registrosPorMes: meses,
    },
  };
}

async function eliminarCuentaAdministrador(uid: string, administradorUid: string) {
  const { autenticacion, baseDatos, almacenamiento } = serviciosFirebaseAdmin();
  const usuario = await autenticacion.getUser(uid);
  if (
    uid === administradorUid ||
    usuario.email?.trim().toLowerCase() === correoAdministrador
  ) {
    throw new ErrorHttp(400, "No se puede eliminar la cuenta administradora.");
  }

  const restaurantes = await baseDatos
    .collection("restaurantes")
    .where("propietario", "==", uid)
    .get();
  const idsRestaurantes = new Set(restaurantes.docs.map((restaurante) => restaurante.id));
  const ids = [...idsRestaurantes];
  const [reservasPropias, reseñasPropias, reservasRestaurantes, reseñasRestaurantes, ocupaciones] =
    await Promise.all([
      baseDatos.collection("reservas").where("usuario", "==", uid).get(),
      baseDatos.collection("resenas").where("usuarioId", "==", uid).get(),
      Promise.all(
        ids.map((id) =>
          baseDatos.collection("reservas").where("restauranteId", "==", id).get(),
        ),
      ),
      Promise.all(
        ids.map((id) =>
          baseDatos.collection("resenas").where("restauranteId", "==", id).get(),
        ),
      ),
      Promise.all(
        ids.map((id) =>
          baseDatos.collection("ocupacionTurnos").where("restauranteId", "==", id).get(),
        ),
      ),
    ]);
  const reservas = new Map(
    [...reservasPropias.docs, ...reservasRestaurantes.flatMap((grupo) => grupo.docs)]
      .map((reserva) => [reserva.id, reserva] as const),
  );
  const idsReservas = [...reservas.values()];
  const reservasDeOtrosRestaurantes = idsReservas.filter((reserva) => {
    const datos = reserva.data();
    return (
      datos.usuario === uid &&
      typeof datos.turnoId === "string" &&
      typeof datos.restauranteId === "string" &&
      !idsRestaurantes.has(datos.restauranteId)
    );
  });
  for (const reserva of reservasDeOtrosRestaurantes) {
    await baseDatos.runTransaction(async (transaccion) => {
      const reservaActual = await transaccion.get(reserva.ref);
      if (!reservaActual.exists || reservaActual.data()?.estado === "Cancelada") return;
      const turnoId = reservaActual.data()?.turnoId;
      if (typeof turnoId !== "string") return;
      const turno = baseDatos.collection("ocupacionTurnos").doc(turnoId);
      const ocupacion = await transaccion.get(turno);
      if (ocupacion.exists) {
        const mesasOcupadas = ocupacion.data()?.mesasOcupadas;
        transaccion.update(turno, {
          mesasOcupadas:
            typeof mesasOcupadas === "number" ? Math.max(mesasOcupadas - 1, 0) : 0,
          actualizadoEn: new Date(),
        });
      }
    });
  }

  const referenciasUnicas = new Map(
    [
    ...idsReservas.map((reserva) => reserva.ref),
    ...reseñasPropias.docs.map((reseña) => reseña.ref),
    ...reseñasRestaurantes.flatMap((grupo) => grupo.docs.map((reseña) => reseña.ref)),
    ...ocupaciones.flatMap((grupo) => grupo.docs.map((ocupacion) => ocupacion.ref)),
    baseDatos.collection("perfiles").doc(uid),
    ...restaurantes.docs.flatMap((restaurante) => [
      restaurante.ref,
      baseDatos.collection("restaurantesPublicos").doc(restaurante.id),
    ]),
    ].map((referencia) => [referencia.path, referencia] as const),
  );
  const referencias = [...referenciasUnicas.values()];
  for (let inicio = 0; inicio < referencias.length; inicio += 400) {
    const lote = baseDatos.batch();
    referencias.slice(inicio, inicio + 400).forEach((referencia) => lote.delete(referencia));
    await lote.commit();
  }

  for (const prefijo of [
    `perfiles/${uid}/`,
    `certificados/${uid}/`,
    `menus/${uid}/`,
  ]) {
    await almacenamiento.deleteFiles({ prefix: prefijo, force: true });
  }
  await autenticacion.deleteUser(uid);
}

function responder(
  respuestaHttp: ServerResponse,
  estado: number,
  contenido: object,
): void {
  respuestaHttp.writeHead(estado, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": process.env.ORIGEN_FRONTEND ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  respuestaHttp.end(estado === 204 ? undefined : JSON.stringify(contenido));
}

function leerCuerpo(
  solicitud: IncomingMessage,
  limite: number,
): Promise<string> {
  return new Promise((resolver, rechazar) => {
    let cuerpo = "";
    let excedido = false;
    solicitud.setEncoding("utf8");
    solicitud.on("data", (fragmento: string) => {
      if (excedido) return;
      cuerpo += fragmento;
      if (Buffer.byteLength(cuerpo) > limite) {
        excedido = true;
        rechazar(new Error("El archivo excede el tamaño máximo permitido."));
      }
    });
    solicitud.on("end", () => {
      if (!excedido) resolver(cuerpo);
    });
    solicitud.on("error", rechazar);
  });
}

function eventoCalendario(reserva: DatosReserva): string {
  const inicio = `${reserva.fecha.replaceAll("-", "")}T${reserva.hora.replace(":", "")}00`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Silla Libre//Reservas//ES",
    "BEGIN:VEVENT",
    `DTSTART:${inicio}`,
    `SUMMARY:Reserva en ${reserva.restaurante}`,
    `DESCRIPTION:Reserva para ${reserva.personas} personas en Silla Libre.`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function validarSolicitud(
  valor: unknown,
): SolicitudRestaurante | null {
  if (!valor || typeof valor !== "object") return null;
  const solicitud = valor as Partial<SolicitudRestaurante>;
  const certificado = solicitud.certificado;
  if (
    typeof solicitud.nombre !== "string" ||
    typeof solicitud.direccion !== "string" ||
    typeof solicitud.comida !== "string" ||
    typeof solicitud.correoPropietario !== "string" ||
    !certificado ||
    typeof certificado.nombre !== "string" ||
    typeof certificado.tipo !== "string" ||
    typeof certificado.contenido !== "string"
  ) {
    return null;
  }
  if (
    !solicitud.nombre.trim() ||
    !solicitud.direccion.trim() ||
    !solicitud.comida.trim() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(solicitud.correoPropietario)
  ) {
    return null;
  }
  return solicitud as SolicitudRestaurante;
}

function nombreArchivoSeguro(nombre: string): string {
  return nombre.split(/[\\/]/).pop()?.replace(/[^a-zA-Z0-9._-]/g, "_") || "certificado";
}

function limitarPorIp(ip: string): boolean {
  const ahora = Date.now();
  const registro = limitesPorIp.get(ip);
  if (!registro || registro.reinicio <= ahora) {
    limitesPorIp.set(ip, { cantidad: 1, reinicio: ahora + ventanaLimite });
    return true;
  }
  if (registro.cantidad >= maxSolicitudesPorVentana) return false;
  registro.cantidad += 1;
  return true;
}

const servidor = createServer(async (solicitud, respuestaHttp) => {
  if (solicitud.method === "OPTIONS") {
    responder(respuestaHttp, 204, {});
    return;
  }
  const ruta = new URL(solicitud.url ?? "/", "http://localhost").pathname;
  if (ruta === "/admin/cuentas" || ruta.startsWith("/admin/cuentas/")) {
    try {
      const administrador = await verificarAdministrador(solicitud);
      if (solicitud.method === "GET" && ruta === "/admin/cuentas") {
        responder(respuestaHttp, 200, await listarCuentasAdministrador());
        return;
      }
      const coincidencia = ruta.match(/^\/admin\/cuentas\/([^/]+)$/);
      if (solicitud.method === "DELETE" && coincidencia) {
        let uid: string;
        try {
          uid = decodeURIComponent(coincidencia[1]);
        } catch {
          throw new ErrorHttp(400, "El identificador de la cuenta no es válido.");
        }
        await eliminarCuentaAdministrador(uid, administrador.uid);
        responder(respuestaHttp, 200, { mensaje: "La cuenta y sus datos asociados fueron eliminados." });
        return;
      }
      responder(respuestaHttp, 404, { mensaje: "Ruta de administración no encontrada." });
    } catch (error) {
      console.error("No se pudo procesar la solicitud de administración:", error);
      const estado = error instanceof ErrorHttp ? error.estado : 500;
      responder(respuestaHttp, estado, {
        mensaje:
          error instanceof ErrorHttp
            ? error.message
            : "No se pudo completar la operación administrativa.",
      });
    }
    return;
  }
  if (solicitud.method !== "POST") {
    responder(respuestaHttp, 404, { mensaje: "Ruta no encontrada." });
    return;
  }
  if (ruta !== "/notificaciones/reserva" && ruta !== "/solicitudes/restaurante") {
    responder(respuestaHttp, 404, { mensaje: "Ruta no encontrada." });
    return;
  }
  if (ruta === "/solicitudes/restaurante") {
    const ip = solicitud.socket.remoteAddress ?? "desconocida";
    if (!limitarPorIp(ip)) {
      responder(respuestaHttp, 429, {
        mensaje: "Se alcanzó el límite de solicitudes. Inténtalo más tarde.",
      });
      return;
    }
    if (!transportador) {
      responder(respuestaHttp, 503, {
        mensaje: "El envío de correo no está habilitado. Configura las credenciales SMTP del servidor.",
      });
      return;
    }
  }

  try {
    const cuerpo = await leerCuerpo(solicitud, maximoCuerpo);
    const datos: unknown = JSON.parse(cuerpo);
    if (ruta === "/notificaciones/reserva") {
      const reserva = datos as Partial<DatosReserva>;
      if (
        typeof reserva.correo !== "string" ||
        typeof reserva.restaurante !== "string" ||
        typeof reserva.fecha !== "string" ||
        typeof reserva.hora !== "string" ||
        typeof reserva.personas !== "number"
      ) {
        responder(respuestaHttp, 400, { mensaje: "Faltan datos de la reserva." });
        return;
      }
      if (transportador) {
        await transportador.sendMail({
          from: remitente,
          to: reserva.correo,
          subject: `Reserva confirmada en ${reserva.restaurante}`,
          text: `Tu reserva para ${reserva.personas} personas está confirmada el ${reserva.fecha} a las ${reserva.hora}.`,
          attachments: [
            {
              filename: "reserva-silla-libre.ics",
              content: eventoCalendario(reserva as DatosReserva),
              contentType: "text/calendar",
            },
          ],
        });
      }
      responder(respuestaHttp, 200, {
        enviado: Boolean(transportador),
        mensaje: transportador
          ? "Correo enviado."
          : "Modo demostración: configura SMTP para enviar correos.",
      });
      return;
    }

    const solicitudRestaurante = validarSolicitud(datos);
    if (!solicitudRestaurante) {
      responder(respuestaHttp, 400, {
        mensaje: "Completa los datos del restaurante y adjunta un certificado válido.",
      });
      return;
    }
    const archivo = solicitudRestaurante.certificado;
    const extension = nombreArchivoSeguro(archivo.nombre).split(".").pop()?.toLowerCase();
    const tiposPermitidos: Record<string, string> = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
    };
    if (!extension || tiposPermitidos[extension] !== archivo.tipo) {
      responder(respuestaHttp, 400, {
        mensaje: "El certificado debe ser un PDF o una imagen PNG, JPG o WEBP.",
      });
      return;
    }
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(archivo.contenido)) {
      responder(respuestaHttp, 400, { mensaje: "El archivo adjunto no es válido." });
      return;
    }
    const contenidoArchivo = Buffer.from(archivo.contenido, "base64");
    if (contenidoArchivo.length === 0 || contenidoArchivo.length > maximoArchivo) {
      responder(respuestaHttp, 400, {
        mensaje: "El certificado debe pesar más de 0 y hasta 10 MB.",
      });
      return;
    }
    await transportador!.sendMail({
      from: remitente,
      to: destinatario,
      replyTo: solicitudRestaurante.correoPropietario,
      subject: `Solicitud de restaurante: ${solicitudRestaurante.nombre}`,
      text: [
        "Nueva solicitud de registro de restaurante en Silla Libre.",
        `Nombre: ${solicitudRestaurante.nombre}`,
        `Dirección: ${solicitudRestaurante.direccion}`,
        `Tipo de comida: ${solicitudRestaurante.comida}`,
        `Correo del responsable: ${solicitudRestaurante.correoPropietario}`,
      ].join("\n"),
      attachments: [
        {
          filename: nombreArchivoSeguro(archivo.nombre),
          content: contenidoArchivo,
          contentType: archivo.tipo,
        },
      ],
    });
    responder(respuestaHttp, 200, { enviado: true, mensaje: "Solicitud enviada." });
  } catch (error) {
    console.error("No se pudo procesar la solicitud HTTP:", error);
    if (error instanceof Error && error.message.includes("tamaño máximo")) {
      responder(respuestaHttp, 413, { mensaje: error.message });
      return;
    }
    if (error instanceof SyntaxError) {
      responder(respuestaHttp, 400, { mensaje: "El cuerpo de la solicitud no es JSON válido." });
      return;
    }
    responder(respuestaHttp, 502, {
      mensaje: "No se pudo enviar el correo. Revisa la configuración SMTP del servidor.",
    });
  }
});

servidor.listen(puerto, () => {
  console.log(`Servidor de notificaciones activo en http://localhost:${puerto}`);
});
