import axios from "axios";

/**
 * TJK sitesine uygun header'larla önceden yapılandırılmış Axios instance.
 * Tüm isteklerde tarayıcı gibi görünmek için gerekli header'lar eklenir.
 */
const tjkClient = axios.create({
  baseURL: "https://www.tjk.org",
  timeout: 30000,
  headers: {
    Accept: "text/html, */*; q=0.01",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    Referer:
      "https://www.tjk.org/TR/YarisSever/Info/Page/GunlukYarisProgrami",
    "X-Requested-With": "XMLHttpRequest",
  },
});

export default tjkClient;

