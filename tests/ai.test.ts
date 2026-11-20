import assert from "node:assert/strict";
import test from "node:test";
import { recommend } from "../src/server/ai";
import { fixture } from "./fixtures";

test("the AI adapter excludes contacts and rejects unsupported figures", async () => {
  const originalFetch = globalThis.fetch;
  const names = ["AI_BASE_URL", "AI_API_KEY", "AI_MODEL"] as const;
  const environment = names.map((name) => process.env[name]);
  process.env.AI_BASE_URL = "https://provider.example.test/v1";
  process.env.AI_API_KEY = "local-test-key";
  process.env.AI_MODEL = "local-test-model";
  const data = fixture();
  try {
    globalThis.fetch = async (url, config) => {
      assert.equal(
        String(url),
        "https://provider.example.test/v1/chat/completions",
      );
      const input = JSON.parse(String(config?.body));
      const request = JSON.parse(input.messages[1].content);
      assert.equal(request.resume.personal.email, "");
      assert.equal(request.resume.personal.name, "");
      assert.equal(request.resume.personal.role, data.personal.role);
      assert.equal(input.response_format.type, "json_object");
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                advice: ["Confirma el volumen de informes."],
                profile: "Profesional con 999 años de experiencia.",
                experience: [
                  {
                    index: 0,
                    duties: "Automaticé informes en SQL.",
                    achievements: "Reduje el tiempo un 20 %.",
                    metrics: "",
                  },
                  {
                    index: 0,
                    duties: "Creé 888 informes.",
                    achievements: "",
                    metrics: "",
                  },
                ],
              }),
            },
          },
        ],
      });
    };
    const result = await recommend("profile", data, "", "");
    assert.equal(result.profile, undefined);
    assert.equal(result.experience?.length, 1);
    assert.equal(
      result.experience?.[0].achievements,
      "Reduje el tiempo un 20 %.",
    );
    assert.equal(
      data.experience[0].achievements,
      fixture().experience[0].achievements,
    );
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name, i) => {
      if (environment[i] === undefined) delete process.env[name];
      else process.env[name] = environment[i];
    });
  }
});
