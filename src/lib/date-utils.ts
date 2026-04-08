/**
 * Tarih yardımcı fonksiyonları
 * TJK API'si DD/MM/YYYY formatını kullanır.
 */

/** Bugünün tarihini DD/MM/YYYY formatında döner */
export function getTodayFormatted(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** URL query parametrelerinde kullanılmak üzere encode eder */
export function getTodayEncoded(): string {
  return encodeURIComponent(getTodayFormatted());
}

