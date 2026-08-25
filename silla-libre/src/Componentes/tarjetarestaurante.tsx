import type { Restaurante } from "../tipos/restaurantes";

interface accesoriotarjetas {
    restaurante: Restaurante;
}

function Tarjetarestaurante ({ restaurante}: accesoriotarjetas) {
    return (
        <article className="tarjeta-restaurante">

            <div className="imagen-restaurante">

                <img 
                src={restaurante.imagen} 
                alt={`Restaurante ${restaurante.nombre}`} 
                />

                <span className="categoria-restaurante">
                    {restaurante.categoria}
                </span>

            </div>

            <div className="contenido-restaurante">

                <h3>
                    {restaurante.nombre}
                </h3>

                <p className="locacion-restaurante">
                  📍  {restaurante.locacion}, Bogotá
                </p>

                <p className="descripcion-restaurante">
                    {restaurante.descripcion}
                </p>

                <div className="informacion-restaurante">

                    <span className="rating-restaurante">
                        ⭐ {restaurante.rating}
                    </span>

                    <span className="precio-restaurante">
                       desde ${restaurante.rangoprecios.toLocaleString()}
                    </span>

                    <span className="tipo-restaurante">
                        Alta gastronomía
                    </span>

                </div>

                <a 
                href= {restaurante.urlreserva}
                target="_blank"
                rel="noopener noreferrer"
                className="boton-reserva"
                >
                    Reservar mesa
                </a>

            </div>

        </article>
    )
}

export default Tarjetarestaurante