function Barranavegacion() {
    return(
        <header className="barra-navegacion">
            <div className="logo">
                <img
                    src="/logo.png"
                    alt="Logo de Silla Libre"
                    className="logo-proyecto"
                />
                <div className="nombre-proyecto">
                    <h1>Silla Libre</h1>
                    <span>Experiencias gastronómicas</span>
                </div>
            </div>


            <nav className="navegacion">
                <a href="#inicio">Inicio</a>
                <a href="#restaurantes">Restaurantes</a>
                <a href="#reservas">Reservas</a>
                <a href="#Nosotros">Nosotros</a>
            </nav>

            <div className="boton-barra-navegacion">
                <button className="boton-inicio-sesion">
                    Iniciar sesión
                </button>

                <button className="boton-registro">
                    Registrarse
                </button>
            </div>
        </header>
    )
}

export default Barranavegacion;