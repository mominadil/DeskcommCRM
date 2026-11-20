/**
 * `Content-Disposition` for a brief download. The plain `filename` is ASCII for old
 * clients; `filename*` carries the real name in UTF-8, so "Aumèra" stays "Aumèra".
 */
export function disposicaoDoDownload(titulo: string, cliente: string | null, sufixo: string): string {
  const base = `${titulo}${cliente ? ` - ${cliente}` : ""}`.replace(/[\u0000-\u001F<>:"/\\|?*]+/g, " ").replace(/\s+/g, " ").trim() || "brief";
  const nome = `${base} ${sufixo}`;
  const ascii = nome.normalize("NFKD").replace(/[^\x20-\x7E]/g, "").replace(/"/g, "") || `brief ${sufixo}`;
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}
