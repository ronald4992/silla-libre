import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync } from "node:fs";
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

function responder(
  respuestaHttp: ServerResponse,
  estado: number,
  contenido: object,
): void {
  respuestaHttp.writeHead(estado, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": process.env.ORIGEN_FRONTEND ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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
  if (solicitud.method !== "POST") {
    responder(respuestaHttp, 404, { mensaje: "Ruta no encontrada." });
    return;
  }
  const ruta = new URL(solicitud.url ?? "/", "http://localhost").pathname;
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
