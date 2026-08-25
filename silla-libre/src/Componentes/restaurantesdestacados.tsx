import TarjetaRestaurante from "./tarjetarestaurante";
import { restaurantes } from "../datos/restaurante";

function RestaurantesDestacados() {
    return (
        <section className="seccion-restaurante" id="restaurantes"  >
            <div className="encabezado-restaurante">

                <span>
                    Descubre
                </span>

                <h2>
                    Restaurantes destacados
                </h2>

                <p>
                    Encuentra experiencias gastronómicas únicas en Bogotá.
                </p>

            </div>

            <div className="contenedor-tarjetas-restaurantes">
                {restaurantes.map((restaurante) => (
                    <TarjetaRestaurante 
                        key={restaurante.id} 
                        restaurante={restaurante} 
                    />
                ))}
            </div>
        </section>
    )
}

export default RestaurantesDestacados;