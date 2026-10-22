import { useEffect, useMemo, useState } from "react";
import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  listAll,
  ref,
  uploadBytesResumable,
  type StorageReference,
  type UploadTaskSnapshot,
} from "firebase/storage";
import { restaurantes } from "./datos/restaurante";
import type { Restaurante } from "./tipos/restaurantes";
import {
  autenticacion,
  almacenamiento,
  baseDatos,
} from "./servicios/firebase";
import {
  avisarReserva,
  crearEventoCalendario,
  type DatosReserva,
} from "./servicios/reservas";

type Pestaña = "inicio" | "restaurantes" | "reservas" | "perfil";
type TipoCuenta = "usuario" | "restaurante";
interface PlatoMenu {
  id: string;
  nombre: string;
  descripcion: string;
  precio: string;
}
interface RestaurantePropietario {
  id: string;
  nombre: string;
  direccion: string;
  comida: string;
  certificado: string;
  menu: PlatoMenu[];
  menuPdfUrl: string;
  menuPdfNombre: string;
  mesasPorTurno: number;
  diasNoDisponibles: number[];
  fechasNoDisponibles: string[];
}
interface RestauranteReservable extends Restaurante {
  propietario: string;
  mesasPorTurno: number;
  diasNoDisponibles: number[];
  fechasNoDisponibles: string[];
}
interface ConfiguracionDisponibilidad {
  mesasPorTurno: number;
  diasNoDisponibles: number[];
  fechasNoDisponibles: string[];
}
function FormularioPerfil({
  usuario,
  nombre,
  cambiarNombre,
  apellido = "",
  cambiarApellido,
  tratamiento = "ninguno",
  cambiarTratamiento,
  fechaNacimiento = "",
  cambiarFechaNacimiento,
  mostrarDatosComensal = false,
  telefono,
  cambiarTelefono,
  foto,
  cambiarFoto,
  guardar,
  cargando,
}: {
  usuario: User;
  nombre: string;
  cambiarNombre: (valor: string) => void;
  apellido?: string;
  cambiarApellido?: (valor: string) => void;
  tratamiento?: string;
  cambiarTratamiento?: (valor: string) => void;
  fechaNacimiento?: string;
  cambiarFechaNacimiento?: (valor: string) => void;
  mostrarDatosComensal?: boolean;
  telefono: string;
  cambiarTelefono: (valor: string) => void;
  foto: string;
  cambiarFoto: (archivo: File | undefined) => void;
  guardar: (evento: React.FormEvent<HTMLFormElement>) => void;
  cargando: boolean;
}) {
  return (
    <div className="perfil-grid">
      <aside className="perfil-identidad">
        <div className="avatar-grande">
          {foto ? <img src={foto} alt="Foto de perfil" /> : (nombre || usuario.email || "U").slice(0, 1).toUpperCase()}
        </div>
        <label className="boton boton-vino boton-foto">
          Cambiar foto
          <input type="file" accept="image/*" onChange={(evento) => cambiarFoto(evento.target.files?.[0])} />
        </label>
        <p>JPG o PNG · máximo 5 MB</p>
      </aside>
      <form className="formulario perfil-formulario" onSubmit={guardar}>
        <div className="separador-formulario"><span>{mostrarDatosComensal ? "INFORMACIÓN PERSONAL" : "DATOS PERSONALES"}</span></div>
        {mostrarDatosComensal && (
          <>
            <p className="ayuda-perfil">Tus datos de contacto se compartirán con el restaurante cuando hagas una reserva.</p>
            <fieldset className="opciones-tratamiento">
              <legend>Tratamiento</legend>
              {[
                ["masculino", "Masculino"],
                ["femenino", "Femenino"],
                ["ninguno", "Prefiero no decirlo"],
              ].map(([valor, etiqueta]) => (
                <label key={valor}>
                  <input
                    type="radio"
                    name="tratamiento"
                    value={valor}
                    checked={tratamiento === valor}
                    onChange={() => cambiarTratamiento?.(valor)}
                  />
                  {etiqueta}
                </label>
              ))}
            </fieldset>
          </>
        )}
        <label>
          Nombre
          <input value={nombre} onChange={(evento) => cambiarNombre(evento.target.value)} placeholder="Tu nombre" required />
        </label>
        {mostrarDatosComensal && (
          <label>
            Apellido
            <input value={apellido} onChange={(evento) => cambiarApellido?.(evento.target.value)} placeholder="Tu apellido" required />
          </label>
        )}
        <label>
          Correo electrónico
          <input value={usuario.email ?? ""} type="email" disabled />
        </label>
        {mostrarDatosComensal && (
          <label>
            Fecha de nacimiento
            <input
              value={fechaNacimiento}
              onChange={(evento) => cambiarFechaNacimiento?.(evento.target.value)}
              type="date"
            />
          </label>
        )}
        <label>
          Número de celular
          <input value={telefono} onChange={(evento) => cambiarTelefono(evento.target.value)} type="tel" placeholder="+57 300 000 0000" />
        </label>
        <button className="boton boton-vino boton-formulario" disabled={cargando}>
          {cargando ? "Guardando..." : "Guardar cambios ↗"}
        </button>
      </form>
    </div>
  );
}

function FotoPerfilRestaurante({
  foto,
  cambiarFoto,
  guardar,
  cargando,
}: {
  foto: string;
  cambiarFoto: (archivo: File | undefined) => void;
  guardar: (evento: React.FormEvent<HTMLFormElement>) => void;
  cargando: boolean;
}) {
  return (
    <form className="identidad-restaurante" onSubmit={guardar}>
      <div className="avatar-grande">
        {foto ? <img src={foto} alt="Foto del perfil del restaurante" /> : "R"}
      </div>
      <div>
        <p className="sobretitulo oscuro">IMAGEN DEL RESTAURANTE</p>
        <label className="boton boton-vino boton-foto">
          Cambiar foto
          <input
            type="file"
            accept="image/*"
            onChange={(evento) => cambiarFoto(evento.target.files?.[0])}
          />
        </label>
        <p>JPG o PNG · máximo 5 MB</p>
      </div>
      <button className="boton boton-vino" disabled={cargando}>
        {cargando ? "Guardando..." : "Guardar foto"}
      </button>
    </form>
  );
}

function ReservasUsuario({
  reservas,
  cargando,
}: {
  reservas: ReservaPerfil[];
  cargando: boolean;
}) {
  return (
    <section className="reservas-usuario">
      <div className="titulo-estadistica">
        <span>Historial de reservas</span>
        <small>Consulta tus reservas pasadas y próximas</small>
      </div>
      {cargando ? (
        <p className="aviso">Cargando tus reservas...</p>
      ) : reservas.length === 0 ? (
        <p className="aviso">Aún no tienes reservas registradas.</p>
      ) : (
        <div className="lista-reservas">
          {reservas.map((reserva, indice) => (
            <article
              className="reserva-usuario"
              key={reserva.id ?? `${reserva.fecha}-${reserva.hora}-${indice}`}
            >
              <div>
                <span>Restaurante</span>
                <strong>{reserva.restaurante}</strong>
              </div>
              <div>
                <span>Día</span>
                <strong>
                  {new Date(`${reserva.fecha}T12:00:00`).toLocaleDateString(
                    "es-CO",
                    { weekday: "long" },
                  )}
                </strong>
              </div>
              <div>
                <span>Fecha y hora</span>
                <strong>
                  {new Date(`${reserva.fecha}T12:00:00`).toLocaleDateString(
                    "es-CO",
                    { day: "numeric", month: "long", year: "numeric" },
                  )}{" "}
                  · {reserva.hora}
                </strong>
              </div>
              <div>
                <span>Comensales</span>
                <strong>
                  {reserva.personas}{" "}
                  {reserva.personas === 1 ? "persona" : "personas"}
                </strong>
              </div>
              <div>
                <span>Estado</span>
                <strong>{reserva.estado ?? "Confirmada"}</strong>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function DetalleRestaurante({
  restaurante,
  favorito,
  alternarFavorito,
  reservar,
  usuario,
  iniciarSesion,
  volver,
}: {
  restaurante: Restaurante;
  favorito: boolean;
  alternarFavorito: () => void;
  reservar: (seleccion: FormularioReserva) => void;
  usuario: User | null;
  iniciarSesion: () => void;
  volver: () => void;
}) {
  const [pestaña, setPestaña] = useState<"acerca" | "menu" | "resenas">(
    "acerca",
  );
  const [seleccionReserva, setSeleccionReserva] =
    useState<FormularioReserva>(reservaInicial);
  const [resenas, setResenas] = useState<ResenaRestaurante[]>([]);
  const [calificacion, setCalificacion] = useState(0);
  const [comentario, setComentario] = useState("");
  const [resenasCargando, setResenasCargando] = useState(true);
  const [resenaEnviando, setResenaEnviando] = useState(false);
  const [mensajeResena, setMensajeResena] = useState("");

  useEffect(() => {
    let vigente = true;
    const cargarResenas = async () => {
      setResenasCargando(true);
      setMensajeResena("");
      try {
        if (baseDatos) {
          const resultado = await getDocs(
            query(
              collection(baseDatos, "resenas"),
              where("restauranteId", "==", restaurante.id),
            ),
          );
          const cargadas = resultado.docs.flatMap((documento) => {
            const datos = documento.data();
            const resena = normalizarResena(documento.id, datos);
            return resena ? [resena] : [];
          });
          if (vigente) setResenas(cargadas);
        } else if (vigente) {
          setResenas(leerResenasLocales(restaurante.id));
        }
      } catch {
        if (vigente) {
          setMensajeResena(
            "No pudimos cargar las reseñas. Revisa tu conexión e inténtalo de nuevo.",
          );
        }
      } finally {
        if (vigente) setResenasCargando(false);
      }
    };
    void cargarResenas();
    return () => {
      vigente = false;
    };
  }, [restaurante.id]);

  const enviarResena = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!usuario) {
      iniciarSesion();
      return;
    }
    if (calificacion < 1 || calificacion > 5) {
      setMensajeResena("Selecciona una calificación de 1 a 5 estrellas.");
      return;
    }
    const texto = comentario.trim();
    if (!texto) {
      setMensajeResena("Escribe un comentario antes de publicar tu reseña.");
      return;
    }

    const nuevaResena: ResenaRestaurante = {
      id: `${restaurante.id}-${usuario.uid}-${Date.now()}`,
      restauranteId: restaurante.id,
      usuarioId: usuario.uid,
      autor:
        usuario.displayName?.trim() ||
        usuario.email?.split("@")[0] ||
        "Comensal",
      calificacion,
      comentario: texto,
      creadoEn: new Date().toISOString(),
    };
    setResenaEnviando(true);
    setMensajeResena("");
    try {
      if (baseDatos) {
        const guardada = await addDoc(collection(baseDatos, "resenas"), {
          restauranteId: restaurante.id,
          restaurante: restaurante.nombre,
          usuarioId: usuario.uid,
          autor: nuevaResena.autor,
          calificacion,
          comentario: texto,
          creadoEn: serverTimestamp(),
        });
        nuevaResena.id = guardada.id;
      } else {
        const existentes = leerResenasLocales(restaurante.id);
        localStorage.setItem(
          `silla-libre-resenas-${restaurante.id}`,
          JSON.stringify([nuevaResena, ...existentes]),
        );
      }
      setResenas((existentes) => [nuevaResena, ...existentes]);
      setCalificacion(0);
      setComentario("");
      setMensajeResena(
        baseDatos
          ? "Tu reseña se publicó correctamente."
          : "Tu reseña se guardó en este dispositivo.",
      );
    } catch {
      setMensajeResena(
        "No pudimos publicar tu reseña. Revisa tu conexión e inténtalo de nuevo.",
      );
    } finally {
      setResenaEnviando(false);
    }
  };

  const promedioResenas = resenas.length
    ? resenas.reduce((total, resena) => total + resena.calificacion, 0) /
      resenas.length
    : restaurante.rating;
  const consultaUbicacion = `${restaurante.nombre}, ${restaurante.locacion}, Bogotá, Colombia`;
  const ubicacionGoogleMaps = encodeURIComponent(consultaUbicacion);
  return (
    <section className="detalle-restaurante">
      <div className="detalle-migas">
        <button type="button" onClick={volver} aria-label="Volver a restaurantes">
          Inicio
        </button>
        <span>›</span>
        <span>Restaurantes en Bogotá</span>
        <span>›</span>
        <strong>{restaurante.nombre}</strong>
      </div>
      <div className="detalle-columnas">
        <div className="detalle-contenido">
          <div className="detalle-titulo">
            <div>
              <h1>{restaurante.nombre}</h1>
              <p>⌖ {restaurante.locacion}, Bogotá</p>
              <p>{restaurante.categoria} <span>·</span> Precio {restaurante.rangoprecios}</p>
              <p className="detalle-calificacion">
                ★ {promedioResenas.toFixed(1)} <span>·</span>{" "}
                {resenas.length
                  ? `${resenas.length} ${resenas.length === 1 ? "reseña" : "reseñas"}`
                  : "Calificación de Silla Libre"}
              </p>
            </div>
            <button
              className={`favorito detalle-favorito ${favorito ? "activo" : ""}`}
              type="button"
              onClick={alternarFavorito}
              aria-label={favorito ? "Quitar de favoritos" : "Guardar en favoritos"}
              aria-pressed={favorito}
            >
              {favorito ? "♥" : "♡"}
            </button>
          </div>
          <div className="detalle-galeria">
            <img src={restaurante.imagen} alt={`Interior de ${restaurante.nombre}`} />
            <div className="detalle-galeria-info">
              <span>{restaurante.categoria}</span>
              <strong>Una experiencia para disfrutar</strong>
              <small>{restaurante.locacion}, Bogotá</small>
            </div>
          </div>
          <div className="detalle-pestanas" role="tablist" aria-label="Información del restaurante">
            {([
              ["acerca", "Acerca de"],
              ["menu", "Menú"],
              ["resenas", "Reseñas"],
            ] as const).map(([id, etiqueta]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={pestaña === id}
                className={pestaña === id ? "activa" : ""}
                onClick={() => setPestaña(id)}
              >
                {etiqueta}
              </button>
            ))}
          </div>
          <div className="detalle-pestana-contenido" role="tabpanel">
            {pestaña === "acerca" && (
              <>
                <h2>Acerca de {restaurante.nombre}</h2>
                <p>{restaurante.descripcion}</p>
                <dl className="detalle-datos">
                  <div><dt>Tipo de cocina</dt><dd>{restaurante.categoria}</dd></div>
                  <div><dt>Ubicación</dt><dd>{restaurante.locacion}, Bogotá</dd></div>
                  <div><dt>Precio</dt><dd>{restaurante.rangoprecios}</dd></div>
                </dl>
                {restaurante.urlreserva && (
                  <a href={restaurante.urlreserva} target="_blank" rel="noreferrer">
                    Visitar sitio oficial ↗
                  </a>
                )}
              </>
            )}
            {pestaña === "menu" && (
              <>
                <h2>Menú</h2>
                <p>Consulta la carta y descubre los sabores de {restaurante.nombre}.</p>
                <p className="aviso">El menú de este restaurante estará disponible próximamente.</p>
              </>
            )}
            {pestaña === "resenas" && (
              <>
                <h2>Reseñas</h2>
                <p className="detalle-resumen-resenas">
                  <strong>★ {promedioResenas.toFixed(1)}</strong>
                  <span>
                    {resenas.length
                      ? `${resenas.length} ${resenas.length === 1 ? "reseña" : "reseñas"}`
                      : "Calificación general"}
                  </span>
                </p>
                <form className="formulario-resena" onSubmit={enviarResena}>
                  <h3>Comparte tu experiencia</h3>
                  {usuario ? (
                    <p className="resena-identidad">
                      Publicando como{" "}
                      <strong>
                        {usuario.displayName || usuario.email || "Comensal"}
                      </strong>
                    </p>
                  ) : (
                    <div className="resena-invitacion">
                      <p>Inicia sesión para calificar y publicar una reseña.</p>
                      <button
                        className="boton boton-vino"
                        type="button"
                        onClick={iniciarSesion}
                      >
                        Iniciar sesión
                      </button>
                    </div>
                  )}
                  <fieldset disabled={!usuario || resenaEnviando}>
                    <legend>Tu calificación</legend>
                    <div className="selector-estrellas" role="radiogroup" aria-label="Calificación de 1 a 5 estrellas">
                      {[1, 2, 3, 4, 5].map((valor) => (
                        <button
                          key={valor}
                          type="button"
                          role="radio"
                          aria-checked={calificacion === valor}
                          aria-label={`${valor} ${valor === 1 ? "estrella" : "estrellas"}`}
                          className={valor <= calificacion ? "seleccionada" : ""}
                          onClick={() => setCalificacion(valor)}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <label>
                      Tu reseña
                      <textarea
                        value={comentario}
                        onChange={(evento) => setComentario(evento.target.value)}
                        maxLength={1000}
                        rows={4}
                        placeholder="Cuéntales a otros comensales cómo fue tu visita..."
                        required
                      />
                    </label>
                    <button
                      className="boton boton-vino"
                      type="submit"
                      disabled={resenaEnviando || !usuario}
                    >
                      {resenaEnviando ? "Publicando..." : "Publicar reseña"}
                    </button>
                  </fieldset>
                  {mensajeResena && (
                    <p className="mensaje-resena" role="status">
                      {mensajeResena}
                    </p>
                  )}
                </form>
                <div className="lista-resenas" aria-live="polite">
                  {resenasCargando ? (
                    <p>Cargando reseñas...</p>
                  ) : resenas.length ? (
                    resenas.map((resena) => (
                      <article className="resena-publicada" key={resena.id}>
                        <div className="resena-encabezado">
                          <strong>{resena.autor}</strong>
                          <span aria-label={`${resena.calificacion} de 5 estrellas`}>
                            {"★".repeat(resena.calificacion)}
                            <span className="estrellas-vacias">
                              {"★".repeat(5 - resena.calificacion)}
                            </span>
                          </span>
                        </div>
                        <p>{resena.comentario}</p>
                        <small>
                          {new Date(resena.creadoEn).toLocaleDateString("es-CO")}
                        </small>
                      </article>
                    ))
                  ) : (
                    <p>Aún no hay reseñas. ¡Sé la primera persona en compartir su experiencia!</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        <aside className="detalle-lateral">
          <section className="detalle-reserva">
            <h2>Reserva una mesa</h2>
            <p>Encuentra el momento ideal para visitar {restaurante.nombre}.</p>
            <form
              className="detalle-reserva-formulario"
              onSubmit={(evento) => {
                evento.preventDefault();
                reservar(seleccionReserva);
              }}
            >
              <label>
                Fecha
                <input
                  type="date"
                  value={seleccionReserva.fecha}
                  onChange={(evento) =>
                    setSeleccionReserva({
                      ...seleccionReserva,
                      fecha: evento.target.value,
                    })
                  }
                  required
                />
              </label>
              <label>
                Hora
                <input
                  type="time"
                  step={3600}
                  value={seleccionReserva.hora}
                  min={
                    restaurante.id === 1
                      ? "12:30"
                      : restaurante.id === 2
                        ? "12:00"
                        : undefined
                  }
                  max={
                    restaurante.id === 1 || restaurante.id === 2
                      ? "23:00"
                      : undefined
                  }
                  onChange={(evento) =>
                    setSeleccionReserva({
                      ...seleccionReserva,
                      hora: evento.target.value,
                    })
                  }
                  required
                />
              </label>
              <label>
                Número de personas
                <select
                  value={seleccionReserva.personas}
                  onChange={(evento) =>
                    setSeleccionReserva({
                      ...seleccionReserva,
                      personas: evento.target.value,
                    })
                  }
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((numero) => (
                    <option key={numero} value={numero}>
                      {numero} {numero === 1 ? "persona" : "personas"}
                    </option>
                  ))}
                </select>
              </label>
              <button className="boton boton-vino" type="submit">
                Elegir fecha y hora <span>↗</span>
              </button>
            </form>
            <small>La reserva se confirma en el siguiente paso.</small>
            {restaurante.urlreserva && (
              <a href={restaurante.urlreserva} target="_blank" rel="noreferrer">
                Más información en el sitio oficial
              </a>
            )}
          </section>
          <section className="detalle-ubicacion" aria-labelledby="titulo-ubicacion">
            <h2 id="titulo-ubicacion">Ubicación</h2>
            <p>{restaurante.locacion}, Bogotá</p>
            <iframe
              title={`Ubicación de ${restaurante.nombre} en Google Maps`}
              src={`https://www.google.com/maps?q=${ubicacionGoogleMaps}&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${ubicacionGoogleMaps}`}
              target="_blank"
              rel="noreferrer"
            >
              Ver en Google Maps ↗
            </a>
          </section>
        </aside>
      </div>
    </section>
  );
}

interface ResenaRestaurante {
  id: string;
  restauranteId: number | string;
  usuarioId: string;
  autor: string;
  calificacion: number;
  comentario: string;
  creadoEn: string;
}

function normalizarResena(
  id: string,
  datos: Record<string, unknown>,
): ResenaRestaurante | null {
  if (
    (typeof datos.restauranteId !== "number" &&
      typeof datos.restauranteId !== "string") ||
    typeof datos.usuarioId !== "string" ||
    typeof datos.calificacion !== "number" ||
    datos.calificacion < 1 ||
    datos.calificacion > 5 ||
    typeof datos.comentario !== "string"
  ) {
    return null;
  }
  const fecha =
    datos.creadoEn &&
    typeof datos.creadoEn === "object" &&
    "toDate" in datos.creadoEn &&
    typeof datos.creadoEn.toDate === "function"
      ? datos.creadoEn.toDate().toISOString()
      : typeof datos.creadoEn === "string"
        ? datos.creadoEn
        : new Date().toISOString();
  return {
    id,
    restauranteId: datos.restauranteId,
    usuarioId: datos.usuarioId,
    autor: typeof datos.autor === "string" ? datos.autor : "Comensal",
    calificacion: datos.calificacion,
    comentario: datos.comentario,
    creadoEn: fecha,
  };
}

function leerResenasLocales(
  restauranteId: number | string,
): ResenaRestaurante[] {
  try {
    const guardado = localStorage.getItem(
      `silla-libre-resenas-${restauranteId}`,
    );
    if (!guardado) return [];
    const datos: unknown = JSON.parse(guardado);
    if (!Array.isArray(datos)) return [];
    return datos.flatMap((elemento) => {
      if (!elemento || typeof elemento !== "object") return [];
      const dato = elemento as Record<string, unknown>;
      if (
        typeof dato.id !== "string" ||
        typeof dato.usuarioId !== "string" ||
        typeof dato.autor !== "string" ||
        typeof dato.calificacion !== "number" ||
        typeof dato.comentario !== "string" ||
        typeof dato.creadoEn !== "string"
      ) {
        return [];
      }
      const resena = normalizarResena(dato.id, {
        ...dato,
        restauranteId,
      });
      return resena ? [resena] : [];
    });
  } catch {
    return [];
  }
}

function GestionDisponibilidadRestaurante({
  restaurante,
  guardar,
  cargando,
}: {
  restaurante: RestaurantePropietario;
  guardar: (id: string, datos: ConfiguracionDisponibilidad) => void;
  cargando: boolean;
}) {
  const [mesasPorTurno, setMesasPorTurno] = useState(restaurante.mesasPorTurno);
  const [diasNoDisponibles, setDiasNoDisponibles] = useState(
    restaurante.diasNoDisponibles,
  );
  const [fechasNoDisponibles, setFechasNoDisponibles] = useState(
    restaurante.fechasNoDisponibles,
  );
  const [nuevaFecha, setNuevaFecha] = useState("");
  const dias = [
    ["Lunes", 1],
    ["Martes", 2],
    ["Miércoles", 3],
    ["Jueves", 4],
    ["Viernes", 5],
    ["Sábado", 6],
    ["Domingo", 0],
  ] as const;
  return (
    <div className="disponibilidad-admin">
      <div className="titulo-estadistica">
        <span>Disponibilidad de mesas</span>
        <small>Los cambios se aplican en tiempo real a los turnos de una hora.</small>
      </div>
      <label className="mesas-disponibles">
        Mesas por turno
        <input
          type="number"
          min="0"
          max="500"
          value={mesasPorTurno}
          onChange={(evento) => setMesasPorTurno(Number(evento.target.value))}
        />
      </label>
      <fieldset className="dias-cerrados">
        <legend>Días de la semana no disponibles</legend>
        {dias.map(([nombre, indice]) => (
          <label key={indice}>
            <input
              type="checkbox"
              checked={diasNoDisponibles.includes(indice)}
              onChange={() =>
                setDiasNoDisponibles((actuales) =>
                  actuales.includes(indice)
                    ? actuales.filter((dia) => dia !== indice)
                    : [...actuales, indice],
                )
              }
            />
            {nombre}
          </label>
        ))}
      </fieldset>
      <div className="fechas-cerradas">
        <label>
          Fecha específica no disponible
          <input
            type="date"
            value={nuevaFecha}
            onChange={(evento) => setNuevaFecha(evento.target.value)}
          />
        </label>
        <button
          className="boton boton-vino"
          type="button"
          disabled={!nuevaFecha || fechasNoDisponibles.includes(nuevaFecha)}
          onClick={() => {
            setFechasNoDisponibles((actuales) =>
              [...new Set([...actuales, nuevaFecha])].sort(),
            );
            setNuevaFecha("");
          }}
        >
          Añadir fecha
        </button>
      </div>
      {fechasNoDisponibles.length > 0 && (
        <ul className="lista-fechas-cerradas">
          {fechasNoDisponibles.map((fecha) => (
            <li key={fecha}>
              {new Date(`${fecha}T12:00:00`).toLocaleDateString("es-CO")}
              <button
                className="quitar-favorito"
                type="button"
                onClick={() =>
                  setFechasNoDisponibles((actuales) =>
                    actuales.filter((actual) => actual !== fecha),
                  )
                }
                aria-label={`Quitar cierre del ${fecha}`}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        className="boton boton-vino"
        type="button"
        disabled={
          cargando ||
          !Number.isInteger(mesasPorTurno) ||
          mesasPorTurno < 0 ||
          mesasPorTurno > 500
        }
        onClick={() =>
          guardar(restaurante.id, {
            mesasPorTurno,
            diasNoDisponibles,
            fechasNoDisponibles,
          })
        }
      >
        {cargando ? "Guardando..." : "Guardar disponibilidad"}
      </button>
    </div>
  );
}

function PanelRestaurante({
  foto,
  cambiarFoto,
  guardarPerfil,
  restaurantes,
  reservas,
  datosFormulario,
  cambiarFormulario,
  registrarRestaurante,
  cambiarPlato,
  agregarPlato,
  quitarPlato,
  guardarMenu,
  subirMenuArchivo,
  progresoMenu,
  cancelarReserva,
  guardarDisponibilidad,
  cargando,
}: {
  foto: string;
  cambiarFoto: (archivo: File | undefined) => void;
  guardarPerfil: (evento: React.FormEvent<HTMLFormElement>) => void;
  restaurantes: RestaurantePropietario[];
  reservas: ReservaPerfil[];
  datosFormulario: FormularioRestaurante;
  cambiarFormulario: (datos: FormularioRestaurante) => void;
  registrarRestaurante: (evento: React.FormEvent<HTMLFormElement>) => void;
  cambiarPlato: (
    restauranteId: string,
    platoId: string,
    cambios: Partial<PlatoMenu>,
  ) => void;
  agregarPlato: (restauranteId: string) => void;
  quitarPlato: (restauranteId: string, platoId: string) => void;
  guardarMenu: (restauranteId: string) => void;
  subirMenuArchivo: (restauranteId: string, archivo: File) => void;
  progresoMenu: Record<string, number>;
  cancelarReserva: (reserva: ReservaPerfil) => void;
  guardarDisponibilidad: (
    id: string,
    datos: ConfiguracionDisponibilidad,
  ) => void;
  cargando: boolean;
}) {
  const reservasActivas = reservas.filter(
    (reserva) => reserva.estado !== "Cancelada",
  );
  const reservasPorHora = reservasActivas.reduce<Record<string, number>>(
    (total, reserva) => {
      const hora = reserva.hora.slice(0, 2);
      total[hora] = (total[hora] ?? 0) + 1;
      return total;
    },
    {},
  );
  const diasSemana = [
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
    "Domingo",
  ];
  const reservasPorDia = reservasActivas.reduce<number[]>(
    (total, reserva) => {
      const dia = new Date(`${reserva.fecha}T12:00:00`).getDay();
      total[(dia + 6) % 7] += 1;
      return total;
    },
    Array.from({ length: 7 }, () => 0),
  );
  const horaPico = Object.entries(reservasPorHora).sort(
    (a, b) => b[1] - a[1],
  )[0];
  const diaPico = Math.max(...reservasPorDia);
  const maxReservasPorHora = Math.max(...Object.values(reservasPorHora), 1);
  const maxReservasPorDia = Math.max(...reservasPorDia, 1);
  return (
    <div className="panel-restaurante">
      <FotoPerfilRestaurante
        foto={foto}
        cambiarFoto={cambiarFoto}
        guardar={guardarPerfil}
        cargando={cargando}
      />
      <div className="encabezado-panel-restaurante">
        <div>
          <p className="sobretitulo oscuro">PANEL DEL RESTAURANTE</p>
          <h3>Administra tus restaurantes y reservas.</h3>
          <p>Sube tu menú, consulta la demanda y gestiona las cancelaciones.</p>
        </div>
      </div>
      <div className="resumen-reservas">
        <div>
          <span>RESERVAS ACTIVAS</span>
          <strong>{reservasActivas.length}</strong>
          <small>En tus restaurantes</small>
        </div>
        <div>
          <span>HORA CON MÁS RESERVAS</span>
          <strong>{horaPico ? `${horaPico[0]}:00` : "--"}</strong>
          <small>
            {horaPico
              ? `${horaPico[1]} ${horaPico[1] === 1 ? "reserva" : "reservas"}`
              : "Sin reservas activas"}
          </small>
        </div>
        <div>
          <span>DÍA CON MÁS RESERVAS</span>
          <strong>
            {reservasActivas.length > 0
              ? diasSemana[reservasPorDia.indexOf(diaPico)]
              : "--"}
          </strong>
          <small>
            {reservasActivas.length > 0
              ? `${diaPico} ${diaPico === 1 ? "reserva" : "reservas"}`
              : "Sin reservas activas"}
          </small>
        </div>
      </div>
      {restaurantes.length === 0 && (
        <section className="restaurante-admin">
          <div className="titulo-estadistica">
            <span>Registra tu restaurante para empezar</span>
            <small>Después podrás subir el menú en PDF o Word y gestionar sus reservas.</small>
          </div>
          <FormularioRestaurante
            datos={datosFormulario}
            cambiar={cambiarFormulario}
            enviar={registrarRestaurante}
            cargando={cargando}
          />
        </section>
      )}
      {restaurantes.map((restaurante) => (
        <section className="restaurante-admin" key={restaurante.id}>
          <div className="titulo-restaurante-admin">
            <div>
              <span className="sobretitulo oscuro">TU RESTAURANTE</span>
              <h3>{restaurante.nombre}</h3>
              <p>{restaurante.comida} · {restaurante.direccion}</p>
            </div>
            <span className="contador">
              {restaurante.menuPdfUrl ? "Menú cargado" : `${restaurante.menu.length} platos`}
            </span>
          </div>
          <GestionDisponibilidadRestaurante
            key={`${restaurante.id}-${restaurante.mesasPorTurno}-${restaurante.diasNoDisponibles.join(",")}-${restaurante.fechasNoDisponibles.join(",")}`}
            restaurante={restaurante}
            guardar={guardarDisponibilidad}
            cargando={cargando}
          />
          <div className="menu-admin">
            <div className="titulo-estadistica">
              <span>Subir menú</span>
              <small>Acepta archivos PDF o Word (.doc, .docx)</small>
            </div>
            {restaurante.menuPdfUrl && (
              <p className="menu-archivo-actual">
                <a href={restaurante.menuPdfUrl} target="_blank" rel="noreferrer">
                  Ver {restaurante.menuPdfNombre || "menú actual"} ↗
                </a>
              </p>
            )}
            <label className="selector-menu-archivo">
              <input
                type="file"
                accept="application/pdf,.pdf,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
                disabled={cargando}
                onChange={(evento) => {
                  const archivo = evento.target.files?.[0];
                  if (archivo) {
                    subirMenuArchivo(restaurante.id, archivo);
                  }
                  evento.currentTarget.value = "";
                }}
              />
              <span className="boton boton-vino">
                {cargando && progresoMenu[restaurante.id] >= 0
                  ? "Subiendo..."
                  : restaurante.menuPdfUrl
                    ? "Cambiar archivo"
                    : "Seleccionar archivo"}
              </span>
              <span className="selector-menu-detalle">
                PDF o Word · máximo 10 MB
              </span>
            </label>
            {progresoMenu[restaurante.id] !== undefined && (
              <div className="progreso-menu" role="status" aria-live="polite">
                {progresoMenu[restaurante.id] < 0 ? (
                  <span>No se pudo guardar el archivo. Intenta subirlo de nuevo.</span>
                ) : progresoMenu[restaurante.id] < 100 ? (
                  <>
                    <progress
                      max="100"
                      value={progresoMenu[restaurante.id]}
                    />
                    <span>Subiendo {progresoMenu[restaurante.id]}%</span>
                  </>
                ) : (
                  <span>Menú guardado correctamente.</span>
                )}
              </div>
            )}
          </div>
          <div className="menu-admin">
            <div className="titulo-estadistica">
              <span>Menú</span>
              <small>Los cambios se guardan para este restaurante</small>
            </div>
            {restaurante.menu.length === 0 && (
              <p className="aviso">Todavía no agregas platos a este menú.</p>
            )}
            {restaurante.menu.map((plato) => (
              <div className="plato-editor" key={plato.id}>
                <label>
                  Plato
                  <input
                    value={plato.nombre}
                    onChange={(evento) =>
                      cambiarPlato(restaurante.id, plato.id, {
                        nombre: evento.target.value,
                      })
                    }
                    placeholder="Nombre del plato"
                  />
                </label>
                <label>
                  Descripción
                  <input
                    value={plato.descripcion}
                    onChange={(evento) =>
                      cambiarPlato(restaurante.id, plato.id, {
                        descripcion: evento.target.value,
                      })
                    }
                    placeholder="Ingredientes o detalles"
                  />
                </label>
                <label>
                  Precio
                  <input
                    type="number"
                    min="0"
                    value={plato.precio}
                    onChange={(evento) =>
                      cambiarPlato(restaurante.id, plato.id, {
                        precio: evento.target.value,
                      })
                    }
                    placeholder="45000"
                  />
                </label>
                <button
                  className="boton-texto boton-quitar-plato"
                  type="button"
                  onClick={() => quitarPlato(restaurante.id, plato.id)}
                >
                  Quitar
                </button>
              </div>
            ))}
            <div className="acciones-menu">
              <button
                className="boton-texto"
                type="button"
                onClick={() => agregarPlato(restaurante.id)}
              >
                + Agregar plato
              </button>
              <button
                className="boton boton-vino"
                type="button"
                disabled={cargando}
                onClick={() => guardarMenu(restaurante.id)}
              >
                {cargando ? "Guardando..." : "Guardar menú"}
              </button>
            </div>
          </div>
        </section>
      ))}
      <section className="restaurante-admin">
        <div className="estadisticas-grid">
          <div className="estadistica">
            <div className="titulo-estadistica">
              <span>Reservas por hora</span>
              <small>Reservas activas</small>
            </div>
            {Object.keys(reservasPorHora).length === 0 ? (
              <p className="aviso">Aún no hay reservas activas para mostrar.</p>
            ) : (
              Object.entries(reservasPorHora)
                .sort(([horaA], [horaB]) => Number(horaA) - Number(horaB))
                .map(([hora, cantidad]) => (
                  <div className="barra-estadistica" key={hora}>
                    <span>{hora}:00</span>
                    <div>
                      <i
                        style={{
                          width: `${(cantidad / maxReservasPorHora) * 100}%`,
                        }}
                      />
                    </div>
                    <strong>{cantidad}</strong>
                  </div>
                ))
            )}
          </div>
          <div className="estadistica">
            <div className="titulo-estadistica">
              <span>Reservas por día</span>
              <small>Reservas activas</small>
            </div>
            {diasSemana.map((dia, indice) => (
              <div className="barra-estadistica" key={dia}>
                <span>{dia}</span>
                <div>
                  <i
                    className="barra-dorada"
                    style={{
                      width: `${(reservasPorDia[indice] / maxReservasPorDia) * 100}%`,
                    }}
                  />
                </div>
                <strong>{reservasPorDia[indice]}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
      {restaurantes.length > 0 && (
        <section className="restaurante-admin">
          <div className="titulo-estadistica">
            <span>Registrar otro restaurante</span>
            <small>Los restaurantes quedan asociados a esta cuenta</small>
          </div>
          <FormularioRestaurante
            datos={datosFormulario}
            cambiar={cambiarFormulario}
            enviar={registrarRestaurante}
            cargando={cargando}
          />
        </section>
      )}
      <section className="restaurante-admin">
        <div className="titulo-estadistica">
          <span>Reservas recibidas</span>
          <small>Las cancelaciones se reflejan en el perfil del comensal</small>
        </div>
        {reservas.length === 0 ? (
          <p className="aviso">Todavía no hay reservas para tus restaurantes.</p>
        ) : (
          <div className="lista-reservas">
            {reservas.map((reserva, indice) => (
              <article
                className="fila-reserva"
                key={reserva.id ?? `${reserva.fecha}-${reserva.hora}-${indice}`}
              >
                <strong>{reserva.restaurante}</strong>
                <span>
                  {new Date(`${reserva.fecha}T12:00:00`).toLocaleDateString(
                    "es-CO",
                    { weekday: "short", day: "numeric", month: "short" },
                  )}{" "}
                  · {reserva.hora}
                </span>
                <small>
                  {reserva.personas}{" "}
                  {reserva.personas === 1 ? "comensal" : "comensales"} ·{" "}
                  {reserva.correo}
                </small>
                {reserva.estado === "Cancelada" ? (
                  <em className="pendiente">Cancelada</em>
                ) : (
                  <button
                    className="boton-texto boton-cancelar-reserva"
                    type="button"
                    disabled={cargando || !reserva.id}
                    onClick={() => cancelarReserva(reserva)}
                  >
                    Cancelar
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

type Modal = "acceso" | "reserva" | null;
interface FormularioReserva {
  fecha: string;
  hora: string;
  personas: string;
}
interface FormularioRestaurante {
  nombre: string;
  direccion: string;
  comida: string;
  certificado: File | null;
}
interface ReservaPerfil extends DatosReserva {
  id?: string;
  estado?: string;
  restauranteId?: string;
  turnoId?: string;
}
type VistaPagina =
  | "inicio"
  | "detalle-restaurante"
  | "panel-admin"
  | "perfil-usuario"
  | "perfil-restaurante";
const correoAdministrador =
  import.meta.env.VITE_ADMIN_EMAIL?.trim().toLowerCase() ?? "";
const reservaInicial: FormularioReserva = {
  fecha: "",
  hora: "",
  personas: "2",
};
const restauranteInicial: FormularioRestaurante = {
  nombre: "",
  direccion: "",
  comida: "",
  certificado: null,
};
function subirArchivoConLimite(
  referencia: StorageReference,
  archivo: File,
  informarProgreso?: (porcentaje: number) => void,
): Promise<UploadTaskSnapshot> {
  const tarea = uploadBytesResumable(referencia, archivo);
  return new Promise((resolver, rechazar) => {
    const tiempoLimite = window.setTimeout(() => {
      tarea.cancel();
      rechazar(new Error("La carga superó el tiempo límite de 30 segundos."));
    }, 30_000);
    tarea.on(
      "state_changed",
      (snapshot) => {
        informarProgreso?.(
          Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        );
      },
      (error) => {
        window.clearTimeout(tiempoLimite);
        rechazar(error);
      },
      () => {
        window.clearTimeout(tiempoLimite);
        resolver(tarea.snapshot);
      },
    );
  });
}
async function eliminarArchivosDeCarpeta(referencia: StorageReference): Promise<void> {
  const contenido = await listAll(referencia);
  await Promise.all([
    ...contenido.items.map((archivo) => deleteObject(archivo)),
    ...contenido.prefixes.map((carpeta) => eliminarArchivosDeCarpeta(carpeta)),
  ]);
}
function esperarConLimite<T>(
  operacion: Promise<T>,
  mensaje: string,
  limiteMs = 20_000,
): Promise<T> {
  let temporizador = 0;
  return Promise.race([
    operacion,
    new Promise<T>((_, rechazar) => {
      temporizador = window.setTimeout(
        () => rechazar(new Error(mensaje)),
        limiteMs,
      );
    }),
  ]).finally(() => window.clearTimeout(temporizador));
}
async function crearFotoLocal(archivo: File): Promise<string> {
  const imagen = await createImageBitmap(archivo);
  const escala = Math.min(1, 1024 / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.max(1, Math.round(imagen.width * escala));
  lienzo.height = Math.max(1, Math.round(imagen.height * escala));
  const contexto = lienzo.getContext("2d");
  if (!contexto) throw new Error("No se pudo procesar la foto.");
  contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  imagen.close();
  return lienzo.toDataURL("image/webp", 0.72);
}
async function enviarSolicitudPorCorreo(
  datos: FormularioRestaurante,
  propietario: User,
): Promise<void> {
  const archivo = datos.certificado;
  if (!archivo) throw new Error("Adjunta el certificado del restaurante.");
  const endpoint =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? "http://localhost:3001" : "");
  if (!endpoint) throw new Error("El servicio de correo no está configurado.");

  const archivoBase64 = await new Promise<string>((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => {
      const resultado = lector.result;
      if (typeof resultado !== "string") {
        rechazar(new Error("No se pudo leer el certificado."));
        return;
      }
      resolver(resultado.slice(resultado.indexOf(",") + 1));
    };
    lector.onerror = () => rechazar(new Error("No se pudo leer el certificado."));
    lector.readAsDataURL(archivo);
  });
  const controlador = new AbortController();
  const temporizador = window.setTimeout(() => controlador.abort(), 30_000);
  try {
    const respuesta = await fetch(`${endpoint}/solicitudes/restaurante`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controlador.signal,
      body: JSON.stringify({
        nombre: datos.nombre.trim(),
        direccion: datos.direccion.trim(),
        comida: datos.comida.trim(),
        correoPropietario: propietario.email ?? "",
        certificado: {
          nombre: archivo.name,
          tipo: archivo.type || "application/octet-stream",
          contenido: archivoBase64,
        },
      }),
    });
    const resultado = (await respuesta.json()) as { mensaje?: string };
    if (!respuesta.ok) {
      throw new Error(
        resultado.mensaje || "El servidor de correo rechazó la solicitud.",
      );
    }
  } finally {
    window.clearTimeout(temporizador);
  }
}
function mensajeErrorAcceso(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return "No pudimos completar el acceso. Inténtalo de nuevo.";
  }

  switch (error.code) {
    case "auth/email-already-in-use":
      return "Ya existe una cuenta con ese correo. Inicia sesión o usa otro correo.";
    case "auth/invalid-email":
      return "El correo electrónico no tiene un formato válido.";
    case "auth/user-not-found":
      return "No encontramos una cuenta con ese correo. Verifica la dirección e inténtalo de nuevo.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "La contraseña actual no es correcta.";
    case "auth/requires-recent-login":
      return "Por seguridad, vuelve a iniciar sesión antes de realizar esta acción.";
    case "auth/weak-password":
      return "La contraseña debe tener al menos 6 caracteres.";
    case "auth/operation-not-allowed":
      return "Este método de acceso está desactivado. Actívalo en Firebase Authentication.";
    case "auth/popup-closed-by-user":
      return "Cerraste la ventana de Google antes de completar el acceso.";
    case "auth/popup-blocked":
      return "El navegador bloqueó la ventana de Google. Permite las ventanas emergentes e inténtalo de nuevo.";
    case "auth/cancelled-popup-request":
      return "Ya hay una ventana de acceso abierta. Complétala antes de volver a intentarlo.";
    case "auth/unauthorized-domain":
      return "Este dominio no está autorizado para iniciar sesión. Añádelo a los dominios autorizados en Firebase Authentication.";
    case "auth/account-exists-with-different-credential":
      return "Ya existe una cuenta con este correo. Inicia sesión con el método que usaste al registrarte.";
    case "auth/network-request-failed":
      return "No pudimos conectar con Firebase. Revisa tu conexión e inténtalo de nuevo.";
    case "auth/too-many-requests":
      return "Se hicieron demasiados intentos. Espera un momento antes de volver a intentarlo.";
    default:
      if (
        error.code === "auth/invalid-api-key" ||
        error.code.includes("api-key-not-valid")
      ) {
        return "La clave de Firebase no es válida o está restringida. Verifica VITE_FIREBASE_API_KEY en .env.local y que la clave permita Identity Toolkit.";
      }
      return "No pudimos completar el acceso. Revisa los datos e inténtalo de nuevo.";
  }
}
interface PerfilGuardado {
  tipo?: TipoCuenta;
  telefono?: string;
  foto?: string;
  fotoRestaurante?: string;
  nombre?: string;
  apellido?: string;
  tratamiento?: string;
  fechaNacimiento?: string;
}
function leerPerfilGuardado(uid?: string): PerfilGuardado {
  if (!uid) return {};
  try {
    const guardado = localStorage.getItem(`silla-libre-perfil-${uid}`);
    return guardado
      ? (JSON.parse(guardado) as {
        tipo?: TipoCuenta;
        telefono?: string;
        foto?: string;
        fotoRestaurante?: string;
        nombre?: string;
        apellido?: string;
        tratamiento?: string;
        fechaNacimiento?: string;
      })
      : {};
  } catch {
    return {};
  }
}
function leerFavoritosGuardados(uid?: string): Array<number | string> {
  try {
    const clave = uid ? `silla-libre-favoritos-${uid}` : "silla-libre-favoritos";
    const guardados = localStorage.getItem(clave);
    if (!guardados) return [];
    const datos: unknown = JSON.parse(guardados);
    return Array.isArray(datos)
      ? [...new Set(
          datos.filter(
            (id): id is number | string =>
              (typeof id === "number" && Number.isInteger(id)) ||
              (typeof id === "string" && id.length > 0),
          ),
        )]
      : [];
  } catch {
    return [];
  }
}
function separarNombreCompleto(nombre: string): { nombre: string; apellido: string } {
  const partes = nombre.trim().split(/\s+/);
  return {
    nombre: partes.shift() ?? "",
    apellido: partes.join(" "),
  };
}
function leerReservasGuardadas(uid: string | null, correo?: string): ReservaPerfil[] {
  const guardado =
    (uid ? localStorage.getItem(`silla-libre-reservas-${uid}`) : null) ??
    localStorage.getItem("silla-libre-reservas");
  if (!guardado) return [];
  try {
    const datos: unknown = JSON.parse(guardado);
    if (!Array.isArray(datos)) return [];
    return datos.filter(
      (reserva): reserva is ReservaPerfil =>
        Boolean(
          reserva &&
            typeof reserva === "object" &&
            typeof reserva.restaurante === "string" &&
            typeof reserva.fecha === "string" &&
            typeof reserva.hora === "string" &&
            typeof reserva.personas === "number" &&
            (!correo || reserva.correo === correo),
        ),
    );
  } catch {
    return [];
  }
}
function combinarReservas(
  ...grupos: ReservaPerfil[][]
): ReservaPerfil[] {
  const porClave = new Map<string, ReservaPerfil>();
  for (const grupo of grupos) {
    for (const reserva of grupo) {
      const clave =
        reserva.id ??
        `${reserva.restaurante}|${reserva.fecha}|${reserva.hora}|${reserva.correo}`;
      porClave.set(clave, { ...porClave.get(clave), ...reserva });
    }
  }
  return [...porClave.values()].sort(
    (a, b) =>
      new Date(`${b.fecha}T${b.hora}`).getTime() -
      new Date(`${a.fecha}T${a.hora}`).getTime(),
  );
}
function normalizarReserva(
  id: string,
  datos: Record<string, unknown>,
): ReservaPerfil | null {
  if (
    typeof datos.restaurante !== "string" ||
    typeof datos.fecha !== "string" ||
    typeof datos.hora !== "string" ||
    typeof datos.personas !== "number" ||
    typeof datos.correo !== "string"
  ) {
    return null;
  }
  return {
    id,
    restaurante: datos.restaurante,
    fecha: datos.fecha,
    hora: datos.hora,
    personas: datos.personas,
    correo: datos.correo,
    estado: typeof datos.estado === "string" ? datos.estado : "Confirmada",
    restauranteId:
      typeof datos.restauranteId === "string" ? datos.restauranteId : undefined,
    turnoId: typeof datos.turnoId === "string" ? datos.turnoId : undefined,
  };
}
function leerVistaPagina(): VistaPagina {
  if (window.location.pathname === "/admin") return "panel-admin";
  if (window.location.pathname === "/perfil/restaurante") {
    return "perfil-restaurante";
  }
  if (window.location.pathname === "/perfil/usuario") return "perfil-usuario";
  if (leerRestauranteDetalleRuta()) return "detalle-restaurante";
  return "inicio";
}
function leerRestauranteDetalleRuta(): Restaurante | null {
  const coincidencia = window.location.pathname.match(/^\/restaurante\/([^/]+)\/?$/);
  if (!coincidencia) return null;
  let id: string;
  try {
    id = decodeURIComponent(coincidencia[1]);
  } catch {
    return null;
  }
  return [...restaurantes].find((restaurante) => String(restaurante.id) === id) ?? null;
}
function normalizarRestaurante(
  id: string,
  datos: Record<string, unknown>,
): RestaurantePropietario {
  const menu = Array.isArray(datos.menu)
    ? datos.menu.flatMap((elemento, indice) => {
        if (!elemento || typeof elemento !== "object") return [];
        const plato = elemento as Record<string, unknown>;
        return [{
          id: typeof plato.id === "string" ? plato.id : `${id}-${indice}`,
          nombre: typeof plato.nombre === "string" ? plato.nombre : "",
          descripcion: typeof plato.descripcion === "string" ? plato.descripcion : "",
          precio: typeof plato.precio === "string" ? plato.precio : "",
        }];
      })
    : [];
  return {
    id,
    nombre: typeof datos.nombre === "string" ? datos.nombre : "",
    direccion: typeof datos.direccion === "string" ? datos.direccion : "",
    comida: typeof datos.comida === "string" ? datos.comida : "",
    certificado: typeof datos.certificado === "string" ? datos.certificado : "",
    menu,
    menuPdfUrl: typeof datos.menuPdfUrl === "string" ? datos.menuPdfUrl : "",
    menuPdfNombre:
      typeof datos.menuPdfNombre === "string" ? datos.menuPdfNombre : "",
    mesasPorTurno:
      typeof datos.mesasPorTurno === "number" &&
      Number.isInteger(datos.mesasPorTurno) &&
      datos.mesasPorTurno >= 0
        ? datos.mesasPorTurno
        : 10,
    diasNoDisponibles: Array.isArray(datos.diasNoDisponibles)
      ? datos.diasNoDisponibles.filter(
          (dia): dia is number =>
            typeof dia === "number" && Number.isInteger(dia) && dia >= 0 && dia <= 6,
        )
      : [],
    fechasNoDisponibles: Array.isArray(datos.fechasNoDisponibles)
      ? datos.fechasNoDisponibles.filter(
          (fecha): fecha is string => typeof fecha === "string",
        )
      : [],
  };
}
function normalizarRestaurantePublico(
  id: string,
  datos: Record<string, unknown>,
): RestauranteReservable | null {
  if (
    typeof datos.nombre !== "string" ||
    typeof datos.comida !== "string" ||
    typeof datos.propietario !== "string"
  ) {
    return null;
  }
  const propietario = datos.propietario;
  const negocio = normalizarRestaurante(id, datos);
  return {
    id,
    nombre: negocio.nombre,
    categoria: negocio.comida,
    locacion: negocio.direccion,
    rangoprecios: "$$",
    rating: 0,
    imagen: "/logo.png",
    descripcion: `${negocio.comida} · ${negocio.direccion}`,
    urlreserva: "",
    propietario,
    mesasPorTurno: negocio.mesasPorTurno,
    diasNoDisponibles: negocio.diasNoDisponibles,
    fechasNoDisponibles: negocio.fechasNoDisponibles,
  };
}
function leerRestaurantesLocales(uid: string): RestaurantePropietario[] {
  const guardado = localStorage.getItem(`silla-libre-restaurantes-${uid}`);
  if (!guardado) return [];
  try {
    const datos: unknown = JSON.parse(guardado);
    if (!Array.isArray(datos)) return [];
    return datos.flatMap((restaurante) => {
      if (!restaurante || typeof restaurante !== "object") return [];
      const dato = restaurante as Record<string, unknown>;
      return [normalizarRestaurante(
        typeof dato.id === "string" ? dato.id : crypto.randomUUID(),
        dato,
      )];
    });
  } catch {
    return [];
  }
}

function esCuentaRestaurante(uid: string): boolean {
  return (
    leerPerfilGuardado(uid).tipo === "restaurante" ||
    leerRestaurantesLocales(uid).length > 0
  );
}

function PanelAdministrador({
  restaurantes,
  cargando,
}: {
  restaurantes: RestauranteReservable[];
  cargando: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const restaurantesFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase();
    if (!termino) return restaurantes;
    return restaurantes.filter((restaurante) =>
      [restaurante.nombre, restaurante.categoria, restaurante.locacion]
        .join(" ")
        .toLocaleLowerCase()
        .includes(termino),
    );
  }, [busqueda, restaurantes]);
  const categorias = new Set(
    restaurantes.map((restaurante) => restaurante.categoria),
  );

  return (
    <>
      <div className="admin-estadisticas">
        <article>
          <span>Restaurantes publicados</span>
          <strong>{restaurantes.length}</strong>
        </article>
        <article>
          <span>Categorías</span>
          <strong>{categorias.size}</strong>
        </article>
        <article>
          <span>Estado de la plataforma</span>
          <strong className="admin-estado">
            <i /> En línea
          </strong>
        </article>
      </div>
      <section className="admin-listado">
        <div className="admin-listado-encabezado">
          <div>
            <h3>Restaurantes</h3>
            <p>Negocios visibles en el directorio público.</p>
          </div>
          <label>
            <span className="sr-only">Buscar restaurantes</span>
            <input
              type="search"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Buscar por nombre, tipo o ubicación"
            />
          </label>
        </div>
        {cargando ? (
          <p className="aviso">Cargando restaurantes...</p>
        ) : restaurantesFiltrados.length === 0 ? (
          <p className="aviso">
            {restaurantes.length === 0
              ? "Todavía no hay restaurantes publicados."
              : "No hay restaurantes que coincidan con la búsqueda."}
          </p>
        ) : (
          <div className="admin-tabla-contenedor">
            <table className="admin-tabla">
              <thead>
                <tr>
                  <th>Restaurante</th>
                  <th>Categoría</th>
                  <th>Ubicación</th>
                  <th>Mesas por turno</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {restaurantesFiltrados.map((restaurante) => (
                  <tr key={restaurante.id}>
                    <td>{restaurante.nombre}</td>
                    <td>{restaurante.categoria}</td>
                    <td>{restaurante.locacion || "Sin ubicación"}</td>
                    <td>{restaurante.mesasPorTurno}</td>
                    <td>
                      <span className="admin-publicado">Publicado</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function App() {
  const [pestaña, setPestaña] = useState<Pestaña>("inicio");
  const [vista, setVista] = useState<VistaPagina>(leerVistaPagina);
  const [restauranteDetalle, setRestauranteDetalle] =
    useState<Restaurante | null>(leerRestauranteDetalleRuta);
  const [modal, setModal] = useState<Modal>(null);
  const [tipoCuenta, setTipoCuenta] = useState<TipoCuenta>("usuario");
  const [esRegistro, setEsRegistro] = useState(false);
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [apellidoUsuario, setApellidoUsuario] = useState("");
  const [tratamientoUsuario, setTratamientoUsuario] = useState("ninguno");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [correo, setCorreo] = useState("");
  const [contraseña, setContraseña] = useState("");
  const [usuario, setUsuario] = useState<User | null>(null);
  const [autenticacionCargando, setAutenticacionCargando] = useState(
    Boolean(autenticacion),
  );
  const [tipoUsuario, setTipoUsuario] = useState<TipoCuenta>("usuario");
  const [telefono, setTelefono] = useState("");
  const [fotoPerfil, setFotoPerfil] = useState("");
  const [fotoPerfilPrevia, setFotoPerfilPrevia] = useState("");
  const [archivoFotoPerfil, setArchivoFotoPerfil] = useState<File | null>(null);
  const [perfilCargando, setPerfilCargando] = useState(Boolean(autenticacion));
  const [reservasPerfil, setReservasPerfil] = useState<ReservaPerfil[]>([]);
  const [reservasCargando, setReservasCargando] = useState(false);
  const [restaurantesPropietario, setRestaurantesPropietario] = useState<
    RestaurantePropietario[]
  >([]);
  const [progresoMenu, setProgresoMenu] = useState<Record<string, number>>({});
  const [reserva, setReserva] = useState<FormularioReserva>(reservaInicial);
  const [restauranteActivo, setRestauranteActivo] = useState(restaurantes[0]);
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [favoritos, setFavoritos] = useState<Array<number | string>>([]);
  const [restaurantesPublicos, setRestaurantesPublicos] = useState<
    RestauranteReservable[]
  >([]);
  const [restaurantesPublicosCargando, setRestaurantesPublicosCargando] =
    useState(true);
  const [disponibilidadActiva, setDisponibilidadActiva] =
    useState<RestauranteReservable | null>(null);
  const [mesasOcupadasTurno, setMesasOcupadasTurno] = useState(0);
  const [turnoSuscritoId, setTurnoSuscritoId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [confirmandoEliminacion, setConfirmandoEliminacion] = useState(false);
  const [contraseñaEliminacion, setContraseñaEliminacion] = useState("");
  const [formularioRestaurante, setFormularioRestaurante] =
    useState(restauranteInicial);
  const restaurantesVisibles = useMemo(
    () => [...restaurantes, ...restaurantesPublicos],
    [restaurantesPublicos],
  );

  useEffect(() => {
    const sincronizarRuta = () => {
      setRestauranteDetalle(leerRestauranteDetalleRuta());
      setVista(leerVistaPagina());
    };
    window.addEventListener("popstate", sincronizarRuta);
    if (!autenticacion) {
      return () => window.removeEventListener("popstate", sincronizarRuta);
    }
    const cancelarAutenticacion = onAuthStateChanged(
      autenticacion,
      (usuarioAutenticado) => {
        setUsuario(usuarioAutenticado);
        setFavoritos(
          usuarioAutenticado
            ? leerFavoritosGuardados(usuarioAutenticado.uid)
            : leerFavoritosGuardados(),
        );
        setAutenticacionCargando(false);
        setPerfilCargando(Boolean(usuarioAutenticado));
        const perfil = leerPerfilGuardado(usuarioAutenticado?.uid);
        const tipoLocal: TipoCuenta =
          window.location.pathname === "/perfil/restaurante" ||
          perfil.tipo === "restaurante" ||
          (usuarioAutenticado && esCuentaRestaurante(usuarioAutenticado.uid))
            ? "restaurante"
            : "usuario";
        const nombreGuardado = perfil.nombre ?? "";
        const partesNombre = separarNombreCompleto(
          nombreGuardado || usuarioAutenticado?.displayName || "",
        );
        setNombreUsuario(nombreGuardado || partesNombre.nombre);
        setApellidoUsuario(perfil.apellido ?? partesNombre.apellido);
        setTratamientoUsuario(perfil.tratamiento ?? "ninguno");
        setFechaNacimiento(perfil.fechaNacimiento ?? "");
        setTelefono(perfil.telefono ?? "");
        setFotoPerfil(
          perfil.fotoRestaurante ??
            perfil.foto ??
            usuarioAutenticado?.photoURL ??
            "",
        );
        setFotoPerfilPrevia("");
        setArchivoFotoPerfil(null);
        setTipoUsuario(tipoLocal);
        if (
          usuarioAutenticado &&
          (window.location.pathname === "/perfil/restaurante" ||
            window.location.pathname === "/perfil/usuario")
        ) {
          const rutaPerfil =
            window.location.pathname === "/perfil/restaurante" ||
            tipoLocal === "restaurante"
              ? "/perfil/restaurante"
              : "/perfil/usuario";
          window.history.replaceState({}, "", rutaPerfil);
          setVista(
            rutaPerfil === "/perfil/restaurante"
              ? "perfil-restaurante"
              : "perfil-usuario",
          );
        }
        setRestaurantesPropietario([]);
        setReservasPerfil([]);
      },
    );
    return () => {
      window.removeEventListener("popstate", sincronizarRuta);
      cancelarAutenticacion();
    };
  }, []);
  useEffect(() => {
    if (!baseDatos) return;
    const cancelar = onSnapshot(
      collection(baseDatos, "restaurantesPublicos"),
      (resultado) => {
        const cargados = resultado.docs.flatMap((documento) => {
          const restaurante = normalizarRestaurantePublico(
            documento.id,
            documento.data(),
          );
          return restaurante ? [restaurante] : [];
        });
        setRestaurantesPublicos(cargados);
        setRestaurantesPublicosCargando(false);
        setRestaurantesPropietario((actuales) =>
          actuales.map((restaurante) => {
            const publico = cargados.find((elemento) => elemento.id === restaurante.id);
            return publico
              ? {
                  ...restaurante,
                  mesasPorTurno: publico.mesasPorTurno,
                  diasNoDisponibles: publico.diasNoDisponibles,
                  fechasNoDisponibles: publico.fechasNoDisponibles,
                }
              : restaurante;
          }),
        );
        const coincidencia = window.location.pathname.match(
          /^\/restaurante\/([^/]+)\/?$/,
        );
        if (coincidencia) {
          let idRuta = "";
          try {
            idRuta = decodeURIComponent(coincidencia[1]);
          } catch {
            return;
          }
          const restauranteRuta = cargados.find(
            (restaurante) => restaurante.id === idRuta,
          );
          if (restauranteRuta) {
            setRestauranteDetalle(restauranteRuta);
            setVista("detalle-restaurante");
          }
        }
      },
      () => {
        setRestaurantesPublicosCargando(false);
        setMensaje(
          "No pudimos cargar la lista de restaurantes administrados. Revisa las reglas de lectura pública de Firebase.",
        );
      },
    );
    return cancelar;
  }, []);
  useEffect(() => {
    if (!usuario) return;
    let vigente = true;
    const cargarPerfil = async () => {
      setReservasCargando(true);
      if (baseDatos) {
        const db = baseDatos;
        const [perfil, negocios, reservasUsuario] = await Promise.all([
          getDoc(doc(db, "perfiles", usuario.uid)),
          getDocs(
            query(
              collection(db, "restaurantes"),
              where("propietario", "==", usuario.uid),
            ),
          ),
          getDocs(
            query(
              collection(db, "reservas"),
              where("usuario", "==", usuario.uid),
            ),
          ),
        ]);
        if (!vigente) return;
        const datosPerfil = perfil.exists() ? perfil.data() : undefined;
        const perfilLocal = leerPerfilGuardado(usuario.uid);
        const negociosLocales = leerRestaurantesLocales(usuario.uid);
        const favoritosRemotos = Array.isArray(datosPerfil?.favoritos)
          ? datosPerfil.favoritos.filter(
              (id: unknown): id is number | string =>
                (typeof id === "number" && Number.isInteger(id)) ||
                (typeof id === "string" && id.length > 0),
            )
          : null;
        const favoritosLocales = leerFavoritosGuardados(usuario.uid);
        const favoritosAnonimos = leerFavoritosGuardados();
        const favoritosActuales = [
          ...new Set(favoritosRemotos ?? [...favoritosLocales, ...favoritosAnonimos]),
        ];
        setFavoritos(favoritosActuales);
        localStorage.setItem(
          `silla-libre-favoritos-${usuario.uid}`,
          JSON.stringify(favoritosActuales),
        );
        localStorage.removeItem("silla-libre-favoritos");
        if (
          baseDatos &&
          (favoritosRemotos === null ||
            favoritosAnonimos.some((id) => !favoritosRemotos.includes(id)))
        ) {
          void setDoc(
            doc(baseDatos, "perfiles", usuario.uid),
            { favoritos: favoritosActuales },
            { merge: true },
          ).catch(() => {
            if (vigente) {
              setMensaje(
                "Tus favoritos se conservaron en este dispositivo, pero no pudieron sincronizarse con Firebase.",
              );
            }
          });
        }
        const tipoPerfil: TipoCuenta =
          window.location.pathname === "/perfil/restaurante" ||
            negocios.size > 0 ||
            negociosLocales.length > 0 ||
            perfilLocal.tipo === "restaurante"
            ? "restaurante"
            : datosPerfil?.tipo === "restaurante" ||
                datosPerfil?.tipo === "usuario"
              ? datosPerfil.tipo
              : leerPerfilGuardado(usuario.uid).tipo === "restaurante"
                ? "restaurante"
                : "usuario";
        setTipoUsuario(tipoPerfil);
        if (
          window.location.pathname === "/perfil/restaurante" ||
          window.location.pathname === "/perfil/usuario"
        ) {
          const rutaPerfil =
            window.location.pathname === "/perfil/restaurante" ||
            tipoPerfil === "restaurante"
              ? "/perfil/restaurante"
              : "/perfil/usuario";
          window.history.replaceState({}, "", rutaPerfil);
          setVista(
            rutaPerfil === "/perfil/restaurante"
              ? "perfil-restaurante"
              : "perfil-usuario",
          );
        }
        const reservasRestaurantes = await Promise.all(
          negocios.docs.map((negocio) =>
            getDocs(
              query(
                collection(db, "reservas"),
                where("restaurante", "==", negocio.data().nombre),
              ),
            ),
          ),
        );
        if (!vigente) return;
        if (datosPerfil) {
          const datos = datosPerfil;
          if (typeof datos.nombre === "string") {
            const partes = separarNombreCompleto(datos.nombre);
            setNombreUsuario(
              typeof datos.nombrePila === "string"
                ? datos.nombrePila
                : partes.nombre,
            );
            setApellidoUsuario(
              typeof datos.apellido === "string"
                ? datos.apellido
                : partes.apellido,
            );
          }
          if (typeof datos.telefono === "string") setTelefono(datos.telefono);
          if (typeof datos.fotoRestaurante === "string") {
            setFotoPerfil(datos.fotoRestaurante);
          } else if (typeof datos.foto === "string") {
            setFotoPerfil(datos.foto);
          }
          if (typeof datos.tratamiento === "string") {
            setTratamientoUsuario(datos.tratamiento);
          }
          if (typeof datos.fechaNacimiento === "string") {
            setFechaNacimiento(datos.fechaNacimiento);
          }
        }
        const restaurantesRemotos = negocios.docs.map((negocio) =>
          normalizarRestaurante(negocio.id, negocio.data()),
        );
        if (restaurantesRemotos.length > 0) {
          const db = baseDatos;
          const lotePublico = writeBatch(db);
          restaurantesRemotos.forEach((restaurante) => {
            lotePublico.set(
              doc(db, "restaurantesPublicos", restaurante.id),
              {
                nombre: restaurante.nombre,
                direccion: restaurante.direccion,
                comida: restaurante.comida,
                propietario: usuario.uid,
                mesasPorTurno: restaurante.mesasPorTurno,
                diasNoDisponibles: restaurante.diasNoDisponibles,
                fechasNoDisponibles: restaurante.fechasNoDisponibles,
              },
            );
          });
          await lotePublico.commit();
        }
        const restaurantesPorId = new Map(
          negociosLocales.map((restaurante) => [restaurante.id, restaurante]),
        );
        restaurantesRemotos.forEach((restaurante) =>
          restaurantesPorId.set(restaurante.id, restaurante),
        );
        setRestaurantesPropietario([...restaurantesPorId.values()]);
        const reservasRemotas = [
          ...new Map(
            [...reservasUsuario.docs, ...reservasRestaurantes.flatMap((grupo) => grupo.docs)]
              .map((reserva) => [reserva.id, reserva] as const),
          ).values(),
        ].flatMap((reserva) => {
            const datos = normalizarReserva(reserva.id, reserva.data());
            return datos ? [datos] : [];
        });
        setReservasPerfil(
          combinarReservas(
            reservasRemotas,
            leerReservasGuardadas(usuario.uid),
          ),
        );
      } else {
        const restaurantesLocales = leerRestaurantesLocales(usuario.uid);
        const tipoLocal: TipoCuenta =
          restaurantesLocales.length > 0 ||
          leerPerfilGuardado(usuario.uid).tipo === "restaurante"
            ? "restaurante"
            : "usuario";
        setTipoUsuario(tipoLocal);
        if (
          window.location.pathname === "/perfil/restaurante" ||
          window.location.pathname === "/perfil/usuario"
        ) {
          const rutaPerfil =
            window.location.pathname === "/perfil/restaurante" ||
            tipoLocal === "restaurante"
              ? "/perfil/restaurante"
              : "/perfil/usuario";
          window.history.replaceState({}, "", rutaPerfil);
          setVista(
            rutaPerfil === "/perfil/restaurante"
              ? "perfil-restaurante"
              : "perfil-usuario",
          );
        }
        setRestaurantesPropietario(restaurantesLocales);
        const nombresRestaurantes = new Set(
          restaurantesLocales.map((restaurante) => restaurante.nombre),
        );
        setReservasPerfil(
          tipoLocal === "restaurante"
            ? leerReservasGuardadas(usuario.uid).filter((reserva) =>
                nombresRestaurantes.has(reserva.restaurante),
              )
            : leerReservasGuardadas(usuario.uid),
        );
      }
      if (vigente) setReservasCargando(false);
      if (vigente) setPerfilCargando(false);
    };
    void cargarPerfil().catch(() => {
      if (vigente) {
        setReservasCargando(false);
        setPerfilCargando(false);
        setMensaje(
          "No pudimos cargar los datos del perfil. Revisa la conexión e inténtalo de nuevo.",
        );
      }
    });
    return () => {
      vigente = false;
    };
  }, [usuario]);
  useEffect(() => {
    if (modal !== "reserva" || !baseDatos) {
      return;
    }
    const restaurantId = String(restauranteActivo.id);
    const negocio = restaurantesPublicos.find(
      (restaurante) => restaurante.id === restaurantId,
    );
    if (!negocio) {
      return;
    }
    const cancelar = onSnapshot(
      doc(baseDatos, "restaurantesPublicos", restaurantId),
      (resultado) => {
        if (!resultado.exists()) {
          setDisponibilidadActiva(null);
          return;
        }
        setDisponibilidadActiva(
          normalizarRestaurantePublico(resultado.id, resultado.data()),
        );
      },
      () => {
        setMensaje(
          "No pudimos consultar la disponibilidad en tiempo real. Inténtalo de nuevo.",
        );
      },
    );
    return cancelar;
  }, [modal, restauranteActivo.id, restaurantesPublicos]);
  const turnoSeleccionadoId =
    disponibilidadActiva && reserva.fecha && reserva.hora
      ? `${disponibilidadActiva.id}_${reserva.fecha}_${reserva.hora.slice(0, 2)}`
      : null;
  useEffect(() => {
    if (!baseDatos || !turnoSeleccionadoId || modal !== "reserva") {
      return;
    }
    return onSnapshot(
      doc(baseDatos, "ocupacionTurnos", turnoSeleccionadoId),
      (resultado) => {
        const ocupadas = resultado.data()?.mesasOcupadas;
        setMesasOcupadasTurno(
          typeof ocupadas === "number" && Number.isInteger(ocupadas)
            ? ocupadas
            : 0,
        );
        setTurnoSuscritoId(turnoSeleccionadoId);
      },
      () => {
        setMensaje(
          "No pudimos actualizar las mesas disponibles en tiempo real.",
        );
      },
    );
  }, [modal, turnoSeleccionadoId]);
  const categoriasDisponibles = useMemo(
    () => [...new Set(restaurantesVisibles.map((restaurante) => restaurante.categoria))],
    [restaurantesVisibles],
  );
  const restaurantesFiltrados = useMemo(
    () =>
      restaurantesVisibles.filter((restaurante) => {
        const texto = busqueda.toLowerCase().trim();
        const coincideTexto =
          restaurante.nombre.toLowerCase().includes(texto) ||
          restaurante.categoria.toLowerCase().includes(texto);
        return (
          coincideTexto &&
          (categoria === "Todas" || restaurante.categoria === categoria)
        );
      }),
    [busqueda, categoria, restaurantesVisibles],
  );
  const mostrarAcceso = (registro = false, cuenta: TipoCuenta = "usuario") => {
    setEsRegistro(registro);
    setTipoCuenta(cuenta);
    setMensaje("");
    setModal("acceso");
  };
  const irAInicio = () => {
    window.history.pushState({}, "", "/");
    setVista("inicio");
    setRestauranteDetalle(null);
    setPestaña("inicio");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const abrirPanelAdmin = () => {
    window.history.pushState({}, "", "/admin");
    setVista("panel-admin");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const usuarioEsAdministrador = Boolean(
    usuario?.emailVerified &&
      correoAdministrador &&
      usuario.email?.trim().toLowerCase() === correoAdministrador,
  );
  const verificarCorreoAdministrador = async () => {
    if (!usuario || !autenticacion) return;
    setCargando(true);
    setMensaje("");
    try {
      await reload(usuario);
      const usuarioActualizado = autenticacion.currentUser;
      setUsuario(usuarioActualizado);
      if (usuarioActualizado?.emailVerified) {
        setMensaje("Correo verificado. El panel ya está disponible.");
      } else {
        await sendEmailVerification(usuario);
        setMensaje("Enviamos un enlace de verificación a tu correo.");
      }
    } catch (error) {
      setMensaje(mensajeErrorAcceso(error));
    } finally {
      setCargando(false);
    }
  };
  const abrirDetalleRestaurante = (restaurante: Restaurante) => {
    window.history.pushState(
      {},
      "",
      `/restaurante/${encodeURIComponent(String(restaurante.id))}`,
    );
    setRestauranteDetalle(restaurante);
    setVista("detalle-restaurante");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const volverAListaRestaurantes = () => {
    window.history.pushState({}, "", "/");
    setVista("inicio");
    setRestauranteDetalle(null);
    setPestaña("restaurantes");
    window.requestAnimationFrame(() =>
      document.getElementById("restaurantes")?.scrollIntoView({ behavior: "smooth" }),
    );
  };
  const irAlPerfil = () => {
    if (!usuario) {
      mostrarAcceso();
      return;
    }
    const esRestaurante =
      tipoUsuario === "restaurante" || esCuentaRestaurante(usuario.uid);
    const destino =
      esRestaurante
        ? "/perfil/restaurante"
        : "/perfil/usuario";
    window.history.pushState({}, "", destino);
    setVista(esRestaurante ? "perfil-restaurante" : "perfil-usuario");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const abrirPerfilRestaurante = async () => {
    if (!usuario) {
      mostrarAcceso();
      return;
    }
    setTipoUsuario("restaurante");
    setVista("perfil-restaurante");
    window.history.pushState({}, "", "/perfil/restaurante");
    const perfilActual = leerPerfilGuardado(usuario.uid);
    try {
      localStorage.setItem(
        `silla-libre-perfil-${usuario.uid}`,
        JSON.stringify({ ...perfilActual, tipo: "restaurante" }),
      );
      if (baseDatos) {
        await setDoc(
          doc(baseDatos, "perfiles", usuario.uid),
          { tipo: "restaurante" },
          { merge: true },
        );
      }
    } catch {
      setMensaje(
        "Abrimos el panel de restaurante, pero no pudimos guardar el tipo de cuenta. Revisa la conexión e inténtalo de nuevo.",
      );
    }
  };
  const navegar = (destino: Pestaña) => {
    if (destino === "perfil") {
      irAlPerfil();
      return;
    }
    setPestaña(destino);
    document.getElementById(destino)?.scrollIntoView({ behavior: "smooth" });
  };
  const cerrarSesion = async () => {
    if (autenticacion) await signOut(autenticacion);
    irAInicio();
  };
  const recuperarContraseña = async () => {
    const correoRecuperacion = correo.trim();
    if (!correoRecuperacion) {
      setMensaje("Escribe tu correo electrónico para enviarte el enlace de recuperación.");
      return;
    }
    if (!autenticacion) {
      setMensaje(
        "Modo demostración activo. Añade las variables de Firebase para recuperar tu contraseña.",
      );
      return;
    }
    setCargando(true);
    setMensaje("");
    try {
      await sendPasswordResetEmail(autenticacion, correoRecuperacion);
      setMensaje(
        "Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña.",
      );
    } catch (error) {
      setMensaje(
        error instanceof FirebaseError && error.code === "auth/user-not-found"
          ? "Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña."
          : mensajeErrorAcceso(error),
      );
    } finally {
      setCargando(false);
    }
  };
  const eliminarCuenta = async () => {
    if (
      !usuario ||
      !autenticacion ||
      (tipoUsuario !== "usuario" && tipoUsuario !== "restaurante")
    ) {
      setMensaje("No pudimos verificar la cuenta que deseas eliminar.");
      return;
    }
    const esRestaurante = tipoUsuario === "restaurante";
    const proveedores = usuario.providerData.map((proveedor) => proveedor.providerId);
    const usaContraseña = proveedores.includes(EmailAuthProvider.PROVIDER_ID);
    const usaGoogle = proveedores.includes(GoogleAuthProvider.PROVIDER_ID);
    if (usaContraseña && !contraseñaEliminacion) {
      setMensaje("Escribe tu contraseña actual para confirmar la eliminación.");
      return;
    }
    setCargando(true);
    setMensaje("");
    try {
      if (usaContraseña) {
        if (!usuario.email) {
          throw new Error("La cuenta no tiene un correo para verificar la contraseña.");
        }
        await reauthenticateWithCredential(
          usuario,
          EmailAuthProvider.credential(usuario.email, contraseñaEliminacion),
        );
      } else if (usaGoogle) {
        await reauthenticateWithPopup(usuario, new GoogleAuthProvider());
      } else {
        throw new Error(
          "Este método de acceso no permite verificar la cuenta para eliminarla.",
        );
      }

      let restaurantesCuenta = restaurantesPropietario;
      if (baseDatos) {
        const db = baseDatos;
        const restaurantesRemotos = esRestaurante
          ? await getDocs(
              query(
                collection(db, "restaurantes"),
                where("propietario", "==", usuario.uid),
              ),
            )
          : null;
        const idsRestaurantesRemotos = new Set(
            restaurantesRemotos?.docs.map((restaurante) => restaurante.id) ?? [],
        );
        if (restaurantesRemotos) {
          restaurantesCuenta = [
            ...new Map(
              [
                ...restaurantesCuenta.map((restaurante) => [
                  restaurante.id,
                  restaurante,
                ] as const),
                ...restaurantesRemotos.docs.map((restaurante) => [
                  restaurante.id,
                  normalizarRestaurante(restaurante.id, restaurante.data()),
                ] as const),
              ],
            ).values(),
          ];
        }

        const reservasConsulta = esRestaurante
          ? await Promise.all(
              [...new Set(restaurantesCuenta.map((restaurante) => restaurante.nombre))]
                .map((nombre) =>
                  getDocs(
                    query(
                      collection(db, "reservas"),
                      where("restaurante", "==", nombre),
                    ),
                  ),
                ),
            )
          : [
              await getDocs(
                query(
                  collection(db, "reservas"),
                  where("usuario", "==", usuario.uid),
                ),
              ),
            ];
        const reservasBorrar = [
          ...new Map(
            reservasConsulta
              .flatMap((grupo) => grupo.docs)
              .map((reserva) => [reserva.id, reserva] as const),
          ).values(),
        ];
        const ocupacionesRestaurantes = esRestaurante
          ? (
              await Promise.all(
                restaurantesCuenta
                  .filter((restaurante) =>
                    idsRestaurantesRemotos.has(restaurante.id),
                  )
                  .map((restaurante) =>
                  getDocs(
                    query(
                      collection(db, "ocupacionTurnos"),
                      where("restauranteId", "==", restaurante.id),
                    ),
                  ),
                ),
              )
            ).flatMap((grupo) => grupo.docs)
          : [];
        for (let inicio = 0; inicio < reservasBorrar.length; inicio += 500) {
          const lote = writeBatch(db);
          reservasBorrar
            .slice(inicio, inicio + 500)
            .forEach((reserva) => lote.delete(reserva.ref));
          await lote.commit();
        }

        if (esRestaurante && restaurantesRemotos) {
          for (
            let inicio = 0;
            inicio < restaurantesRemotos.docs.length;
            inicio += 250
          ) {
            const lote = writeBatch(db);
            restaurantesRemotos.docs
              .slice(inicio, inicio + 250)
              .forEach((restaurante) => {
                lote.delete(restaurante.ref);
                lote.delete(doc(db, "restaurantesPublicos", restaurante.id));
              });
            await lote.commit();
          }
        }
        for (
          let inicio = 0;
          inicio < ocupacionesRestaurantes.length;
          inicio += 500
        ) {
          const lote = writeBatch(db);
          ocupacionesRestaurantes
            .slice(inicio, inicio + 500)
            .forEach((ocupacion) => lote.delete(ocupacion.ref));
          await lote.commit();
        }
        await deleteDoc(doc(db, "perfiles", usuario.uid));
      }

      if (almacenamiento) {
        const storage = almacenamiento;
        const carpetas = esRestaurante
          ? [
              `perfiles/${usuario.uid}`,
              `certificados/${usuario.uid}`,
              `menus/${usuario.uid}`,
            ]
          : [`perfiles/${usuario.uid}`];
        await Promise.all(
          carpetas.map((ruta) =>
            eliminarArchivosDeCarpeta(ref(storage, ruta)),
          ),
        );
      }

      await deleteUser(usuario);
      localStorage.removeItem(`silla-libre-perfil-${usuario.uid}`);
      localStorage.removeItem(`silla-libre-reservas-${usuario.uid}`);
      localStorage.removeItem(`silla-libre-favoritos-${usuario.uid}`);
      if (esRestaurante) {
        localStorage.removeItem(`silla-libre-restaurantes-${usuario.uid}`);
      }
      setFavoritos([]);
      setConfirmandoEliminacion(false);
      setContraseñaEliminacion("");
      setMensaje(
        esRestaurante
          ? "Tu cuenta de restaurante y sus negocios, reservas y archivos asociados fueron eliminados."
          : "Tu cuenta y tus reservas personales fueron eliminadas.",
      );
      irAInicio();
    } catch (error) {
      if (
        error instanceof FirebaseError &&
        (error.code === "storage/unauthorized" ||
          error.code === "storage/object-not-found")
      ) {
        setMensaje(
          "Firebase Storage no permitió eliminar los archivos de la cuenta. Revisa las reglas para permitir que el usuario elimine sus propios archivos.",
        );
        return;
      }
      if (error instanceof FirebaseError && error.code === "permission-denied") {
        setMensaje(
          "Firebase no permitió borrar todos los datos. Revisa las reglas de Firestore para que la cuenta pueda eliminar su perfil, sus reservas y, si es restaurante, sus negocios.",
        );
      } else {
        setMensaje(
          error instanceof FirebaseError
            ? mensajeErrorAcceso(error)
            : error instanceof Error
              ? error.message
              : "No pudimos eliminar la cuenta. Inténtalo de nuevo.",
        );
      }
    } finally {
      setCargando(false);
    }
  };
  const guardarRestaurantePropietario = async (
    propietario: User,
  ): Promise<void> => {
    if (!formularioRestaurante.certificado) {
      throw new Error("Falta adjuntar el certificado del restaurante.");
    }
    if (!almacenamiento) {
      throw new Error("Firebase Storage no está disponible.");
    }

    const referenciaCertificado = ref(
      almacenamiento,
      `certificados/${propietario.uid}/${crypto.randomUUID()}-${formularioRestaurante.certificado.name}`,
    );
    await subirArchivoConLimite(
      referenciaCertificado,
      formularioRestaurante.certificado,
    );
    const urlCertificado = await getDownloadURL(referenciaCertificado);
    const datosRestaurante = {
      nombre: formularioRestaurante.nombre.trim(),
      direccion: formularioRestaurante.direccion.trim(),
      comida: formularioRestaurante.comida.trim(),
      certificado: urlCertificado,
      propietario: propietario.uid,
      menu: [],
      menuPdfUrl: "",
      menuPdfNombre: "",
      mesasPorTurno: 10,
      diasNoDisponibles: [],
      fechasNoDisponibles: [],
      creadoEn: serverTimestamp(),
    };
    if (!baseDatos) {
      throw new Error("Firestore no está disponible para guardar el restaurante.");
    }
    const db = baseDatos;
    const referenciaRestaurante = doc(collection(db, "restaurantes"));
    const referenciaPublica = doc(
      db,
      "restaurantesPublicos",
      referenciaRestaurante.id,
    );
    const loteRegistro = writeBatch(db);
    loteRegistro.set(referenciaRestaurante, datosRestaurante);
    loteRegistro.set(referenciaPublica, {
      nombre: datosRestaurante.nombre,
      direccion: datosRestaurante.direccion,
      comida: datosRestaurante.comida,
      propietario: propietario.uid,
      mesasPorTurno: 10,
      diasNoDisponibles: [],
      fechasNoDisponibles: [],
    });
    await esperarConLimite(
      loteRegistro.commit(),
      "Firestore tardó demasiado al publicar el restaurante.",
    );
    const nuevoRestaurante = normalizarRestaurante(
      referenciaRestaurante.id,
      datosRestaurante,
    );
    const restaurantesActualizados = [
      ...restaurantesPropietario,
      nuevoRestaurante,
    ];
    setRestaurantesPropietario(restaurantesActualizados);
    localStorage.setItem(
      `silla-libre-restaurantes-${propietario.uid}`,
      JSON.stringify(restaurantesActualizados),
    );
    setFormularioRestaurante(restauranteInicial);
  };
  const alternarFavorito = (id: number | string) => {
    const favoritosActualizados = favoritos.includes(id)
      ? favoritos.filter((favoritoId) => favoritoId !== id)
      : [...favoritos, id];
    setFavoritos(favoritosActualizados);
    const clave = usuario
      ? `silla-libre-favoritos-${usuario.uid}`
      : "silla-libre-favoritos";
    try {
      localStorage.setItem(clave, JSON.stringify(favoritosActualizados));
    } catch {
      setMensaje("No pudimos guardar tus favoritos en este dispositivo.");
      return;
    }
    if (usuario && baseDatos) {
      void setDoc(
        doc(baseDatos, "perfiles", usuario.uid),
        { favoritos: favoritosActualizados },
        { merge: true },
      ).catch(() => {
        setMensaje(
          "El cambio quedó guardado en este dispositivo, pero no se sincronizó con Firebase.",
        );
      });
    }
  };

  const iniciarSesionConGoogle = async () => {
    if (!autenticacion) {
      setMensaje(
        "Modo demostración activo. Añade las variables de Firebase para habilitar tu cuenta.",
      );
      return;
    }
    setCargando(true);
    setMensaje("");
    try {
      await signInWithPopup(autenticacion, new GoogleAuthProvider());
      setModal(null);
    } catch (error) {
      setMensaje(mensajeErrorAcceso(error));
    } finally {
      setCargando(false);
    }
  };

  const gestionarAcceso = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const datosRestauranteRegistro = { ...formularioRestaurante };
    setCargando(true);
    setMensaje("");
    try {
      if (!autenticacion)
        setMensaje(
          "Modo demostración activo. Añade las variables de Firebase para habilitar tu cuenta.",
        );
      else if (esRegistro) {
        const credencial = await createUserWithEmailAndPassword(
          autenticacion,
          correo,
          contraseña,
        );
        setTipoUsuario(tipoCuenta);
        localStorage.setItem(
          `silla-libre-perfil-${credencial.user.uid}`,
          JSON.stringify({
            tipo: tipoCuenta,
            nombre: nombreUsuario.trim(),
            telefono: "",
            foto: "",
          }),
        );
        setUsuario(credencial.user);
        let mensajeCreacion =
          "Tu cuenta fue creada correctamente.";
        try {
          await updateProfile(credencial.user, {
            displayName: nombreUsuario.trim(),
          });
        } catch {
          mensajeCreacion =
            "Tu cuenta fue creada, pero no pudimos guardar el nombre. Puedes actualizarlo desde tu perfil.";
        }
        if (baseDatos) {
          try {
            await setDoc(doc(baseDatos, "perfiles", credencial.user.uid), {
              nombre: nombreUsuario.trim(),
              tipo: tipoCuenta,
              telefono: "",
              foto: "",
            });
          } catch {
            mensajeCreacion =
              "Tu cuenta fue creada, pero no pudimos sincronizar el perfil. Inténtalo desde tu perfil más tarde.";
          }
        }
        if (tipoCuenta === "restaurante") {
          try {
            await guardarRestaurantePropietario(credencial.user);
            try {
              await enviarSolicitudPorCorreo(
                datosRestauranteRegistro,
                credencial.user,
              );
              mensajeCreacion =
                "Tu cuenta y restaurante fueron creados. La solicitud fue enviada a essillalibre@gmail.com.";
            } catch (error) {
              const detalle =
                error instanceof Error
                  ? error.message
                  : "No se pudo conectar con el servidor de correo.";
              mensajeCreacion =
                `Tu cuenta y restaurante fueron creados, pero no se envió el correo a essillalibre@gmail.com: ${detalle}`;
            }
          } catch {
            mensajeCreacion =
              "Tu cuenta fue creada, pero no pudimos guardar el restaurante. Completa el envío desde tu perfil.";
          }
          window.history.pushState({}, "", "/perfil/restaurante");
          setVista("perfil-restaurante");
        } else {
          window.history.pushState({}, "", "/perfil/usuario");
          setVista("perfil-usuario");
        }
        setModal(null);
        setMensaje(mensajeCreacion);
      } else {
        await signInWithEmailAndPassword(autenticacion, correo, contraseña);
        setModal(null);
      }
    } catch (error) {
      setMensaje(mensajeErrorAcceso(error));
    } finally {
      setCargando(false);
    }
  };
  const registrarRestaurante = async (
    evento: React.FormEvent<HTMLFormElement>,
  ) => {
    evento.preventDefault();
    if (!usuario) {
      setMensaje("Inicia sesión con una cuenta de restaurante para continuar.");
      return;
    }
    const datosFormulario = { ...formularioRestaurante };
    if (!datosFormulario.certificado) {
      setMensaje("Adjunta el certificado de salubridad para continuar.");
      return;
    }
    if (datosFormulario.certificado.size > 10 * 1024 * 1024) {
      setMensaje("El certificado debe pesar 10 MB o menos.");
      return;
    }
    const tipoCertificado = datosFormulario.certificado.type;
    if (
      tipoCertificado !== "application/pdf" &&
      !tipoCertificado.startsWith("image/")
    ) {
      setMensaje("El certificado debe ser un PDF o una imagen.");
      return;
    }
    setCargando(true);
    setMensaje("Guardando los datos del restaurante...");
    let guardadoEnFirebase = false;
    let mensajeGuardadoLocal = "";
    try {
      await guardarRestaurantePropietario(usuario);
      guardadoEnFirebase = true;
    } catch (error) {
      const idLocal = `local-${crypto.randomUUID()}`;
      const restauranteLocal = normalizarRestaurante(idLocal, {
        nombre: formularioRestaurante.nombre.trim(),
        direccion: datosFormulario.direccion.trim(),
        comida: datosFormulario.comida.trim(),
        certificado: datosFormulario.certificado.name,
        menu: [],
      });
      try {
        const restaurantesLocales = [
          ...leerRestaurantesLocales(usuario.uid),
          restauranteLocal,
        ];
        localStorage.setItem(
          `silla-libre-restaurantes-${usuario.uid}`,
          JSON.stringify(restaurantesLocales),
        );
        localStorage.setItem(
          `silla-libre-perfil-${usuario.uid}`,
          JSON.stringify({
            ...leerPerfilGuardado(usuario.uid),
            tipo: "restaurante",
          }),
        );
        setRestaurantesPropietario(restaurantesLocales);
        setTipoUsuario("restaurante");
        setFormularioRestaurante(restauranteInicial);
        mensajeGuardadoLocal =
          `Los datos quedaron guardados solo en este dispositivo. Firebase no pudo guardarlos: ${error instanceof Error ? error.message : "error de conexión"}.`;
      } catch {
        setMensaje("No se pudo guardar la información ni siquiera en este dispositivo. Revisa el espacio disponible e inténtalo de nuevo.");
        return;
      }
    }
    setMensaje("Enviando la solicitud y el certificado al correo de Silla Libre...");
    try {
      await enviarSolicitudPorCorreo(datosFormulario, usuario);
      setMensaje(
        guardadoEnFirebase
          ? "Restaurante guardado y solicitud enviada a essillalibre@gmail.com."
          : `Solicitud enviada a essillalibre@gmail.com. ${mensajeGuardadoLocal}`,
      );
    } catch (error) {
      const detalle =
        error instanceof Error
          ? error.name === "AbortError"
            ? "El servidor de correo tardó demasiado."
            : error.message
          : "No fue posible conectar con el servidor de correo.";
      setMensaje(
        `${guardadoEnFirebase ? "El restaurante quedó guardado en Firebase" : "El restaurante quedó guardado solo en este dispositivo"}, pero no se envió el correo: ${detalle}`,
      );
    } finally {
      setCargando(false);
    }
  };
  const guardarDisponibilidad = async (
    restauranteId: string,
    configuracion: ConfiguracionDisponibilidad,
  ) => {
    const restaurante = restaurantesPropietario.find(
      (actual) => actual.id === restauranteId,
    );
    if (!usuario || !restaurante) {
      setMensaje("No pudimos verificar el restaurante que quieres actualizar.");
      return;
    }
    if (!baseDatos || restauranteId.startsWith("local-")) {
      const actualizados = restaurantesPropietario.map((actual) =>
        actual.id === restauranteId ? { ...actual, ...configuracion } : actual,
      );
      setRestaurantesPropietario(actualizados);
      localStorage.setItem(
        `silla-libre-restaurantes-${usuario.uid}`,
        JSON.stringify(actualizados),
      );
      setMensaje(
        "La disponibilidad quedó guardada en este dispositivo; configura Firebase para sincronizarla en tiempo real.",
      );
      return;
    }
    const db = baseDatos;
    setCargando(true);
    setMensaje("");
    try {
      const lote = writeBatch(db);
      const cambiosDisponibilidad = {
        mesasPorTurno: configuracion.mesasPorTurno,
        diasNoDisponibles: configuracion.diasNoDisponibles,
        fechasNoDisponibles: configuracion.fechasNoDisponibles,
      };
      lote.update(doc(db, "restaurantes", restauranteId), cambiosDisponibilidad);
      lote.update(
        doc(db, "restaurantesPublicos", restauranteId),
        cambiosDisponibilidad,
      );
      await lote.commit();
      const actualizados = restaurantesPropietario.map((actual) =>
        actual.id === restauranteId ? { ...actual, ...configuracion } : actual,
      );
      setRestaurantesPropietario(actualizados);
      localStorage.setItem(
        `silla-libre-restaurantes-${usuario.uid}`,
        JSON.stringify(actualizados),
      );
      setMensaje(
        `Disponibilidad de ${restaurante.nombre} actualizada en tiempo real.`,
      );
    } catch (error) {
      setMensaje(
        error instanceof FirebaseError && error.code === "permission-denied"
          ? "Firebase no permitió actualizar la disponibilidad. Revisa las reglas de ambos documentos del restaurante."
          : "No pudimos actualizar la disponibilidad. Revisa la conexión e inténtalo de nuevo.",
      );
    } finally {
      setCargando(false);
    }
  };
  const cambiarPlato = (
    restauranteId: string,
    platoId: string,
    cambios: Partial<PlatoMenu>,
  ) => {
    setRestaurantesPropietario((actuales) =>
      actuales.map((restaurante) =>
        restaurante.id === restauranteId
          ? {
              ...restaurante,
              menu: restaurante.menu.map((plato) =>
                plato.id === platoId ? { ...plato, ...cambios } : plato,
              ),
            }
          : restaurante,
      ),
    );
  };
  const agregarPlato = (restauranteId: string) => {
    setRestaurantesPropietario((actuales) =>
      actuales.map((restaurante) =>
        restaurante.id === restauranteId
          ? {
              ...restaurante,
              menu: [
                ...restaurante.menu,
                {
                  id: crypto.randomUUID(),
                  nombre: "",
                  descripcion: "",
                  precio: "",
                },
              ],
            }
          : restaurante,
      ),
    );
  };
  const quitarPlato = (restauranteId: string, platoId: string) => {
    setRestaurantesPropietario((actuales) =>
      actuales.map((restaurante) =>
        restaurante.id === restauranteId
          ? {
              ...restaurante,
              menu: restaurante.menu.filter((plato) => plato.id !== platoId),
            }
          : restaurante,
      ),
    );
  };
  const guardarMenu = async (restauranteId: string) => {
    const restaurante = restaurantesPropietario.find(
      (elemento) => elemento.id === restauranteId,
    );
    if (!restaurante || !usuario) return;
    if (
      restaurante.menu.some(
        (plato) =>
          !plato.nombre.trim() ||
          !plato.precio ||
          !Number.isFinite(Number(plato.precio)) ||
          Number(plato.precio) < 0,
      )
    ) {
      setMensaje("Completa el nombre y un precio válido para cada plato.");
      return;
    }
    setCargando(true);
    setMensaje("");
    try {
      if (baseDatos) {
        await updateDoc(doc(baseDatos, "restaurantes", restauranteId), {
          menu: restaurante.menu,
        });
      }
      localStorage.setItem(
        `silla-libre-restaurantes-${usuario.uid}`,
        JSON.stringify(restaurantesPropietario),
      );
      setMensaje(`Menú de ${restaurante.nombre} actualizado correctamente.`);
    } catch {
      setMensaje("No pudimos guardar el menú. Inténtalo de nuevo.");
    } finally {
      setCargando(false);
    }
  };
  const subirMenuArchivo = async (restauranteId: string, archivo: File) => {
    if (!usuario) {
      setMensaje("Inicia sesión con una cuenta de restaurante para subir el menú.");
      return;
    }
    const extension = archivo.name.split(".").pop()?.toLowerCase();
    const tiposArchivo: Record<string, string> = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    if (!extension || !(extension in tiposArchivo)) {
      setMensaje("El menú debe ser un archivo PDF o Word (.doc, .docx).");
      setProgresoMenu((actual) => ({ ...actual, [restauranteId]: -1 }));
      return;
    }
    if (archivo.size > 10 * 1024 * 1024) {
      setMensaje("El archivo del menú debe pesar 10 MB o menos.");
      setProgresoMenu((actual) => ({ ...actual, [restauranteId]: -1 }));
      return;
    }
    if (!almacenamiento || !baseDatos) {
      setMensaje("Firebase Storage y Firestore deben estar configurados para subir el menú.");
      setProgresoMenu((actual) => ({ ...actual, [restauranteId]: -1 }));
      return;
    }
    setCargando(true);
    setProgresoMenu((actual) => ({ ...actual, [restauranteId]: 0 }));
    setMensaje("");
    try {
      const referenciaMenu = ref(
        almacenamiento,
        `menus/${usuario.uid}/${restauranteId}/menu.${extension}`,
      );
      await subirArchivoConLimite(referenciaMenu, archivo, (porcentaje) => {
        setProgresoMenu((actual) => ({
          ...actual,
          [restauranteId]: porcentaje,
        }));
      });
      const menuPdfUrl = await getDownloadURL(referenciaMenu);
      await esperarConLimite(
        updateDoc(doc(baseDatos, "restaurantes", restauranteId), {
          menuPdfUrl,
          menuPdfNombre: archivo.name,
        }),
        "El archivo se subió, pero Firestore tardó demasiado al guardar el enlace.",
      );
      const restaurantesActualizados = restaurantesPropietario.map(
        (restaurante) =>
          restaurante.id === restauranteId
            ? { ...restaurante, menuPdfUrl, menuPdfNombre: archivo.name }
            : restaurante,
      );
      setRestaurantesPropietario(restaurantesActualizados);
      localStorage.setItem(
        `silla-libre-restaurantes-${usuario.uid}`,
        JSON.stringify(restaurantesActualizados),
      );
      setMensaje(`Menú de ${restaurantesActualizados.find((restaurante) => restaurante.id === restauranteId)?.nombre ?? "tu restaurante"} actualizado.`);
      setProgresoMenu((actual) => ({ ...actual, [restauranteId]: 100 }));
    } catch (error) {
      setProgresoMenu((actual) => ({ ...actual, [restauranteId]: -1 }));
      setMensaje(
        error instanceof Error
          ? `No se pudo guardar el menú: ${error.message}`
          : "No se pudo guardar el menú. Revisa la conexión y las reglas de Firebase.",
      );
    } finally {
      setCargando(false);
    }
  };
  const cancelarReserva = async (reserva: ReservaPerfil) => {
    if (!reserva.id) {
      setMensaje("No se puede cancelar esta reserva porque no tiene un registro guardado.");
      return;
    }
    setCargando(true);
    setMensaje("");
    try {
      if (baseDatos && reserva.turnoId) {
        const db = baseDatos;
        await runTransaction(db, async (transaccion) => {
          const referenciaReserva = doc(db, "reservas", reserva.id!);
          const referenciaTurno = doc(
            db,
            "ocupacionTurnos",
            reserva.turnoId!,
          );
          const [reservaActual, turnoActual] = await Promise.all([
            transaccion.get(referenciaReserva),
            transaccion.get(referenciaTurno),
          ]);
          if (!reservaActual.exists()) {
            throw new Error("La reserva ya no existe.");
          }
          if (reservaActual.data().estado === "Cancelada") return;
          transaccion.update(referenciaReserva, {
            estado: "Cancelada",
            canceladaEn: serverTimestamp(),
          });
          if (turnoActual.exists()) {
            const ocupadas = turnoActual.data().mesasOcupadas;
            transaccion.update(referenciaTurno, {
              mesasOcupadas:
                typeof ocupadas === "number" ? Math.max(ocupadas - 1, 0) : 0,
              actualizadoEn: serverTimestamp(),
            });
          }
        });
      } else if (baseDatos) {
        await updateDoc(doc(baseDatos, "reservas", reserva.id), {
          estado: "Cancelada",
          canceladaEn: serverTimestamp(),
        });
      }
      const reservasActualizadas = reservasPerfil.map((actual) =>
        actual.id === reserva.id
          ? { ...actual, estado: "Cancelada" }
          : actual,
      );
      setReservasPerfil(reservasActualizadas);
      if (usuario) {
        localStorage.setItem(
          `silla-libre-reservas-${usuario.uid}`,
          JSON.stringify(reservasActualizadas),
        );
      }
      setMensaje(`La reserva de ${reserva.restaurante} fue cancelada.`);
    } catch (error) {
      setMensaje(
        error instanceof Error
          ? `No pudimos cancelar la reserva: ${error.message}`
          : "No pudimos cancelar la reserva. Revisa la conexión e inténtalo de nuevo.",
      );
    } finally {
      setCargando(false);
    }
  };
  const abrirReserva = (
    restaurante = restaurantes[0],
    datosIniciales?: Partial<FormularioReserva>,
  ) => {
    const restauranteActual = restaurantesVisibles.find(
      (actual) => String(actual.id) === String(restaurante.id),
    );
    setRestauranteActivo(restauranteActual ?? restaurante);
    setReserva((actual) => ({ ...actual, hora: "", ...datosIniciales }));
    setDisponibilidadActiva(null);
    setMesasOcupadasTurno(0);
    setTurnoSuscritoId(null);
    setMensaje("");
    setModal("reserva");
  };
  const confirmarReserva = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const horarioRestaurante =
      restauranteActivo.id === 1
        ? { apertura: "12:30", nombre: "Osaka Nikkei" }
        : restauranteActivo.id === 2
          ? { apertura: "12:00", nombre: "DonDoh Bogotá" }
          : null;
    if (
      horarioRestaurante &&
      (reserva.hora < horarioRestaurante.apertura || reserva.hora > "23:00")
    ) {
      setMensaje(
        `${horarioRestaurante.nombre} recibe reservas de ${horarioRestaurante.apertura} p. m. a 11:00 p. m.`,
      );
      return;
    }
    const negocioReservable = restaurantesPublicos.find(
      (actual) => actual.id === String(restauranteActivo.id),
    );
    const disponibilidad = disponibilidadActiva ?? negocioReservable ?? null;
    const ocupacionActual =
      turnoSuscritoId === turnoSeleccionadoId ? mesasOcupadasTurno : 0;
    if (
      disponibilidad &&
      (reserva.hora.slice(3) !== "00" ||
        disponibilidad.diasNoDisponibles.includes(
          new Date(`${reserva.fecha}T12:00:00`).getDay(),
        ) ||
        disponibilidad.fechasNoDisponibles.includes(reserva.fecha))
    ) {
      setMensaje(
        "Este restaurante no recibe reservas en esa fecha u hora. Selecciona otro turno.",
      );
      return;
    }
    if (
      disponibilidad &&
      (disponibilidad.mesasPorTurno === 0 ||
        ocupacionActual >= disponibilidad.mesasPorTurno)
    ) {
      setMensaje("No quedan mesas disponibles en ese turno. Elige otra hora.");
      return;
    }
    const datos: DatosReserva = {
      restaurante: restauranteActivo.nombre,
      fecha: reserva.fecha,
      hora: reserva.hora,
      personas: Number(reserva.personas),
      correo: usuario?.email ?? correo,
    };
    setCargando(true);
    setMensaje("");
    try {
      let reservaId: string | undefined;
      let turnoId: string | undefined;
      if (disponibilidad && baseDatos) {
        const db = baseDatos;
        turnoId = `${disponibilidad.id}_${reserva.fecha}_${reserva.hora.slice(0, 2)}`;
        const referenciaNegocio = doc(
          db,
          "restaurantesPublicos",
          String(disponibilidad.id),
        );
        const referenciaTurno = doc(db, "ocupacionTurnos", turnoId);
        const referenciaReserva = doc(collection(db, "reservas"));
        await runTransaction(db, async (transaccion) => {
          const [negocioActual, turnoActual] = await Promise.all([
            transaccion.get(referenciaNegocio),
            transaccion.get(referenciaTurno),
          ]);
          if (!negocioActual.exists()) {
            throw new Error("El restaurante ya no está disponible para reservas.");
          }
          const configuracion = normalizarRestaurantePublico(
            negocioActual.id,
            negocioActual.data(),
          );
          if (
            !configuracion ||
            configuracion.diasNoDisponibles.includes(
              new Date(`${reserva.fecha}T12:00:00`).getDay(),
            ) ||
            configuracion.fechasNoDisponibles.includes(reserva.fecha)
          ) {
            throw new Error("El restaurante está cerrado en la fecha seleccionada.");
          }
          const cantidadOcupada = turnoActual.data()?.mesasOcupadas;
          const mesasOcupadas =
            typeof cantidadOcupada === "number" ? cantidadOcupada : 0;
          if (mesasOcupadas >= configuracion.mesasPorTurno) {
            throw new Error("No quedan mesas en ese turno. Elige otra hora.");
          }
          transaccion.set(referenciaTurno, {
            restauranteId: disponibilidad.id,
            fecha: reserva.fecha,
            hora: reserva.hora,
            mesasOcupadas: mesasOcupadas + 1,
            actualizadoEn: serverTimestamp(),
          });
          transaccion.set(referenciaReserva, {
            ...datos,
            restauranteId: disponibilidad.id,
            turnoId,
            usuario: usuario?.uid ?? "invitado",
            estado: "Confirmada",
            creadoEn: serverTimestamp(),
          });
        });
        reservaId = referenciaReserva.id;
      } else if (baseDatos) {
        const reservaCreada = await addDoc(collection(baseDatos, "reservas"), {
          ...datos,
          restauranteId: String(restauranteActivo.id),
          usuario: usuario?.uid ?? "invitado",
          estado: "Confirmada",
          creadoEn: serverTimestamp(),
        });
        reservaId = reservaCreada.id;
      }
      const reservaGuardada = {
        ...datos,
        id: reservaId,
        restauranteId: String(disponibilidad?.id ?? restauranteActivo.id),
        turnoId,
        estado: "Confirmada",
      };
      if (usuario) {
        const reservasActualizadas = [...reservasPerfil, reservaGuardada];
        setReservasPerfil(reservasActualizadas);
        localStorage.setItem(
          `silla-libre-reservas-${usuario.uid}`,
          JSON.stringify(reservasActualizadas),
        );
      } else {
        const reservasInvitado = leerReservasGuardadas(null, correo);
        localStorage.setItem(
          "silla-libre-reservas",
          JSON.stringify([...reservasInvitado, reservaGuardada]),
        );
      }
      crearEventoCalendario(datos);
      await avisarReserva(datos).catch(() => undefined);
      setReserva(reservaInicial);
      setMensaje(
        "Reserva confirmada. Descargamos el evento para tu calendario.",
      );
    } catch (error) {
      setMensaje(
        error instanceof Error
          ? error.message
          : "No pudimos confirmar la reserva. Revisa los datos e inténtalo nuevamente.",
      );
    } finally {
      setCargando(false);
    }
  };
  const guardarPerfil = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!usuario) return;
    setCargando(true);
    setMensaje("");
    const nombreCompleto = [nombreUsuario.trim(), apellidoUsuario.trim()]
      .filter(Boolean)
      .join(" ");
    const fotoSoloLocal = Boolean(archivoFotoPerfil && !almacenamiento);
    const fotoLocalSeleccionada =
      fotoPerfilPrevia || fotoPerfil || usuario.photoURL || "";
    let fotoRemota = fotoPerfil || usuario.photoURL || "";
    const perfilLocal = {
      tipo: tipoUsuario,
      nombre: nombreUsuario.trim(),
      apellido: apellidoUsuario.trim(),
      tratamiento: tratamientoUsuario,
      fechaNacimiento,
      telefono: telefono.trim(),
      foto: fotoLocalSeleccionada,
    };
    try {
      localStorage.setItem(
        `silla-libre-perfil-${usuario.uid}`,
        JSON.stringify(perfilLocal),
      );
    } catch {
      setMensaje("No pudimos guardar el perfil en este dispositivo.");
      setCargando(false);
      return;
    }

    try {
      if (archivoFotoPerfil && almacenamiento) {
        const referenciaFoto = ref(
          almacenamiento,
          `perfiles/${usuario.uid}/foto-perfil`,
        );
        await subirArchivoConLimite(referenciaFoto, archivoFotoPerfil);
        fotoRemota = await getDownloadURL(referenciaFoto);
        localStorage.setItem(
          `silla-libre-perfil-${usuario.uid}`,
          JSON.stringify({ ...perfilLocal, foto: fotoRemota }),
        );
        setFotoPerfil(fotoRemota);
        setFotoPerfilPrevia("");
        setArchivoFotoPerfil(null);
      }
      await updateProfile(usuario, {
        displayName: nombreCompleto || usuario.displayName || "",
        photoURL: fotoRemota || null,
      });
      if (baseDatos)
        await setDoc(
          doc(baseDatos, "perfiles", usuario.uid),
          {
            nombre: nombreCompleto,
            nombrePila: nombreUsuario.trim(),
            apellido: apellidoUsuario.trim(),
            tratamiento: tratamientoUsuario,
            fechaNacimiento,
            telefono: telefono.trim(),
            ...(fotoRemota ? { foto: fotoRemota } : {}),
            tipo: tipoUsuario,
          },
          { merge: true },
        );
      const fotoGuardada = fotoRemota || fotoLocalSeleccionada;
      localStorage.setItem(
        `silla-libre-perfil-${usuario.uid}`,
        JSON.stringify({ ...perfilLocal, foto: fotoGuardada }),
      );
      setFotoPerfil(fotoGuardada);
      setFotoPerfilPrevia("");
      setArchivoFotoPerfil(null);
      setMensaje(
        fotoSoloLocal
          ? "Perfil actualizado en este dispositivo. La foto no se sincronizará con otros dispositivos porque Firebase Storage no está disponible."
          : "Perfil actualizado correctamente.",
      );
    } catch {
      setMensaje(
        archivoFotoPerfil
          ? almacenamiento
            ? "El teléfono y los demás datos quedaron guardados en este dispositivo, pero no pudimos subir la foto. Revisa la conexión y las reglas de Firebase Storage."
            : "Los cambios se guardaron en este dispositivo. La foto no se sincronizará con otros dispositivos porque Firebase Storage no está disponible."
          : "Los cambios se guardaron en este dispositivo, pero no pudimos sincronizarlos con Firebase. Revisa tu conexión y las reglas de Firestore.",
      );
    } finally {
      setCargando(false);
    }
  };
  const guardarFotoRestaurante = async (
    evento: React.FormEvent<HTMLFormElement>,
  ) => {
    evento.preventDefault();
    if (!usuario) return;
    const archivoSeleccionado = archivoFotoPerfil;
    if (!archivoSeleccionado) {
      setMensaje("Selecciona una foto del restaurante antes de guardar.");
      return;
    }
    setCargando(true);
    setMensaje("Guardando la foto del restaurante...");
    const fotoPreviaSeleccionada = fotoPerfilPrevia;
    let fotoGuardada = fotoPreviaSeleccionada || fotoPerfil || "";
    let fotoRemota = false;
    try {
      if (almacenamiento && baseDatos) {
        const referenciaFoto = ref(
          almacenamiento,
          `perfiles/${usuario.uid}/foto-restaurante`,
        );
        await subirArchivoConLimite(referenciaFoto, archivoSeleccionado);
        fotoGuardada = await getDownloadURL(referenciaFoto);
        await esperarConLimite(
          setDoc(
            doc(baseDatos, "perfiles", usuario.uid),
            { tipo: "restaurante", fotoRestaurante: fotoGuardada },
            { merge: true },
          ),
          "Firestore tardó demasiado al guardar la foto.",
        );
        fotoRemota = true;
      }
      const perfilPrevio = leerPerfilGuardado(usuario.uid);
      localStorage.setItem(
        `silla-libre-perfil-${usuario.uid}`,
        JSON.stringify({
          ...perfilPrevio,
          tipo: "restaurante",
          fotoRestaurante: fotoGuardada,
        }),
      );
      setFotoPerfil(fotoGuardada);
      setFotoPerfilPrevia("");
      setArchivoFotoPerfil(null);
      setMensaje(
        fotoRemota
          ? "Foto del restaurante guardada y sincronizada."
          : "Foto guardada solo en este dispositivo. Configura Firebase Storage y Firestore para sincronizarla.",
      );
    } catch {
      try {
        const fotoLocal = await crearFotoLocal(archivoSeleccionado);
        const perfilPrevio = leerPerfilGuardado(usuario.uid);
        localStorage.setItem(
          `silla-libre-perfil-${usuario.uid}`,
          JSON.stringify({
            ...perfilPrevio,
            tipo: "restaurante",
            fotoRestaurante: fotoLocal,
          }),
        );
        setFotoPerfil(fotoLocal);
        setFotoPerfilPrevia("");
        setArchivoFotoPerfil(null);
        setMensaje("Foto guardada en este dispositivo, pero no se sincronizó con Firebase. Revisa las reglas de Storage y Firestore.");
      } catch {
      setMensaje(
        "No se pudo guardar la foto. Revisa el almacenamiento local y las reglas de Firebase Storage y Firestore.",
      );
      }
    } finally {
      setCargando(false);
    }
  };
  const cambiarFoto = (archivo: File | undefined) => {
    if (!archivo) return;
    if (!archivo.type.startsWith("image/")) {
      setMensaje("Selecciona un archivo de imagen válido.");
      return;
    }
    if (archivo.size > 5 * 1024 * 1024) {
      setMensaje("La foto debe pesar 5 MB o menos.");
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      setArchivoFotoPerfil(archivo);
      setFotoPerfilPrevia(String(lector.result));
      setMensaje("");
    };
    lector.onerror = () => {
      setMensaje("No pudimos leer la imagen. Inténtalo con otro archivo.");
    };
    lector.readAsDataURL(archivo);
  };
  const fechaBloqueada =
    disponibilidadActiva !== null &&
    Boolean(
      reserva.fecha &&
        (disponibilidadActiva.fechasNoDisponibles.includes(reserva.fecha) ||
          disponibilidadActiva.diasNoDisponibles.includes(
            new Date(`${reserva.fecha}T12:00:00`).getDay(),
          )),
    );
  const ocupacionMostrada =
    turnoSuscritoId === turnoSeleccionadoId ? mesasOcupadasTurno : 0;
  const mesasRestantes = disponibilidadActiva
    ? Math.max(
        disponibilidadActiva.mesasPorTurno - ocupacionMostrada,
        0,
      )
    : null;
  const turnoSinMesas =
    disponibilidadActiva !== null &&
    mesasRestantes !== null &&
    mesasRestantes < 1;
  const turnoNoDisponible = fechaBloqueada || turnoSinMesas;

  return (
    <div className="aplicacion">
      <header className="barra-navegacion">
        <button
          className="marca"
          onClick={irAInicio}
          aria-label="Volver al inicio"
        >
          <img
            src="/imagenes/logo-silla-libre.png"
            alt="Logo de Silla Libre"
            className="logo-imagen"
          />
        </button>
        {vista === "inicio" && <nav className="navegacion" aria-label="Navegación principal">
          <button
            className={pestaña === "inicio" ? "activo" : ""}
            onClick={() => navegar("inicio")}
          >
            Inicio
          </button>
          <button
            className={pestaña === "restaurantes" ? "activo" : ""}
            onClick={() => navegar("restaurantes")}
          >
            Explorar
          </button>
          <button
            className={pestaña === "reservas" ? "activo" : ""}
            onClick={() => navegar("reservas")}
          >
            Mis reservas
          </button>
          <button
            className={vista !== "inicio" ? "activo" : ""}
            onClick={() => (usuario ? navegar("perfil") : mostrarAcceso())}
          >
            Mi perfil
          </button>
        </nav>}
        <div className="acciones-navegacion">
          {vista === "inicio" ? (
            <>
              {usuario ? (
                <button className="perfil" onClick={irAlPerfil}>
                  <span className="perfil-avatar">
                    {fotoPerfilPrevia || fotoPerfil || usuario.photoURL ? (
                      <img
                        src={fotoPerfilPrevia || fotoPerfil || usuario.photoURL || ""}
                        alt=""
                      />
                    ) : (
                      (usuario.displayName ?? usuario.email)?.slice(0, 1).toUpperCase()
                    )}
                  </span>{" "}
                  {usuario.displayName || usuario.email}
                </button>
              ) : (
                <button className="enlace-boton" onClick={() => mostrarAcceso()}>
                  Iniciar sesión
                </button>
              )}
              <button
                className="boton boton-dorado"
                onClick={() => mostrarAcceso(true)}
              >
                Crear cuenta
              </button>
            </>
          ) : (
            <button className="enlace-boton" onClick={irAInicio}>
              ← Volver al inicio
            </button>
          )}
          {usuarioEsAdministrador && vista !== "panel-admin" && (
            <button className="boton boton-dorado" onClick={abrirPanelAdmin}>
              Panel administrador
            </button>
          )}
        </div>
      </header>
      <main>
        {vista === "panel-admin" ? (
          <section className="perfil-seccion panel-admin-seccion">
            <div className="perfil-encabezado">
              <div>
                <p className="sobretitulo oscuro">SILLA LIBRE · ADMINISTRACIÓN</p>
                <h2>Panel de administración</h2>
                <p className="texto-seccion">
                  Consulta el estado de los restaurantes publicados en la plataforma.
                </p>
              </div>
              {usuario && (
                <div className="acciones-perfil">
                  <span className="admin-correo">{usuario.email}</span>
                  <button className="boton-texto" onClick={() => void cerrarSesion()}>
                    Cerrar sesión <span>↗</span>
                  </button>
                </div>
              )}
            </div>
            {!correoAdministrador ? (
              <p className="aviso perfil-aviso">
                El acceso administrativo no está configurado. Define VITE_ADMIN_EMAIL
                en las variables de entorno y vuelve a desplegar.
              </p>
            ) : autenticacionCargando ? (
              <p className="aviso perfil-aviso">Verificando el acceso...</p>
            ) : !usuario ? (
              <div className="aviso perfil-aviso">
                <p>Inicia sesión con la cuenta administradora para continuar.</p>
                <button className="boton boton-vino" onClick={() => mostrarAcceso()}>
                  Iniciar sesión
                </button>
              </div>
            ) : usuario.email?.trim().toLowerCase() !== correoAdministrador ? (
              <p className="aviso perfil-aviso">
                Esta cuenta no tiene acceso al panel de administración.
              </p>
            ) : !usuario.emailVerified ? (
              <div className="aviso perfil-aviso">
                <p>Verifica el correo de la cuenta administradora para continuar.</p>
                <button
                  className="boton boton-vino"
                  onClick={() => void verificarCorreoAdministrador()}
                  disabled={cargando}
                >
                  {cargando ? "Enviando..." : "Enviar enlace de verificación"}
                </button>
              </div>
            ) : (
              <PanelAdministrador
                restaurantes={restaurantesPublicos}
                cargando={restaurantesPublicosCargando}
              />
            )}
          </section>
        ) : vista === "inicio" ? (
          <>
        <section className="hero" id="inicio">
          <div className="hero-contenido">
            <p className="sobretitulo">BOGOTÁ · EXPERIENCIAS QUE PERMANECEN</p>
            <h1>
              Una mesa especial
              <br />
              <em>empieza aquí.</em>
            </h1>
            <p className="hero-descripcion">
              Descubre lugares con alma, reserva sin vueltas y convierte
              cualquier comida en un buen recuerdo.
            </p>
            <div className="hero-acciones">
              <button
                className="boton boton-dorado grande"
                onClick={() => navegar("restaurantes")}
              >
                Explorar restaurantes <span>↗</span>
              </button>
              <button
                className="boton boton-transparente"
                onClick={() => mostrarAcceso(true, "restaurante")}
              >
                Soy restaurante
              </button>
            </div>
          </div>
          <div className="hero-imagen">
            <div
              className="hero-foto"
              role="img"
              aria-label="Mesa elegante de restaurante"
            ></div>
            <div className="nota-hero">
              <span>✦</span>
              <strong>Selección Silla Libre</strong>
              <small>Curaduría local, cada semana</small>
            </div>
          </div>
        </section>
        <section className="buscador-seccion" id="restaurantes">
          <div className="encabezado-seccion">
            <div>
              <p className="sobretitulo oscuro">ENCUENTRA TU PRÓXIMO LUGAR</p>
              <h2>
                Donde quieres estar
                <br />
                <em>hoy.</em>
              </h2>
            </div>
            <p className="texto-seccion">
              De la cena improvisada a esa ocasión que merece algo más. Filtra,
              compara y reserva en minutos.
            </p>
          </div>
          <div className="buscador">
            <span className="icono">⌕</span>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Busca por restaurante o tipo de comida..."
            />
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            >
              <option>Todas</option>
              {categoriasDisponibles.map((elemento) => (
                <option key={elemento}>{elemento}</option>
              ))}
            </select>
            <button
              className="boton boton-vino"
              onClick={() => navegar("restaurantes")}
            >
              Buscar
            </button>
          </div>
          <div className="etiquetas">
            <span>Explora por:</span>
            <button onClick={() => setCategoria("Cocina Nikkei")}>
              Cocina Nikkei
            </button>
            <button onClick={() => setCategoria("Parrilla japonesa")}>
              Parrilla japonesa
            </button>
            <button onClick={() => setCategoria("Cocina italiana")}>
              Cocina italiana
            </button>
          </div>
        </section>
        <section className="listado" aria-labelledby="titulo-restaurantes">
          <div className="encabezado-listado">
            <div>
              <span className="contador">
                {restaurantesFiltrados.length} lugares encontrados
              </span>
              <h2 id="titulo-restaurantes">
                Una buena idea para <em>esta noche.</em>
              </h2>
            </div>
            <button
              className="boton-texto"
              onClick={() => {
                setBusqueda("");
                setCategoria("Todas");
              }}
            >
              Ver todos <span>→</span>
            </button>
          </div>
          <div className="tarjetas">
            {restaurantesFiltrados.map((restaurante) => (
              <article className="tarjeta-restaurante" key={restaurante.id}>
                <div className="imagen-tarjeta">
                  <button
                    className="enlace-imagen-restaurante"
                    type="button"
                    onClick={() => abrirDetalleRestaurante(restaurante)}
                    aria-label={`Ver detalles de ${restaurante.nombre}`}
                  >
                    <img
                      src={restaurante.imagen}
                      alt={`Interior de ${restaurante.nombre}`}
                    />
                  </button>
                  <span className="etiqueta-categoria">
                    {restaurante.categoria}
                  </span>
                  <button
                    className={`favorito ${favoritos.includes(restaurante.id) ? "activo" : ""}`}
                    onClick={() => alternarFavorito(restaurante.id)}
                    aria-label={`${favoritos.includes(restaurante.id) ? "Quitar de favoritos" : "Guardar"} ${restaurante.nombre}`}
                    aria-pressed={favoritos.includes(restaurante.id)}
                  >
                    {favoritos.includes(restaurante.id) ? "♥" : "♡"}
                  </button>
                </div>
                <div className="contenido-tarjeta">
                  <div className="fila-tarjeta">
                    <h3>
                      <button
                        className="titulo-restaurante-enlace"
                        type="button"
                        onClick={() => abrirDetalleRestaurante(restaurante)}
                      >
                        {restaurante.nombre}
                      </button>
                    </h3>
                    <span className="calificacion">★ {restaurante.rating}</span>
                  </div>
                  <p className="ubicacion">
                    ⌖ {restaurante.locacion}, Bogotá <span>·</span>{" "}
                    {restaurante.rangoprecios}
                  </p>
                  <p>{restaurante.descripcion}</p>
                  <div className="acciones-tarjeta">
                    <button
                      className="boton boton-vino"
                      type="button"
                      onClick={() => abrirReserva(restaurante)}
                    >
                      Reservar mesa
                    </button>
                    {restaurante.urlreserva && (
                      <a
                        className="reservar-enlace"
                        href={restaurante.urlreserva}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Visitar sitio web <span>↗</span>
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="cta-restaurante">
          <div>
            <p className="sobretitulo">PARA QUIENES HACEN LA EXPERIENCIA</p>
            <h2>
              Tu cocina merece
              <br />
              <em>una mesa llena.</em>
            </h2>
            <p>
              Únete a Silla Libre y deja que más personas descubran lo que haces
              mejor.
            </p>
          </div>
          <button
            className="boton boton-dorado grande"
            onClick={() => mostrarAcceso(true, "restaurante")}
          >
            Registrar mi restaurante <span>↗</span>
          </button>
        </section>
          </>
        ) : vista === "detalle-restaurante" && restauranteDetalle ? (
          <DetalleRestaurante
            key={restauranteDetalle.id}
            restaurante={restauranteDetalle}
            favorito={favoritos.includes(restauranteDetalle.id)}
            alternarFavorito={() => alternarFavorito(restauranteDetalle.id)}
            reservar={(seleccion) =>
              abrirReserva(restauranteDetalle, seleccion)
            }
            usuario={usuario}
            iniciarSesion={() => mostrarAcceso()}
            volver={volverAListaRestaurantes}
          />
        ) : (
          <section className="perfil-seccion">
            <div className="perfil-encabezado">
              <div>
                <p className="sobretitulo oscuro">
                  {vista === "perfil-restaurante"
                    ? "ESPACIO DEL RESTAURANTE"
                    : "ESPACIO PERSONAL"}
                </p>
                <h2>
                  {vista === "perfil-restaurante"
                    ? "Tu negocio, en control."
                    : "Tu perfil, a tu manera."}
                </h2>
                <p className="texto-seccion">
                  {vista === "perfil-restaurante"
                    ? "Administra tus restaurantes, actualiza sus menús y revisa las reservas."
                    : "Actualiza tus datos y consulta los detalles de tus reservas."}
                </p>
              </div>
              {usuario && (
                <div className="acciones-perfil">
                  {vista === "perfil-usuario" && (
                    <button
                      className="boton-texto"
                      type="button"
                      onClick={() => void abrirPerfilRestaurante()}
                    >
                      ¿Administras un restaurante? Abrir panel <span>↗</span>
                    </button>
                  )}
                  <button className="boton-texto" onClick={() => void cerrarSesion()}>
                    Cerrar sesión <span>↗</span>
                  </button>
                </div>
              )}
            </div>
            {autenticacionCargando ? (
              <p className="aviso perfil-aviso">Cargando tu perfil...</p>
            ) : !usuario ? (
              <div className="aviso perfil-aviso">
                <p>Inicia sesión para consultar este espacio personal.</p>
                <button className="boton boton-vino" onClick={() => mostrarAcceso()}>
                  Iniciar sesión
                </button>
              </div>
            ) : perfilCargando ? (
              <p className="aviso perfil-aviso">Cargando la información de tu cuenta...</p>
            ) : tipoUsuario === "restaurante" ||
              vista === "perfil-restaurante" ? (
              <PanelRestaurante
                foto={fotoPerfilPrevia || fotoPerfil || usuario.photoURL || ""}
                cambiarFoto={cambiarFoto}
                guardarPerfil={guardarFotoRestaurante}
                restaurantes={restaurantesPropietario}
                reservas={reservasPerfil}
                datosFormulario={formularioRestaurante}
                cambiarFormulario={setFormularioRestaurante}
                registrarRestaurante={registrarRestaurante}
                cambiarPlato={cambiarPlato}
                agregarPlato={agregarPlato}
                quitarPlato={quitarPlato}
                guardarMenu={guardarMenu}
                subirMenuArchivo={(restauranteId, archivo) =>
                  void subirMenuArchivo(restauranteId, archivo)
                }
                progresoMenu={progresoMenu}
                cancelarReserva={(reserva) => void cancelarReserva(reserva)}
                guardarDisponibilidad={(id, configuracion) =>
                  void guardarDisponibilidad(id, configuracion)
                }
                cargando={cargando}
              />
            ) : (
              <>
                <FormularioPerfil
                  usuario={usuario}
                  nombre={nombreUsuario || usuario.displayName || ""}
                  cambiarNombre={setNombreUsuario}
                  apellido={apellidoUsuario}
                  cambiarApellido={setApellidoUsuario}
                  tratamiento={tratamientoUsuario}
                  cambiarTratamiento={setTratamientoUsuario}
                  fechaNacimiento={fechaNacimiento}
                  cambiarFechaNacimiento={setFechaNacimiento}
                  mostrarDatosComensal
                  telefono={telefono}
                  cambiarTelefono={setTelefono}
                  foto={fotoPerfilPrevia || fotoPerfil || usuario.photoURL || ""}
                  cambiarFoto={cambiarFoto}
                  guardar={guardarPerfil}
                  cargando={cargando}
                />
                <ReservasUsuario
                  reservas={reservasPerfil}
                  cargando={reservasCargando}
                />
                <section className="favoritos-usuario">
                  <div className="titulo-estadistica">
                    <span>Mis restaurantes favoritos</span>
                    <small>Administra los lugares que guardaste</small>
                  </div>
                  {favoritos.length === 0 ? (
                    <p className="aviso">
                      Aún no guardaste restaurantes favoritos. Usa el corazón
                      en cualquier restaurante para añadirlo.
                    </p>
                  ) : (
                    <div className="lista-favoritos">
                      {favoritos.flatMap((id) => {
                        const restaurante = restaurantesVisibles.find(
                          (actual) => String(actual.id) === String(id),
                        );
                        if (!restaurante) return [];
                        return (
                          <article
                            className="restaurante-favorito"
                            key={restaurante.id}
                          >
                            <button
                              className="restaurante-favorito-enlace"
                              type="button"
                              onClick={() => abrirDetalleRestaurante(restaurante)}
                            >
                              <strong>{restaurante.nombre}</strong>
                              <span>
                                {restaurante.categoria} · {restaurante.locacion}
                              </span>
                            </button>
                            <button
                              className="quitar-favorito"
                              type="button"
                              onClick={() => alternarFavorito(restaurante.id)}
                              aria-label={`Quitar ${restaurante.nombre} de favoritos`}
                            >
                              Quitar
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}
            {usuario &&
              ((vista === "perfil-usuario" && tipoUsuario === "usuario") ||
                (vista === "perfil-restaurante" &&
                  tipoUsuario === "restaurante")) && (
                <section className="eliminar-cuenta">
                  <h3>Eliminar cuenta</h3>
                  <p>
                    {tipoUsuario === "restaurante"
                      ? "Esta acción es permanente. Se eliminarán tu cuenta, tu perfil, tus restaurantes, sus menús y certificados, además de las reservas asociadas."
                      : "Esta acción es permanente. Se eliminarán tu cuenta, tu perfil y tus reservas personales."}
                  </p>
                  {!confirmandoEliminacion ? (
                    <button
                      className="boton-eliminar-cuenta"
                      type="button"
                      onClick={() => {
                        setMensaje("");
                        setConfirmandoEliminacion(true);
                      }}
                    >
                      Eliminar mi cuenta
                    </button>
                  ) : (
                    <div className="confirmacion-eliminar-cuenta">
                      {usuario.providerData.some(
                        (proveedor) =>
                          proveedor.providerId === EmailAuthProvider.PROVIDER_ID,
                      ) ? (
                        <label>
                          Confirma tu contraseña actual
                          <input
                            type="password"
                            autoComplete="current-password"
                            value={contraseñaEliminacion}
                            onChange={(evento) =>
                              setContraseñaEliminacion(evento.target.value)
                            }
                            disabled={cargando}
                          />
                        </label>
                      ) : (
                        <p>
                          Se abrirá Google para verificar tu identidad antes de
                          borrar la cuenta.
                        </p>
                      )}
                      <div>
                        <button
                          className="boton boton-vino"
                          type="button"
                          onClick={() => void eliminarCuenta()}
                          disabled={cargando}
                        >
                          {cargando
                            ? "Eliminando..."
                            : "Confirmar eliminación"}
                        </button>
                        <button
                          className="boton-texto"
                          type="button"
                          onClick={() => {
                            setConfirmandoEliminacion(false);
                            setContraseñaEliminacion("");
                            setMensaje("");
                          }}
                          disabled={cargando}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}
            {mensaje && <p className="mensaje-modal perfil-mensaje" role="status">{mensaje}</p>}
          </section>
        )}
      </main>
      <footer>
        <span className="marca-footer">Silla Libre</span>
        <span>Hecho para comer bien y vivir mejor.</span>
        <div className="contacto-footer">
          <strong>Contáctenos</strong>
          <a href="mailto:essillalibre@gmail.com">essillalibre@gmail.com</a>
        </div>
        <span>Esta aplicación fue creada por Ronald Lopez y Andres Castillo.</span>
        <span>© 2026 Silla Libre</span>
      </footer>
      {modal && (
        <div
          className="fondo-modal"
          role="presentation"
          onMouseDown={(evento) =>
            evento.target === evento.currentTarget && setModal(null)
          }
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal"
          >
            <button
              className="cerrar-modal"
              onClick={() => setModal(null)}
              aria-label="Cerrar"
            >
              ×
            </button>
            {modal === "acceso" && (
              <>
                <div className="encabezado-modal">
                  <span className="icono-modal">✦</span>
                  <p className="sobretitulo oscuro">BIENVENIDO A SILLA LIBRE</p>
                  <h2>{esRegistro ? "Crea tu cuenta" : "Qué bueno verte."}</h2>
                  <p>
                    {tipoCuenta === "restaurante"
                        ? "Registra tu cuenta y administra los menús de tus restaurantes desde tu perfil."
                      : "Guarda tus lugares favoritos y reserva en segundos."}
                  </p>
                </div>
                <div className="pestanas-modal">
                  <button
                    className={tipoCuenta === "usuario" ? "seleccionada" : ""}
                    onClick={() => setTipoCuenta("usuario")}
                  >
                    Soy comensal
                  </button>
                  <button
                    className={
                      tipoCuenta === "restaurante" ? "seleccionada" : ""
                    }
                    onClick={() => setTipoCuenta("restaurante")}
                  >
                    Soy restaurante
                  </button>
                </div>
                <form onSubmit={gestionarAcceso} className="formulario">
                  {esRegistro && (
                    <label>
                      Nombre de usuario
                      <input
                        type="text"
                        value={nombreUsuario}
                        onChange={(e) => setNombreUsuario(e.target.value)}
                        required
                        placeholder="Ej. mariana23"
                      />
                    </label>
                  )}
                  {esRegistro && tipoCuenta === "restaurante" && (
                    <>
                      <div className="separador-formulario">
                        <span>DATOS DEL RESTAURANTE</span>
                      </div>
                      <label>
                        Nombre del restaurante
                        <input
                          value={formularioRestaurante.nombre}
                          onChange={(evento) =>
                            setFormularioRestaurante({
                              ...formularioRestaurante,
                              nombre: evento.target.value,
                            })
                          }
                          required
                          placeholder="Ej. Casa M"
                        />
                      </label>
                      <label>
                        Dirección del restaurante
                        <input
                          value={formularioRestaurante.direccion}
                          onChange={(evento) =>
                            setFormularioRestaurante({
                              ...formularioRestaurante,
                              direccion: evento.target.value,
                            })
                          }
                          required
                          placeholder="Calle, número y ciudad"
                        />
                      </label>
                      <label>
                        Tipo de comida
                        <input
                          value={formularioRestaurante.comida}
                          onChange={(evento) =>
                            setFormularioRestaurante({
                              ...formularioRestaurante,
                              comida: evento.target.value,
                            })
                          }
                          required
                          placeholder="Ej. Cocina colombiana"
                        />
                      </label>
                      <label className="carga-archivo">
                        Certificado de funcionamiento del restaurante
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          onChange={(evento) =>
                            setFormularioRestaurante({
                              ...formularioRestaurante,
                              certificado:
                                evento.target.files?.[0] ?? null,
                            })
                          }
                          required
                        />
                        <span>
                          {formularioRestaurante.certificado?.name ??
                            "Sube un PDF o una imagen"}
                        </span>
                      </label>
                    </>
                  )}
                  <label>
                    Correo electrónico
                    <input
                      type="email"
                      value={correo}
                      onChange={(e) => setCorreo(e.target.value)}
                      required
                      placeholder="tu@correo.com"
                    />
                  </label>
                  <label>
                    Contraseña
                    <input
                      type="password"
                      minLength={6}
                      value={contraseña}
                      onChange={(e) => setContraseña(e.target.value)}
                      required
                      placeholder="Mínimo 6 caracteres"
                    />
                  </label>
                  <button
                    className="boton boton-vino boton-formulario"
                    disabled={cargando}
                  >
                    {cargando
                      ? "Procesando..."
                      : esRegistro
                        ? "Crear mi cuenta"
                        : "Iniciar sesión"}
                  </button>
                </form>
                {!esRegistro && (
                  <>
                    <button
                      className="enlace-recuperacion"
                      type="button"
                      onClick={() => void recuperarContraseña()}
                      disabled={cargando}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                    <p className="enlace-registro">
                      ¿No tienes cuenta?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setMensaje("");
                          setEsRegistro(true);
                        }}
                      >
                        Crear cuenta
                      </button>
                    </p>
                  </>
                )}
                {tipoCuenta === "usuario" && (
                  <>
                    <div className="separador-google">
                      <span>o continúa con</span>
                    </div>
                    <button
                      className="boton-google"
                      type="button"
                      onClick={iniciarSesionConGoogle}
                      disabled={cargando}
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 48 48"
                        focusable="false"
                      >
                        <path
                          fill="#4285F4"
                          d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.9Z"
                        />
                        <path
                          fill="#34A853"
                          d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.9-3.6-11.5-8.4H5.7v5.2A20 20 0 0 0 24 44Z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M12.5 27.8a12 12 0 0 1 0-7.6V15H5.7a20 20 0 0 0 0 18Z"
                        />
                        <path
                          fill="#EA4335"
                          d="M24 11.8c3 0 5.7 1 7.8 3l5.8-5.8A19.5 19.5 0 0 0 24 4 20 20 0 0 0 5.7 15l6.8 5.2c1.6-4.8 6.2-8.4 11.5-8.4Z"
                        />
                      </svg>
                      Continuar con Google
                    </button>
                  </>
                )}
              </>
            )}
            {modal === "reserva" && (
              <>
                <div className="encabezado-modal">
                  <span className="icono-modal">✦</span>
                  <p className="sobretitulo oscuro">RESERVA TU MOMENTO</p>
                  <h2>Tu mesa en {restauranteActivo.nombre}.</h2>
                  <p>
                    Completa los datos y recibirás la confirmación en tu correo.
                  </p>
                </div>
                <form onSubmit={confirmarReserva} className="formulario">
                  <div className="campos-dobles">
                    <label>
                      Fecha
                      <input
                        type="date"
                        min={new Date().toLocaleDateString("en-CA")}
                        value={reserva.fecha}
                        onChange={(e) =>
                          setReserva({ ...reserva, fecha: e.target.value })
                        }
                        required
                      />
                    </label>
                    <label>
                      Hora
                      <input
                        type="time"
                        step={3600}
                        value={reserva.hora}
                        min={
                          restauranteActivo.id === 1
                            ? "12:30"
                            : restauranteActivo.id === 2
                              ? "12:00"
                              : undefined
                        }
                        max={
                          restauranteActivo.id === 1 || restauranteActivo.id === 2
                            ? "23:00"
                            : undefined
                        }
                        onChange={(e) =>
                          setReserva({ ...reserva, hora: e.target.value })
                        }
                        required
                      />
                      {restauranteActivo.id === 1 && (
                        <small>Horario de Osaka Nikkei: 12:30 p. m. – 11:00 p. m.</small>
                      )}
                      {restauranteActivo.id === 2 && (
                        <small>Horario de DonDoh Bogotá: 12:00 p. m. – 11:00 p. m.</small>
                      )}
                      {disponibilidadActiva && (
                        <small
                          className={
                            turnoNoDisponible
                              ? "estado-disponibilidad cerrado"
                              : "estado-disponibilidad"
                          }
                          aria-live="polite"
                        >
                          {fechaBloqueada
                            ? "El restaurante no abre en la fecha seleccionada."
                            : !reserva.fecha || !reserva.hora
                              ? `${disponibilidadActiva.mesasPorTurno} mesas por turno.`
                              : turnoSinMesas
                                ? "Turno completo; no quedan mesas."
                                : `${mesasRestantes} ${
                                    mesasRestantes === 1 ? "mesa disponible" : "mesas disponibles"
                                  } en tiempo real.`}
                        </small>
                      )}
                    </label>
                  </div>
                  <label>
                    Número de personas
                    <select
                      value={reserva.personas}
                      onChange={(e) =>
                        setReserva({ ...reserva, personas: e.target.value })
                      }
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((numero) => (
                        <option key={numero} value={numero}>
                          {numero} {numero === 1 ? "persona" : "personas"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Correo de confirmación
                    <input
                      type="email"
                      value={usuario?.email ?? correo}
                      onChange={(e) => setCorreo(e.target.value)}
                      required
                      placeholder="tu@correo.com"
                    />
                  </label>
                  <button
                    className="boton boton-vino boton-formulario"
                    disabled={cargando || turnoNoDisponible}
                  >
                    {cargando ? "Confirmando..." : "Confirmar reserva ↗"}
                  </button>
                </form>
              </>
            )}
            {mensaje && (
              <p className="mensaje-modal" role="status">
                {mensaje}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FormularioRestaurante({
  datos,
  cambiar,
  enviar,
  cargando,
}: {
  datos: FormularioRestaurante;
  cambiar: (datos: FormularioRestaurante) => void;
  enviar: (evento: React.FormEvent<HTMLFormElement>) => void;
  cargando: boolean;
}) {
  return (
    <form onSubmit={enviar} className="formulario formulario-restaurante">
      <div className="separador-formulario">
        <span>DATOS DEL RESTAURANTE</span>
      </div>
      <label>
        Nombre del restaurante
        <input
          value={datos.nombre}
          onChange={(e) => cambiar({ ...datos, nombre: e.target.value })}
          required
          placeholder="Ej. Casa M"
        />
      </label>
      <label>
        Dirección
        <input
          value={datos.direccion}
          onChange={(e) => cambiar({ ...datos, direccion: e.target.value })}
          required
          placeholder="Calle, número y ciudad"
        />
      </label>
      <label>
        Tipo de comida
        <input
          value={datos.comida}
          onChange={(e) => cambiar({ ...datos, comida: e.target.value })}
          required
          placeholder="Ej. Cocina colombiana"
        />
      </label>
      <label className="carga-archivo">
        Certificado de salubridad
        <input
          type="file"
          accept="application/pdf,image/*"
          onChange={(e) =>
            cambiar({ ...datos, certificado: e.target.files?.[0] ?? null })
          }
          required
        />
        <span>
          {datos.certificado
            ? datos.certificado.name
            : "Sube PDF o imagen · máximo 10 MB"}
        </span>
      </label>
      <button className="boton boton-vino boton-formulario" disabled={cargando}>
        {cargando ? "Enviando..." : "Enviar restaurante ↗"}
      </button>
    </form>
  );
}

export default App;
