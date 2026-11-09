/** Listas de opções compartilhadas entre telas e server actions (arquivos "use server" não podem exportar constantes). */
export const HABIT_ICONS = ["droplet", "yoga", "book", "palette", "moon", "run", "apple", "heart", "sun", "leaf", "music", "notebook", "check"] as const;
export const MEALS = [{ value: "cafe", label: "Café da manhã" }, { value: "almoco", label: "Almoço" }, { value: "jantar", label: "Jantar" }, { value: "lanche", label: "Lanche" }] as const;
export const WORKOUTS = ["Caminhada", "Corrida", "Yoga", "Musculação", "Ciclismo", "Natação", "Dança", "Alongamento", "Outro"] as const;

export const ACTIVITY_ICONS = [
  { value: "brush", label: "Desenho" }, { value: "gamepad", label: "Jogos" }, { value: "walk", label: "Caminhar" }, { value: "run", label: "Correr" }, { value: "book", label: "Ler" },
  { value: "music", label: "Música" }, { value: "camera", label: "Fotografia" }, { value: "kitchen", label: "Cozinhar" }, { value: "yoga", label: "Yoga" }, { value: "bike", label: "Bicicleta" },
  { value: "palette", label: "Pintura" }, { value: "notebook", label: "Escrever" }, { value: "plant", label: "Plantas" }, { value: "movie", label: "Filmes" }, { value: "coffee", label: "Café" }, { value: "star", label: "Outro" },
] as const;
export const ENERGY = [{ value: "baixa", label: "Baixa" }, { value: "media", label: "Média" }, { value: "alta", label: "Alta" }] as const;
export const SCREEN = [{ value: "sem_tela", label: "Sem tela" }, { value: "com_tela", label: "Com tela" }] as const;
export const MEDIA_KINDS = [{ value: "filme", label: "Filmes" }, { value: "serie", label: "Séries" }, { value: "jogo", label: "Jogos" }, { value: "anime", label: "Animes" }] as const;
export const MEDIA_STATUS = [{ value: "quero", label: "Quero ver" }, { value: "em_andamento", label: "Em andamento" }, { value: "concluido", label: "Concluído" }] as const;
export const AUDIO_KINDS = [{ value: "album", label: "Álbum" }, { value: "artista", label: "Artista" }, { value: "musica", label: "Música" }, { value: "podcast", label: "Podcast" }] as const;
export const MOODS = [{ value: "", label: "Qualquer humor" }, { value: "calmo", label: "Calmo" }, { value: "animado", label: "Animado" }, { value: "focado", label: "Focado" }, { value: "nostalgico", label: "Nostálgico" }] as const;

export const CATEGORY_COLORS: Record<string, { label: string; hex: string }> = {
  pink: { label: "Rosa", hex: "#e86f9f" }, sage: { label: "Verde", hex: "#82ab73" }, sun: { label: "Amarelo", hex: "#f2c534" }, lavender: { label: "Lavanda", hex: "#a47ddb" },
  coral: { label: "Coral", hex: "#f08a5d" }, sky: { label: "Azul", hex: "#6fb1d9" }, teal: { label: "Turquesa", hex: "#5bb5a2" }, plum: { label: "Ameixa", hex: "#8f4570" },
};
export const CATEGORY_ICONS = [
  { value: "home", label: "Casa" }, { value: "salad", label: "Alimentação" }, { value: "bus", label: "Transporte" }, { value: "music", label: "Lazer" }, { value: "heart", label: "Saúde" },
  { value: "cart", label: "Compras" }, { value: "book", label: "Estudos" }, { value: "gift", label: "Presentes" }, { value: "plane", label: "Viagem" }, { value: "coffee", label: "Café" }, { value: "shirt", label: "Roupas" }, { value: "wallet", label: "Outros" },
] as const;

export const CREATIVE_KINDS = [{ value: "desenho", label: "Desenho" }, { value: "escrita", label: "Escrita" }, { value: "programacao", label: "Programação" }, { value: "artesanato", label: "Artesanato" }, { value: "fotografia", label: "Fotografia" }, { value: "outro", label: "Outro" }] as const;
export const CHALLENGES = [
  "Desenhe uma janela para um lugar imaginário", "Escreva uma cena de 100 palavras sobre o primeiro dia de chuva", "Fotografe algo verde que você nunca tinha notado",
  "Faça um mini zine de 4 páginas sobre o seu dia", "Desenhe um objeto usando só 5 linhas", "Escreva uma carta para você daqui a um ano",
  "Monte uma colagem com as cores de um pôr do sol", "Transforme sua música favorita em um poema", "Crie um personagem a partir de um objeto da sua mesa", "Programe algo pequeno e inútil, só por diversão",
];
