import type { Restaurante } from "../tipos/restaurantes";

export const restaurantes: Restaurante [] = [
    {
        id: 1,
        nombre: "Osaka Nikkei",
        categoria: "Cocina Nikkei",
        locacion: "Zona T",
        rangoprecios: "$$$$",
        rating: 4.7,
        cantidadResenasBase: 5200,
        horario: "Todos los días: 12:30 p. m.–11:00 p. m.",
        imagen: "/imagenes/restaurantes/osaka.png",
        descripcion: 
            "Una experiencia que una la precisión de la cocina japonesa con los sabores de Perú.",
        urlreserva: "https://osakanikkei.com/bogota/",
        urlMenu: "https://elemento4kcol-my.sharepoint.com/personal/alejandra_duran_elemento4k_com/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Falejandra%5Fduran%5Felemento4k%5Fcom%2FDocuments%2FCartas%20Actualizadas%2FOsaka%2FComida%2FOsk%5FCartaPrincipal%5FESP%20ENE%2026%2Epdf&parent=%2Fpersonal%2Falejandra%5Fduran%5Felemento4k%5Fcom%2FDocuments%2FCartas%20Actualizadas%2FOsaka%2FComida&ga=1&share=cQqYcWzUTiKXQLYkT8RdFUujEgUCKRufWa8kmsMToz3DiP1_Nw",
    },

    {
        id: 2,
        nombre: "DonDoh Bogotá",
        categoria: "Parrilla japonesa",
        locacion: "Chapinero",
        rangoprecios: "$$$",
        rating: 4.6,
        cantidadResenasBase: 700,
        horario: "Todos los días: 12:00 p. m.–11:00 p. m.",
        imagen: "/imagenes/restaurantes/dondoh.jpg",
        descripcion: 
            "Experiencia japonesa centrada en la robata, con carnes, pescados y mariscos a la parrilla.",
        urlreserva: "https://dondoh.com/bogota/",
        urlMenu: "https://elemento4kcol-my.sharepoint.com/personal/alejandra_duran_elemento4k_com/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Falejandra_duran_elemento4k_com%2FDocuments%2FCartas%20Actualizadas%2FDonDoh%2FComida%2FDonDohEsp%20%2D%20ENE%2026%2Epdf&parent=%2Fpersonal%2Falejandra_duran_elemento4k_com%2FDocuments%2FCartas%20Actualizadas%2FDonDoh%2FComida&ga=1&share=cQqczxgcpGVnR6fSDEhu7CktEgUCpXD7Qu0hXl9M%2Dsqw6415sw",
    },

    {
        id: 3,
        nombre: "Veccina",
        categoria: "Cocina italiana",
        locacion: "Chicó",
        rangoprecios: "$$$",
        rating: 4.5,
        cantidadResenasBase: 1000,
        horario: "Domingo a jueves: 12:00–9:00 p. m.; viernes: 12:00–11:00 p. m.; sábado: 12:00–10:00 p. m.; lunes y festivos: 12:00–5:00 p. m.",
        imagen: "/imagenes/restaurantes/viccina.jpg",
        descripcion: 
            "Cocina italiana moderna con pizzas, pastas y preparaciones a la parrilla.",
        urlreserva: "https://takami.co/veccina/",
        urlMenu: "https://s3.amazonaws.com/takami.co/brandbutton/ab6212064fd44e2a881806c22aaf8a2f/veccina_menu_espanol.pdf",
    },
];