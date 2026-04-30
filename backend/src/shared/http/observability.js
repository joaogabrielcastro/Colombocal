const { randomUUID } = require("node:crypto");

function buildRequestId() {
  if (typeof randomUUID === "function") {
    return randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function requestIdMiddleware(req, res, next) {
  const incoming = req.headers["x-request-id"];
  const requestId =
    typeof incoming === "string" && incoming.trim()
      ? incoming.trim()
      : buildRequestId();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  const startedAt = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const log = {
      level: "info",
      type: "http_request",
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
    };
    console.log(JSON.stringify(log));
  });

  next();
}

async function sendErrorAlert(error, context = {}) {
  const webhook = process.env.ERROR_ALERT_WEBHOOK;
  if (!webhook) return;

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        level: "error",
        type: "critical_runtime_error",
        service: "colombocal-backend",
        timestamp: new Date().toISOString(),
        ...context,
        error: {
          name: error?.name,
          message: error?.message,
          stack: error?.stack,
        },
      }),
    });
  } catch (alertErr) {
    console.error(
      JSON.stringify({
        level: "error",
        type: "error_alert_failed",
        message: alertErr?.message,
      }),
    );
  }
}

module.exports = {
  requestIdMiddleware,
  sendErrorAlert,
};
