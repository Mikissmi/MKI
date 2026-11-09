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
