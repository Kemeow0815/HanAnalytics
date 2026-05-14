import { vh_INIT } from "./utils/init.js";

/**
 * 公共统计 API - 对外展示特定网站的访问数据
 * 无需认证，支持跨域访问
 *
 * 使用方式：
 * GET /stats?site=stellar&time=today
 * 或
 * POST /stats {"site": "stellar", "time": "today"}
 *
 * 参数：
 * - site: 网站ID (必填)
 * - time: 时间范围 (可选，默认 today)
 *   - today: 今天
 *   - 1d: 昨天
 *   - 7d: 最近7天
 *   - 30d: 最近30天
 *   - 60d: 最近60天
 *   - 90d: 最近90天
 */
export async function onRequest({ request, env }) {
  // 设置 CORS 头
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  // 处理 OPTIONS 预检请求
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 获取参数
    let siteID, timeRange;

    if (request.method === "GET") {
      const url = new URL(request.url);
      siteID = url.searchParams.get("site");
      timeRange = url.searchParams.get("time") || "today";
    } else if (request.method === "POST") {
      const body = await request.json();
      siteID = body.site;
      timeRange = body.time || "today";
    } else {
      return Response.json({ success: false, message: "仅支持 GET 和 POST 请求" }, { headers: corsHeaders, status: 405 });
    }

    // 验证必填参数
    if (!siteID) {
      return Response.json({ success: false, message: "缺少必填参数: site (网站ID)" }, { headers: corsHeaders, status: 400 });
    }

    // 验证时间范围
    const validTimeRanges = ["today", "1d", "7d", "30d", "60d", "90d"];
    if (!validTimeRanges.includes(timeRange)) {
      return Response.json({ success: false, message: `无效的时间范围: ${timeRange}. 可选值: ${validTimeRanges.join(", ")}` }, { headers: corsHeaders, status: 400 });
    }

    // 检查环境变量配置
    if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
      return Response.json({ success: false, message: "服务器配置错误：缺少必要的 API 凭证" }, { headers: corsHeaders, status: 500 });
    }

    // 获取时区
    const tz = request.cf?.timezone || "Asia/Shanghai";

    // 查询统计数据
    const stats = await vh_INIT(env, timeRange, siteID, tz, "visit");

    // 返回标准化格式的数据
    return Response.json(
      {
        success: true,
        data: {
          site: siteID,
          timeRange: timeRange,
          timestamp: new Date().toISOString(),
          stats: {
            views: stats.views || 0,
            visits: stats.visit || 0,
            visitors: stats.visitor || 0
          }
        }
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("[Stats API Error]", error);
    return Response.json(
      {
        success: false,
        message: "获取统计数据失败",
        error: error.message || String(error)
      },
      { headers: corsHeaders, status: 500 }
    );
  }
}
