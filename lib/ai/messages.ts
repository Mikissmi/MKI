/** Textos para a pessoa entender por que a IA não respondeu (e o que fazer). */
export const AI_FAILURE_TEXT: Record<string, string> = {
  no_key: "A chave do Gemini não chegou ao servidor (variável GEMINI_API_KEY).",
  auth: "O Google recusou a chave (inválida, sem permissão ou região sem acesso ao plano gratuito).",
  model: "O modelo configurado não existe mais no Google. Defina GEMINI_MODEL com o nome atual.",
  quota: "A cota gratuita do Google esgotou por agora. Tente mais tarde.",
  timeout: "O Google demorou demais para responder.",
  http: "O serviço do Google falhou ou recusou o pedido.",
  format: "A resposta da IA veio incompleta ou fora do formato.",
  failed: "A IA falhou desta vez.",
};

export const aiFailureText = (reason: string | null | undefined, detail?: string | null) => {
  const base = AI_FAILURE_TEXT[reason ?? ""] ?? AI_FAILURE_TEXT.failed;
  return detail ? `${base} Detalhe do Google: ${detail}` : base;
};
