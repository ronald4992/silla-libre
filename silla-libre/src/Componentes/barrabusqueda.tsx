function Barrabusqueda() {
    return(
        <div className="barra-busqueda">

            <div className="campo-busqueda">
                <span>🔍</span>

                <input 
                type="text" 
                placeholder="Busca un restaurante..."
                />
            </div>

            <button className="boton-busqueda ">
                Buscar
            </button>

        </div>
    )
}

export default Barrabusqueda;