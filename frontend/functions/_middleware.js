/**
 * Cloudflare Pages中间件
 * 用于在运行时动态替换配置文件中的环境变量
 */
export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // 只处理对config.js的请求
  if (url.pathname.endsWith("/config.js") || (url.pathname.includes("/assets/") && url.pathname.endsWith(".js"))) {
    // 获取原始的配置文件
    const response = await next();
    const originalText = await response.text();

    // 获取后端URL环境变量
    const backendUrl = env.VITE_BACKEND_URL || "http://localhost:8787";

    // 替换不同格式的占位符
    let modifiedText = originalText;

    // 替换直接的字符串占位符 "__BACKEND_URL__"
    if (modifiedText.includes('"__BACKEND_URL__"') || modifiedText.includes("'__BACKEND_URL__'")) {
      modifiedText = modifiedText.replace(/"__BACKEND_URL__"/g, `"${backendUrl}"`);
      modifiedText = modifiedText.replace(/'__BACKEND_URL__'/g, `'${backendUrl}'`);
    }

    // 替换JSON.stringify后的占位符 (用于window.appConfig处理)
    if (modifiedText.includes("window.appConfig") && modifiedText.includes("backendUrl")) {
      modifiedText = modifiedText.replace(/backendUrl:"__BACKEND_URL__"/g, `backendUrl:"${backendUrl}"`);
      modifiedText = modifiedText.replace(/backendUrl: "__BACKEND_URL__"/g, `backendUrl: "${backendUrl}"`);
    }

    // 返回修改后的配置文件
    return new Response(modifiedText, {
      headers: {
        "Content-Type": "application/javascript",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  }

  // 对于其他请求，正常处理
  return next();
}
