import { useEffect, useMemo, useRef, useState } from "react";
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { restaurantes } from "./datos/restaurante";
import { autenticacion, almacenamiento, baseDatos, firebaseDisponible } from "./servicios/firebase";
import { avisarReserva, crearEventoCalendario, type DatosReserva } from "./servicios/reservas";

type Pestaña = "inicio" | "restaurantes" | "reservas";
type TipoCuenta = "usuario" | "restaurante";
type Modal = "acceso" | "reserva" | null;
interface FormularioReserva { fecha: string; hora: string; personas: string; }
interface FormularioRestaurante { nombre: string; direccion: string; comida: string; certificado: File | null; }
const reservaInicial: FormularioReserva = { fecha: "", hora: "", personas: "2" };
const restauranteInicial: FormularioRestaurante = { nombre: "", direccion: "", comida: "", certificado: null };

function App() {
  const [pestaña, setPestaña] = useState<Pestaña>("inicio");
  const [modal, setModal] = useState<Modal>(null);
  const [tipoCuenta, setTipoCuenta] = useState<TipoCuenta>("usuario");
  const [esRegistro, setEsRegistro] = useState(false);
  const [correo, setCorreo] = useState("");
  const [contraseña, setContraseña] = useState("");
  const [usuario, setUsuario] = useState<User | null>(null);
  const [reserva, setReserva] = useState<FormularioReserva>(reservaInicial);
  const [restauranteActivo, setRestauranteActivo] = useState(restaurantes[0]);
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [formularioRestaurante, setFormularioRestaurante] = useState(restauranteInicial);

  useEffect(() => { if (!autenticacion) return; return onAuthStateChanged(autenticacion, setUsuario); }, []);
  const restaurantesFiltrados = useMemo(() => restaurantes.filter((restaurante) => {
    const texto = busqueda.toLowerCase().trim();
    const coincideTexto = [restaurante.nombre, restaurante.categoria, restaurante.locacion].join(" ").toLowerCase().includes(texto);
    return coincideTexto && (categoria === "Todas" || restaurante.categoria === categoria);
  }), [busqueda, categoria]);
  const mostrarAcceso = (registro = false, cuenta: TipoCuenta = "usuario") => { setEsRegistro(registro); setTipoCuenta(cuenta); setMensaje(""); setModal("acceso"); };
  const navegar = (destino: Pestaña) => { setPestaña(destino); document.getElementById(destino)?.scrollIntoView({ behavior: "smooth" }); };

  const gestionarAcceso = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault(); setCargando(true); setMensaje("");
    try {
      if (!autenticacion) setMensaje("Modo demostración activo. Añade las variables de Firebase para habilitar tu cuenta.");
      else if (esRegistro) { await createUserWithEmailAndPassword(autenticacion, correo, contraseña); setMensaje("Tu cuenta fue creada correctamente."); }
      else { await signInWithEmailAndPassword(autenticacion, correo, contraseña); setModal(null); }
    } catch { setMensaje("No pudimos completar el acceso. Revisa tu correo y contraseña."); } finally { setCargando(false); }
  };
  const registrarRestaurante = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!formularioRestaurante.certificado) { setMensaje("Adjunta el certificado de salubridad para continuar."); return; }
    setCargando(true);
    try {
      let urlCertificado = "";
      if (almacenamiento && usuario) { const referencia = ref(almacenamiento, `certificados/${usuario.uid}/${formularioRestaurante.certificado.name}`); await uploadBytes(referencia, formularioRestaurante.certificado); urlCertificado = await getDownloadURL(referencia); }
      if (baseDatos && usuario) await addDoc(collection(baseDatos, "restaurantes"), { ...formularioRestaurante, certificado: urlCertificado, propietario: usuario.uid, creadoEn: serverTimestamp() });
      setMensaje(firebaseDisponible ? "Restaurante enviado para revisión." : "Restaurante guardado en modo demostración."); setFormularioRestaurante(restauranteInicial);
    } catch { setMensaje("No pudimos guardar el restaurante. Inténtalo de nuevo."); } finally { setCargando(false); }
  };
  const abrirReserva = (restaurante = restaurantes[0]) => { setRestauranteActivo(restaurante); setMensaje(""); setModal("reserva"); };
  const confirmarReserva = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const datos: DatosReserva = { restaurante: restauranteActivo.nombre, fecha: reserva.fecha, hora: reserva.hora, personas: Number(reserva.personas), correo: usuario?.email ?? correo };
    setCargando(true);
    try { if (baseDatos) await addDoc(collection(baseDatos, "reservas"), { ...datos, usuario: usuario?.uid ?? "invitado", creadoEn: serverTimestamp() }); crearEventoCalendario(datos); await avisarReserva(datos).catch(() => undefined); setReserva(reservaInicial); setMensaje("Reserva confirmada. Descargamos el evento para tu calendario."); }
    catch { setMensaje("No pudimos confirmar la reserva. Revisa los datos e inténtalo nuevamente."); } finally { setCargando(false); }
  };

  return <div className="aplicacion">
    <header className="barra-navegacion"><button className="marca" onClick={() => navegar("inicio")} aria-label="Volver al inicio"><img src="/logo.png" alt="Silla Libre" className="logo-imagen" /><span><strong>Silla Libre</strong><small>Tu mesa, a tu manera</small></span></button><nav className="navegacion" aria-label="Navegación principal"><button className={pestaña === "inicio" ? "activo" : ""} onClick={() => navegar("inicio")}>Inicio</button><button className={pestaña === "restaurantes" ? "activo" : ""} onClick={() => navegar("restaurantes")}>Explorar</button><button className={pestaña === "reservas" ? "activo" : ""} onClick={() => navegar("reservas")}>Mis reservas</button></nav><div className="acciones-navegacion">{usuario ? <button className="perfil" onClick={() => signOut(autenticacion!)}><span>{usuario.email?.slice(0, 1).toUpperCase()}</span> {usuario.email}</button> : <button className="enlace-boton" onClick={() => mostrarAcceso()}>Iniciar sesión</button>}<button className="boton boton-dorado" onClick={() => mostrarAcceso(true)}>Crear cuenta</button></div></header>
    <main>
      <section className="hero" id="inicio"><div className="hero-contenido"><p className="sobretitulo">BOGOTÁ · EXPERIENCIAS QUE PERMANECEN</p><h1>Una mesa especial<br /><em>empieza aquí.</em></h1><p className="hero-descripcion">Descubre lugares con alma, reserva sin vueltas y convierte cualquier comida en un buen recuerdo.</p><div className="hero-acciones"><button className="boton boton-dorado grande" onClick={() => navegar("restaurantes")}>Explorar restaurantes <span>↗</span></button><button className="boton boton-transparente" onClick={() => mostrarAcceso(true, "restaurante")}>Soy restaurante</button></div></div><div className="hero-imagen"><div className="hero-foto" role="img" aria-label="Mesa elegante de restaurante"></div><div className="nota-hero"><span>✦</span><strong>Selección Silla Libre</strong><small>Curaduría local, cada semana</small></div></div></section>
      <section className="buscador-seccion" id="restaurantes"><div className="encabezado-seccion"><div><p className="sobretitulo oscuro">ENCUENTRA TU PRÓXIMO LUGAR</p><h2>Donde quieres estar<br /><em>hoy.</em></h2></div><p className="texto-seccion">De la cena improvisada a esa ocasión que merece algo más. Filtra, compara y reserva en minutos.</p></div><div className="buscador"><span className="icono">⌕</span><input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Busca por nombre, cocina o zona..." /><select value={categoria} onChange={(e) => setCategoria(e.target.value)}><option>Todas</option><option>Cocina Nikkei</option><option>Parrilla japonesa</option><option>Cocina italiana</option></select><button className="boton boton-vino" onClick={() => navegar("restaurantes")}>Buscar</button></div><div className="etiquetas"><span>Explora por:</span><button onClick={() => setCategoria("Cocina Nikkei")}>Japonesa</button><button onClick={() => setCategoria("Cocina italiana")}>Italiana</button><button onClick={() => setBusqueda("Chapinero")}>Chapinero</button><button onClick={() => setBusqueda("Zona T")}>Zona T</button></div></section>
      <section className="listado" aria-labelledby="titulo-restaurantes"><div className="encabezado-listado"><div><span className="contador">{restaurantesFiltrados.length} lugares encontrados</span><h2 id="titulo-restaurantes">Una buena idea para <em>esta noche.</em></h2></div><button className="boton-texto" onClick={() => { setBusqueda(""); setCategoria("Todas"); }}>Ver todos <span>→</span></button></div><div className="tarjetas">{restaurantesFiltrados.map((restaurante) => <article className="tarjeta-restaurante" key={restaurante.id}><div className="imagen-tarjeta"><img src={restaurante.imagen} alt={`Interior de ${restaurante.nombre}`} /><span className="etiqueta-categoria">{restaurante.categoria}</span><button className="favorito" aria-label={`Guardar ${restaurante.nombre}`}>♡</button></div><div className="contenido-tarjeta"><div className="fila-tarjeta"><h3>{restaurante.nombre}</h3><span className="calificacion">★ {restaurante.rating}</span></div><p className="ubicacion">⌖ {restaurante.locacion}, Bogotá <span>·</span> {restaurante.rangoprecios}</p><p>{restaurante.descripcion}</p><button className="reservar-enlace" onClick={() => abrirReserva(restaurante)}>Reservar mesa <span>↗</span></button></div></article>)}</div></section>
      <section className="mapa-seccion"><div><p className="sobretitulo oscuro">CERCA DE TI</p><h2>La ciudad también<br /><em>se saborea.</em></h2><p className="texto-seccion">Encuentra tu próxima mesa, descubre nuevas zonas y deja que Bogotá te sorprenda.</p><button className="boton boton-vino" onClick={() => abrirReserva(restaurantes[0])}>Ver restaurantes cercanos ↗</button></div><Mapa /></section>
      <section className="cta-restaurante"><div><p className="sobretitulo">PARA QUIENES HACEN LA EXPERIENCIA</p><h2>Tu cocina merece<br /><em>una mesa llena.</em></h2><p>Únete a Silla Libre y deja que más personas descubran lo que haces mejor.</p></div><button className="boton boton-dorado grande" onClick={() => mostrarAcceso(true, "restaurante")}>Registrar mi restaurante <span>↗</span></button></section>
    </main><footer><span className="marca-footer">Silla Libre</span><span>Hecho para comer bien y vivir mejor.</span><span>© 2026 Silla Libre</span></footer>
    {modal && <div className="fondo-modal" role="presentation" onMouseDown={(evento) => evento.target === evento.currentTarget && setModal(null)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-modal"><button className="cerrar-modal" onClick={() => setModal(null)} aria-label="Cerrar">×</button>{modal === "acceso" && <><div className="encabezado-modal"><span className="icono-modal">✦</span><p className="sobretitulo oscuro">BIENVENIDO A SILLA LIBRE</p><h2>{esRegistro ? "Crea tu cuenta" : "Qué bueno verte."}</h2><p>{tipoCuenta === "restaurante" ? "Registra tu negocio para comenzar a recibir reservas." : "Guarda tus lugares favoritos y reserva en segundos."}</p></div><div className="pestanas-modal"><button className={tipoCuenta === "usuario" ? "seleccionada" : ""} onClick={() => setTipoCuenta("usuario")}>Soy comensal</button><button className={tipoCuenta === "restaurante" ? "seleccionada" : ""} onClick={() => setTipoCuenta("restaurante")}>Soy restaurante</button></div><form onSubmit={gestionarAcceso} className="formulario">{tipoCuenta === "restaurante" && esRegistro && <p className="aviso">Después de crear tu cuenta podrás completar los datos y certificado de tu restaurante.</p>}<label>Correo electrónico<input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required placeholder="tu@correo.com" /></label><label>Contraseña<input type="password" minLength={6} value={contraseña} onChange={(e) => setContraseña(e.target.value)} required placeholder="Mínimo 6 caracteres" /></label><button className="boton boton-vino boton-formulario" disabled={cargando}>{cargando ? "Procesando..." : esRegistro ? "Crear mi cuenta" : "Iniciar sesión"}</button></form>{esRegistro && tipoCuenta === "restaurante" && <FormularioRestaurante datos={formularioRestaurante} cambiar={setFormularioRestaurante} enviar={registrarRestaurante} cargando={cargando} />}</>}{modal === "reserva" && <><div className="encabezado-modal"><span className="icono-modal">✦</span><p className="sobretitulo oscuro">RESERVA TU MOMENTO</p><h2>Tu mesa en {restauranteActivo.nombre}.</h2><p>Completa los datos y recibirás la confirmación en tu correo.</p></div><form onSubmit={confirmarReserva} className="formulario"><div className="campos-dobles"><label>Fecha<input type="date" value={reserva.fecha} onChange={(e) => setReserva({ ...reserva, fecha: e.target.value })} required /></label><label>Hora<input type="time" value={reserva.hora} onChange={(e) => setReserva({ ...reserva, hora: e.target.value })} required /></label></div><label>Número de personas<select value={reserva.personas} onChange={(e) => setReserva({ ...reserva, personas: e.target.value })}>{[1, 2, 3, 4, 5, 6, 7, 8].map((numero) => <option key={numero} value={numero}>{numero} {numero === 1 ? "persona" : "personas"}</option>)}</select></label><label>Correo de confirmación<input type="email" value={usuario?.email ?? correo} onChange={(e) => setCorreo(e.target.value)} required placeholder="tu@correo.com" /></label><button className="boton boton-vino boton-formulario" disabled={cargando}>{cargando ? "Confirmando..." : "Confirmar reserva ↗"}</button></form></>}{mensaje && <p className="mensaje-modal" role="status">{mensaje}</p>}</div></div>}
  </div>;
}

function FormularioRestaurante({ datos, cambiar, enviar, cargando }: { datos: FormularioRestaurante; cambiar: (datos: FormularioRestaurante) => void; enviar: (evento: React.FormEvent<HTMLFormElement>) => void; cargando: boolean }) {
  return <form onSubmit={enviar} className="formulario formulario-restaurante"><div className="separador-formulario"><span>DATOS DEL RESTAURANTE</span></div><label>Nombre del restaurante<input value={datos.nombre} onChange={(e) => cambiar({ ...datos, nombre: e.target.value })} required placeholder="Ej. Casa M" /></label><label>Dirección<input value={datos.direccion} onChange={(e) => cambiar({ ...datos, direccion: e.target.value })} required placeholder="Calle, número y ciudad" /></label><label>Tipo de comida<input value={datos.comida} onChange={(e) => cambiar({ ...datos, comida: e.target.value })} required placeholder="Ej. Cocina colombiana" /></label><label className="carga-archivo">Certificado de salubridad<input type="file" accept="application/pdf,image/*" onChange={(e) => cambiar({ ...datos, certificado: e.target.files?.[0] ?? null })} required /><span>{datos.certificado ? datos.certificado.name : "Sube PDF o imagen · máximo 10 MB"}</span></label><button className="boton boton-vino boton-formulario" disabled={cargando}>{cargando ? "Enviando..." : "Enviar restaurante ↗"}</button></form>;
}

function Mapa() {
  const referenciaMapa = useRef<HTMLDivElement>(null);
  useEffect(() => { const clave = import.meta.env.VITE_GOOGLE_MAPS_API_KEY; if (!clave || !referenciaMapa.current) return; const mostrarMapa = () => { if (!window.google || !referenciaMapa.current) return; const mapa = new window.google.maps.Map(referenciaMapa.current, { center: { lat: 4.667, lng: -74.056 }, zoom: 13, disableDefaultUI: true }); new window.google.maps.Marker({ position: { lat: 4.667, lng: -74.056 }, map: mapa, title: "Restaurantes Silla Libre" }); }; if (window.google) mostrarMapa(); else { const script = document.createElement("script"); script.src = `https://maps.googleapis.com/maps/api/js?key=${clave}`; script.async = true; script.onload = mostrarMapa; document.head.appendChild(script); } }, []);
  return <div className="mapa"><div ref={referenciaMapa} className="mapa-interactivo" /><div className="mapa-fallback"><span>⌖</span><strong>Zona T · Chapinero · Chicó</strong><small>Activa Google Maps para explorar</small></div></div>;
}

declare global { interface Window { google?: { maps: { Map: new (elemento: HTMLElement, opciones: Record<string, unknown>) => unknown; Marker: new (opciones: Record<string, unknown>) => unknown } } } }
export default App;