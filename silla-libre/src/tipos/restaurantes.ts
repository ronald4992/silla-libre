export interface Restaurante {
    id: number | string;
    nombre: string;
    categoria: string;
    locacion: string;
    rangoprecios: string;
    rating: number;
    cantidadResenasBase?: number;
    horario?: string;
    imagen: string;
    descripcion: string;
    urlreserva: string;
    urlMenu?: string;
}