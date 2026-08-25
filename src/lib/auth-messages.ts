/**
 * Supabase answers in English. These are the same failures in Czech, and in
 * the app's voice — calm, concrete, never scolding.
 */
export function czechAuthError(message: string): string {
  const text = message.toLowerCase();

  if (text.includes("invalid login credentials")) return "E-mail nebo heslo nesedí.";
  if (text.includes("email not confirmed")) {
    return "Účet ještě není potvrzený — mrkni do mailu na odkaz, který jsme ti poslali.";
  }
  if (text.includes("user already registered") || text.includes("already been registered")) {
    return "Na tenhle e-mail už účet je. Zkus se přihlásit.";
  }
  if (text.includes("password should be at least")) return "Heslo musí mít aspoň 8 znaků.";
  if (text.includes("unable to validate email") || text.includes("invalid email")) {
    return "To nevypadá jako e-mail.";
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return "Moc pokusů po sobě. Dej tomu chvilku.";
  }
  if (text.includes("same password")) return "Nové heslo musí být jiné než to staré.";

  return `Nepovedlo se to: ${message}`;
}
