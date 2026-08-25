import type { Restaurante } from "../tipos/restaurantes";

export const restaurantes: Restaurante [] = [
    {
        id: 1,
        nombre: "Osaka Bogotá",
        categoria: "Cocina Nikkei",
        locacion: "Zona T",
        rangoprecios: "$$$$",
        rating: 4.7,
        imagen: "https://osakanikkei.com/wp-content/uploads/2026/07/osaka-restaurante-bogota-1.webp",
        descripcion: 
            "Una experiencia que una la precisión de la cocina japonesa con los sabores de Perú.",
        urlreserva: "https://osakanikkei.com/bogota/book/"
    },

    {
        id: 2,
        nombre: "DonDoh Bogotá",
        categoria: "Parrilla japonesa",
        locacion: "Chapinero",
        rangoprecios: "$$$",
        rating: 4.6,
        imagen : "https://dondoh.com/wp-content/uploads/2023/11/4-3.jpg",
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
        imagen : "https://s3.amazonaws.com/takami.co/CACHE/images/brandcarouselimage/e68bf0f207124d6abaef60cf3f90f833/k2uktshpb6uqttgnaw7ryv/2fd6f82d620109fbd409dd9c167814a8.jpg",
        descripcion: 
            "Cocina italiana moderna con pizzas, pastas y preparaciones a la parrilla.",
        urlreserva: "https://takami.co/veccina/"
    },
];