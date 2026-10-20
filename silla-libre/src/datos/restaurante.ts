import type { Restaurante } from "../tipos/restaurantes";

export const restaurantes: Restaurante [] = [
    {
        id: 1,
        nombre: "Osaka Nikkei",
        categoria: "Cocina Nikkei",
        locacion: "Zona T",
        rangoprecios: "$$$$",
        rating: 4.7,
        imagen: "/imagenes/restaurantes/osaka.png",
        descripcion: 
            "Una experiencia que una la precisión de la cocina japonesa con los sabores de Perú.",
        urlreserva: "https://osakanikkei.com/bogota/"
    },

    {
        id: 2,
        nombre: "DonDoh Bogotá",
        categoria: "Parrilla japonesa",
        locacion: "Chapinero",
        rangoprecios: "$$$",
        rating: 4.6,
        imagen: "/imagenes/restaurantes/dondoh.jpg",
        descripcion: 
            "Experiencia japonesa centrada en la robata, con carnes, pescados y mariscos a la parrilla.",
        urlreserva: "https://dondoh.com/bogota/"
    },

    {
        id: 3,
        nombre: "Veccina",
        categoria: "Cocina italiana",
        locacion: "Chicó",
        rangoprecios: "$$$",
        rating: 4.5,
        imagen: "/imagenes/restaurantes/viccina.jpg",
        descripcion: 
            "Cocina italiana moderna con pizzas, pastas y preparaciones a la parrilla.",
        urlreserva: "https://takami.co/veccina/"
    },
];