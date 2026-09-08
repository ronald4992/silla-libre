export interface DatosReserva {
  restaurante: string;
  fecha: string;
  hora: string;
  personas: number;
  correo: string;
}

export function crearEventoCalendario(reserva: DatosReserva): void {
  const inicio = `${reserva.fecha.replaceAll("-", "")}T${reserva.hora.replace(":", "")}00`;
  const contenido = [
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

  const archivo = new Blob([contenido], { type: "text/calendar;charset=utf-8" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = `reserva-${reserva.restaurante.toLowerCase().replaceAll(" ", "-")}.ics`;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

export async function avisarReserva(reserva: DatosReserva): Promise<void> {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) return;

  await fetch(`${apiUrl}/notificaciones/reserva`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reserva),
  });
}
