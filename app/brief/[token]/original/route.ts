import { registrarFalhaDeToken, tokenFailureLimited } from "@/lib/auth/rate-limit";
import { paginaPropria } from "@/lib/briefs/paginas";
import { briefPeloToken } from "@/lib/briefs/servidor";

export const dynamic = "force-dynamic";

/** The hand-made page of a brief that has one (see `lib/briefs/paginas`), served as a full HTML document. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await ctx.params;
  const naoEncontrado = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (await tokenFailureLimited(token)) return new Response("Too many attempts", { status: 429 });
  const brief = await briefPeloToken(token);
  if (!brief) {
    await registrarFalhaDeToken(token);
    return naoEncontrado();
  }
  const html = paginaPropria(brief, token);
  if (!html) return naoEncontrado();
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
