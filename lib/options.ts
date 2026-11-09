/** Listas de opções compartilhadas entre telas e server actions (arquivos "use server" não podem exportar constantes). */
export const HABIT_ICONS = ["droplet", "yoga", "book", "palette", "moon", "run", "apple", "heart", "sun", "leaf", "music", "notebook", "check"] as const;
export const MEALS = [{ value: "cafe", label: "Café da manhã" }, { value: "almoco", label: "Almoço" }, { value: "jantar", label: "Jantar" }, { value: "lanche", label: "Lanche" }] as const;
export const WORKOUTS = ["Caminhada", "Corrida", "Yoga", "Musculação", "Ciclismo", "Natação", "Dança", "Alongamento", "Outro"] as const;
