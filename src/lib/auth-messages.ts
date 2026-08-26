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
  // Supabase's built-in mailer sends a couple of messages an hour and then
  // refuses. Saying "moc pokusů" sends people back to try the same thing
  // again; the honest answer is that it is the e-mail, and roughly how long.
  if (text.includes("email rate limit") || text.includes("over_email_send_rate_limit")) {
    return (
      "Došel limit odchozích e-mailů — Supabase jich posílá jen pár za hodinu. " +
      "Zkus to za hodinu, nebo v Supabase vypni potvrzování e-mailu " +
      "(Authentication → Sign In / Providers → Email → Confirm email)."
    );
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return "Moc pokusů po sobě. Dej tomu chvilku.";
  }
  // SMTP odmítl zásilku. Pro člověka u formuláře to není jeho chyba a nemá
  // co opravovat — smysl dává jen říct, že to není o něm, a nabídnout cestu,
  // která na e-mailu nezávisí.
  if (text.includes("error sending") || text.includes("smtp") || text.includes("mailer")) {
    return (
      "Účet se založit nepovedlo — nejde odeslat potvrzovací e-mail. " +
      "Není to tvoje chyba, je to nastavení odesílatele. Zkus to za chvíli znovu."
    );
  }
  if (text.includes("same password")) return "Nové heslo musí být jiné než to staré.";
  if (text.includes("signups not allowed") || text.includes("signup is disabled")) {
    return "Registrace je zavřená. Napiš tomu, kdo účet spravuje.";
  }

  // Anything unrecognised keeps the original wording rather than a shrug: it
  // is the only thing that will tell anyone what actually broke.
  return `Nepovedlo se to: ${message}`;
}
