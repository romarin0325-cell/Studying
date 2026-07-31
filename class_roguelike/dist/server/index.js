const worker = {
  async fetch(request, env) {
    if (!env.ASSETS) {
      return new Response("Static asset binding is unavailable.", { status: 500 });
    }

    const url = new URL(request.url);
    const assetUrl = new URL(request.url);
    if (url.pathname === "/") assetUrl.pathname = "/index.html";

    let response = await env.ASSETS.fetch(new Request(assetUrl, request));
    if (
      response.status === 404 &&
      request.method === "GET" &&
      request.headers.get("accept")?.includes("text/html")
    ) {
      assetUrl.pathname = "/index.html";
      response = await env.ASSETS.fetch(new Request(assetUrl, request));
    }

    if (assetUrl.pathname === "/index.html" && response.ok) {
      const socialImage = `${url.origin}/og.png`;
      const socialMeta = [
        '<meta property="og:type" content="website">',
        '<meta property="og:title" content="삼중운명: 꿈의 잔향">',
        '<meta property="og:description" content="세 번의 클래스 선택으로 매 런 새로운 운명을 완성하는 모바일 턴제 로그라이크 RPG">',
        `<meta property="og:image" content="${socialImage}">`,
        '<meta name="twitter:card" content="summary_large_image">',
        '<meta name="twitter:title" content="삼중운명: 꿈의 잔향">',
        '<meta name="twitter:description" content="세 번의 선택, 하나의 운명">',
        `<meta name="twitter:image" content="${socialImage}">`
      ].join("");
      const html = (await response.text()).replace("</head>", `${socialMeta}</head>`);
      const headers = new Headers(response.headers);
      headers.set("cache-control", "no-cache");
      headers.set("x-content-type-options", "nosniff");
      headers.set("referrer-policy", "strict-origin-when-cross-origin");
      headers.delete("content-length");
      return new Response(html, { status: response.status, headers });
    }
    return response;
  }
};

export default worker;
