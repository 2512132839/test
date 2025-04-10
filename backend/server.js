// server.js - 统一入口点
// 根据环境变量决定使用哪种模式运行

// 检查是否在Docker环境中运行
const isDockerEnvironment = process.env.RUNTIME_ENV === "docker";

// 根据环境加载相应的模块
if (isDockerEnvironment) {
  // Docker环境 - 启动Express服务器
  console.log("在Docker环境中运行，启动Express服务器...");
  // 动态导入docker-server.js
  import("./docker-server.js").catch((err) => {
    console.error("加载docker-server.js时出错:", err);
    process.exit(1);
  });
} else {
  // Cloudflare Workers环境 - 导出标准Worker处理函数
  console.log("在Cloudflare Workers环境中运行...");
  // 动态导入workers.js
  import("./workers.js").catch((err) => {
    console.error("加载workers.js时出错:", err);
    process.exit(1);
  });
}
