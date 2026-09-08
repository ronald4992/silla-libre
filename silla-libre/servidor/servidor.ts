import { createServer } from "node:http";
import nodemailer from "nodemailer";

interface DatosReserva {
  restaurante: string;
  fecha: string;
  hora: string;
  personas: number;
  correo: string;
}

const puerto = Number(process.env.PUERTO ?? 3001);
const remitente = process.env.CORREO_REMITENTE ?? "reservas@sillalibre.co";
const transportador = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USUARIO, pass: process.env.SMTP_CONTRASEÑA },
    })
  : null;

function respuesta(respuestaHttp: import("node:http").ServerResponse, estado: number, contenido: object) {
  respuestaHttp.writeHead(estado, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  respuestaHttp.end(JSON.stringify(contenido));
}

function eventoCalendario(reserva: DatosReserva) {
  const inicio = `${reserva.fecha.replaceAll("-", "")}T${reserva.hora.replace(":", "")}00`;
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Silla Libre//Reservas//ES", "BEGIN:VEVENT", `DTSTART:${inicio}`, `SUMMARY:Reserva en ${reserva.restaurante}`, `DESCRIPTION:Reserva para ${reserva.personas} personas en Silla Libre.`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}

const servidor = createServer((solicitud, respuestaHttp) => {
  if (solicitud.method === "OPTIONS") { respuesta(respuestaHttp, 204, {}); return; }
  if (solicitud.method !== "POST" || solicitud.url !== "/notificaciones/reserva") { respuesta(respuestaHttp, 404, { mensaje: "Ruta no encontrada" }); return; }
  let cuerpo = "";
  solicitud.on("data", (fragmento) => { cuerpo += fragmento; });
  solicitud.on("end", async () => {
    try {
      const reserva = JSON.parse(cuerpo) as DatosReserva;
      if (!reserva.correo || !reserva.restaurante || !reserva.fecha || !reserva.hora) { respuesta(respuestaHttp, 400, { mensaje: "Faltan datos de la reserva" }); return; }
      if (transportador) {
        await transportador.sendMail({ from: remitente, to: reserva.correo, subject: `Reserva confirmada en ${reserva.restaurante}`, text: `Tu reserva para ${reserva.personas} personas está confirmada el ${reserva.fecha} a las ${reserva.hora}.`, attachments: [{ filename: "reserva-silla-libre.ics", content: eventoCalendario(reserva), contentType: "text/calendar" }] });
      }
      respuesta(respuestaHttp, 200, { enviado: Boolean(transportador), mensaje: transportador ? "Correo enviado" : "Modo demostración: configura SMTP para enviar correos" });
    } catch { respuesta(respuestaHttp, 500, { mensaje: "No fue posible procesar la reserva" }); }
  });
});

servidor.listen(puerto, () => console.log(`Servidor de notificaciones activo en http://localhost:${puerto}`));
