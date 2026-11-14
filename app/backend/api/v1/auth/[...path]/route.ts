type Ctx = { params: Promise<{ path: string[] }> }

async function forward(req: Request, ctx: Ctx) {
  const { path } = await ctx.params
  // Adding fallback to NEXT_PUBLIC_API_URL to ensure the URL always resolves
  const url = `${process.env.API_URL || process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/${path.join("/")}`

  // 1. Clone ALL incoming headers to preserve Safari's Origin and User-Agent
  const headers = new Headers(req.headers)
  // Delete the host header so fetch automatically applies the Render host
  headers.delete("host")

  const upstream = await fetch(url, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
    redirect: "manual",
  })

  // 2. Clone ALL outgoing headers exactly as Render sent them to avoid Next.js comma-merging
  const resHeaders = new Headers(upstream.headers)
  
  return new Response(upstream.body, { 
    status: upstream.status, 
    headers: resHeaders 
  })
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE }