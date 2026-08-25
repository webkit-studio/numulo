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
  // Supabase says `Email address "x" is invalid` both for a malformed address
  // and for a domain it refuses (example.com and friends). One message covers
  // both, because from where the person is standing they are the same thing.
  if (
    text.includes("unable to validate email") ||
    text.includes("invalid email") ||
    (text.includes("email address") && text.includes("is invalid"))
  ) {
    return "Tenhle e-mail nejde použít. Zkontroluj ho, nebo zkus jiný.";
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return "Moc pokusů po sobě. Dej tomu chvilku.";
  }
  if (text.includes("same password")) return "Nové heslo musí být jiné než to staré.";
  if (text.includes("signups not allowed") || text.includes("signup is disabled")) {
    return "Registrace je zavřená. Napiš tomu, kdo účet spravuje.";
  }

  // Anything unrecognised keeps the original wording rather than a shrug: it
  // is the only thing that will tell anyone what actually broke.
  return `Nepovedlo se to: ${message}`;
}
