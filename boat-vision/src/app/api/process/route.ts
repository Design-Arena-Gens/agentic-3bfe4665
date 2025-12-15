import { NextResponse } from "next/server";
import OpenAI from "openai";

type InsightBundle = {
  boatOverview?: string;
  visualFocalPoints?: string;
  locationAdaptation?: string;
};

type AnalysisPayload = {
  shouldReject: boolean;
  rejectionReason?: string;
  summary: string;
  insights: InsightBundle;
};

const lensLexicon: Record<string, string> = {
  "wide-immersive": "ultra-wide 18mm lens, low horizon, cinematic atmosphere, immersive scale",
  "action-zoom": "high-speed telephoto capture, sweeping rooster tail, tack sharp hull detail",
  "luxury-showcase": "mid focal length lifestyle showcase, golden hour polish, upscale staging",
};

const dynamicDirectives: Record<string, string> = {
  running: "capture hull-on-plane, spray arcs, strong diagonal energy, sense of motion",
  anchored: "quiet anchorage, glassy reflections, relaxed lifestyle moment with tasteful props",
  harbor: "arrival sequence past iconic marina landmarks, soft dusk lighting, warm hospitality",
};

function extractMessageText(payload: unknown): string {
  if (!payload || typeof payload !== "object" || !("output" in payload)) return "";
  const output = (payload as { output: Array<{ content?: Array<{ type?: string; text?: string }> }> }).output;
  for (const item of output ?? []) {
    for (const block of item.content ?? []) {
      if (block.type === "output_text" && block.text) {
        return block.text;
      }
    }
  }
  return "";
}

function cleanJson<T>(text: string): T | null {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

async function analyzeSourceImage(
  client: OpenAI,
  imageBase64: string,
  mimeType: string,
): Promise<AnalysisPayload> {
  const res = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              "You are a marine photo analyst. Inspect the image for boats on trailers and dealership backdrops. " +
              "Return JSON with keys: shouldReject (boolean), rejectionReason (string), summary (string), boatOverview, visualFocalPoints, locationAdaptation. " +
              "shouldReject must be true if any trailer parts, parking lot, ramps, vehicles, or dealership clutter dominate the frame or if the boat is occluded.",
          },
          {
            type: "input_image",
            image_url: `data:${mimeType};base64,${imageBase64}`,
            detail: "high",
          },
        ],
      },
    ],
    temperature: 0.2,
  });

  const parsed = cleanJson<AnalysisPayload>(extractMessageText(res));
  if (!parsed) {
    return {
      shouldReject: false,
      summary: "Unable to parse structured inspection; proceeding with default transformation.",
      insights: {},
    };
  }
  return parsed;
}

async function generateShot(
  client: OpenAI,
  {
    prompt,
  }: {
  prompt: string;
},
): Promise<{ image: string }> {
  const response = await client.images.generate({
    model: "gpt-image-1",
    prompt,
    size: "1024x1024",
    quality: "high",
    style: "natural",
  });

  const data = response.data?.[0];
  if (!data?.b64_json) {
    throw new Error("Image generation returned no data.");
  }

  return { image: `data:image/png;base64,${data.b64_json}` };
}

async function verifyComposite(client: OpenAI, imageBase64: string): Promise<string> {
  const res = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              "You are a marine art director. Inspect the generated photo for lingering trailer fragments, warped hulls, or water physics issues. " +
              "Respond with a short paragraph describing quality, authenticity, and any detected issues. Flag any problem explicitly.",
          },
          { type: "input_image", image_url: `data:image/png;base64,${imageBase64}`, detail: "high" },
        ],
      },
    ],
    temperature: 0.3,
  });

  return extractMessageText(res);
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const form = await request.formData();
  const image = form.get("image");
  const location = (form.get("location") as string) || "Local waterways";
  const lens = (form.get("lens") as string) || "wide-immersive";
  const dynamic = (form.get("dynamic") as string) || "running";
  const includeInteriors = form.get("includeInteriors") === "true";

  if (!(image instanceof File)) {
    return NextResponse.json({ error: "Missing upload" }, { status: 400 });
  }

  const arrayBuffer = await image.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");
  const mimeType = image.type || "image/jpeg";
  const analysis = await analyzeSourceImage(openai, base64, mimeType);
  if (analysis.shouldReject) {
    return NextResponse.json(
      {
        error: "Source image rejected",
        reason: analysis.rejectionReason,
      },
      { status: 422 },
    );
  }

  const lensDirective = lensLexicon[lens] ?? lensLexicon["wide-immersive"];
  const motionDirective = dynamicDirectives[dynamic] ?? dynamicDirectives["running"];

  const reinforcement = [
    "No trailers, parking lots, or dealership backgrounds.",
    "Boat dominates the frame with authentic reflections and crisp wake physics.",
    "Match hull lines, colors, and trim accents from the source description.",
    includeInteriors
      ? "Deliver a secondary interior vantage with luxurious wide-angle cabin framing."
      : "Focus solely on exterior hero shot.",
  ].join(" ");

  const prompt = [
    "Transform this vessel into a premium marketing render shot on the water.",
    `Locale: ${location}.`,
    `Lens profile: ${lensDirective}.`,
    `Shot dynamic: ${motionDirective}.`,
    `Boat summary: ${analysis.insights.boatOverview ?? "modern powerboat."}`,
    `Key focal points: ${analysis.insights.visualFocalPoints ?? "sleek hull, helm, passengers if present."}`,
    `Local cues: ${analysis.insights.locationAdaptation ?? "match regional water coloration and skyline."}`,
    reinforcement,
    "Hyper-realistic photographic lighting, zero distortion, glossy magazine quality.",
  ].join(" ");

  const { image: finalImage } = await generateShot(openai, { prompt });
  const finalBase64 = finalImage.split(",")[1] ?? "";
  const qualityReport = await verifyComposite(openai, finalBase64);

  return NextResponse.json({
    generatedImage: finalImage,
    prompt,
    summary: analysis.summary ?? "Marine transformation and trailer cleanup completed successfully.",
    qualityReport,
    insights: analysis.insights,
  });
}
