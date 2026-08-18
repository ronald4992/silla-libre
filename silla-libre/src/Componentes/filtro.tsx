function Filtro () {
    return (
        <section className="seccion-filtro">
            <div className="contenedor-filtro">
                <div className="titulo-filtro">
                <span>FILTRAR RESTAURANTES</span>
                <h2>Encuentra tu lugar ideal</h2>
                </div>
           </div>

           <div className="filtros">

                <div className="filtro">
                    <label htmlFor="locacion">
                        Ubicación
                    </label>

                    <select  id="locacion">
                        <option value="">
                            Todas las ubicaciones
                        </option>

                        <option value="zona-t">
                            Zona T
                        </option>
                        <option value="chapinero">
                            Chapinero
                        </option>
                        <option value="usaquen">
                            Usaquén
                        </option>
                        <option value="candelaria">
                            La Candelaria
                        </option>
                    </select>

                </div>

                <div className="filtro">

                    <label htmlFor="categoria">
                        Categoría
                    </label>

                    <select id="categoria">
                        
                        <option value="">
                            Todas las categorías
                        </option>
                         <option value="alta-cocina">
                            Alta cocina
                        </option>
                         <option value="internacional">
                            Cocina Internacional
                        </option>
                         <option value="colombiana">
                            Cocina Colombiana
                        </option>   

                    </select>                     

                </div>

                <div className="filtro">

                    <label htmlFor="precio">
                        Precio
                    </label>

                    <select  id="precio">

                        <option value="">
                            Cualquier Precio
                        </option>

                        <option value="1">
                            $ - Económico
                        </option>
                        <option value="2">
                            $$ - Moderado
                        </option>
                        <option value="3">
                            $$$ - Premium
                        </option>
                        <option value="4">
                            $$$$ - Alta Cocina
                        </option>
                    </select>

                </div>


                <div className="filtro">

                    <label htmlFor="clasificacion">
                        Calificación
                    </label>

                    <select  id="clasificacion">
                       
                       <option value="">
                        Cualquier calificaión
                       </option>
                       <option value="4">
                        ★ 4.0 o superior
                       </option>
                       <option value="4.5">
                        ★ 4.5 o superior
                       </option>
                       <option value="4.8">
                        ★ 4.8 o superior
                       </option>
                    </select>

                </div>

           </div>
        </section>
    )
}

export default Filtro;