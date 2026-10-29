const PLAIN: Record<string, string> = { İ: 'I', I: 'I', ı: 'I', i: 'I', Ş: 'S', ş: 'S', Ğ: 'G', ğ: 'G', Ü: 'U', ü: 'U', Ö: 'O', ö: 'O', Ç: 'C', ç: 'C' };

/** Text for the Silkscreen heading font, which has no Turkish letters: upper case with İ/Ş/Ğ/Ü/Ö/Ç as plain I/S/G/U/O/C. */
export function px(s: string): string {
  return s.replace(/[İIıiŞşĞğÜüÖöÇç]/g, (c) => PLAIN[c]).toUpperCase();
}
