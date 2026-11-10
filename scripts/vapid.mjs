// Gera o par de chaves VAPID das notificações: node scripts/vapid.mjs
import { generateVAPIDKeys } from "web-push";
const k = generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${k.publicKey}\nVAPID_PRIVATE_KEY=${k.privateKey}\nVAPID_SUBJECT=mailto:seu-email@exemplo.com`);
