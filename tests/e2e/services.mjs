import { createServer as http } from "node:http";
import { createServer as smtp } from "node:net";

const address = "127.0.0.1";
const httpPort = Number(process.env.CV_TEST_SERVICES_PORT || 4179);
const smtpPort = Number(process.env.CV_TEST_SMTP_PORT || 25251);
const letters = new Map();
const reviewed =
  "Analista de datos con experiencia en SQL y elaboración de informes.";

http(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/health") return res.end("ok");
  if (url.pathname === "/mail") {
    const mail = letters.get(url.searchParams.get("email"));
    res.writeHead(mail ? 200 : 404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ token: mail }));
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const data = Buffer.concat(chunks).toString();
  if (
    req.method === "POST" &&
    url.pathname === "/v1/chat/completions" &&
    req.headers.authorization === "Bearer fixture-key"
  ) {
    const request = JSON.parse(data);
    const source = JSON.parse(request.messages[1].content);
    if (
      !source.resume.profile.includes("SQL") ||
      source.resume.personal.name ||
      source.resume.personal.email
    ) {
      res.writeHead(422);
      return res.end();
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                advice: ["Revisa la propuesta antes de aplicarla."],
                profile: reviewed,
              }),
            },
          },
        ],
      }),
    );
  }
  if (req.method === "POST" && url.pathname === "/v2/check") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        matches: [{ message: "Revisa la concordancia.", replacements: [] }],
      }),
    );
  }
  res.writeHead(404);
  res.end();
}).listen(httpPort, address);

smtp((socket) => {
  socket.setEncoding("utf8");
  socket.write("220 fixture.test ESMTP\r\n");
  let pending = "",
    recipient = "",
    storing = false,
    content = "";
  socket.on("data", (chunk) => {
    pending += chunk;
    let end;
    while ((end = pending.indexOf("\r\n")) >= 0) {
      const line = pending.slice(0, end);
      pending = pending.slice(end + 2);
      if (storing) {
        if (line !== ".") {
          content += line + "\r\n";
          continue;
        }
        storing = false;
        const token = /\/recuperar#([\w-]{43})/.exec(
          content
            .replace(/=\r\n/g, "")
            .replace(/=([a-f0-9]{2})/gi, (_, hex) =>
              String.fromCharCode(parseInt(hex, 16)),
            ),
        )?.[1];
        if (token) letters.set(recipient, token);
        content = "";
        socket.write("250 Accepted\r\n");
      } else if (/^(EHLO|HELO)\b/i.test(line))
        socket.write("250 fixture.test\r\n");
      else if (/^MAIL FROM:/i.test(line))
        socket.write("250 Sender accepted\r\n");
      else if (/^RCPT TO:/i.test(line)) {
        recipient = /<([^>]+)>/.exec(line)?.[1] || "";
        socket.write("250 Recipient accepted\r\n");
      } else if (line === "DATA") {
        storing = true;
        socket.write("354 End mail with dot\r\n");
      } else if (line === "QUIT") socket.end("221 Bye\r\n");
      else socket.write("502 Command unavailable\r\n");
    }
  });
}).listen(smtpPort, address);
