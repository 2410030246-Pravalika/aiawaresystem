import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
app.use(express.json());

// Initialize Gemini Client Lazily to prevent startup warnings when API key is missing
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = (process.env.GEMINI_API_KEY || "").trim();
    if (!key) {
      throw new Error("Gemini API Key is missing. Please define GEMINI_API_KEY in your environment/secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Helper to run a promise with a timeout
function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

// Helper to handle transient API 503/UNAVAILABLE errors with retry and fallback model support
async function generateWithFallback(
  ai: GoogleGenAI,
  params: { contents: any; config: any }
): Promise<any> {
  const isVercel = process.env.VERCEL === "1" || true; // Under /api entry point we optimize for serverless/Vercel rules
  
  // Under Vercel Serverless (with a strict 10s Hobby limit), we must restrict retries
  // and run a tighter timeout to return a clean error instead of a raw Vercel crash.
  const modelsToTry = ["gemini-3.5-flash"];
  
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    const attempts = 1;
    const timeoutMs = 30000; // 30 seconds (Vercel maxDuration is 60s)

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        console.log(`[Gemini API] Requesting ${modelName} (attempt ${attempt}/${attempts})...`);
        
        const response = await withTimeout(
          ai.models.generateContent({
            model: modelName,
            ...params,
          }),
          timeoutMs,
          `Request to ${modelName} timed out after ${timeoutMs / 1000} seconds.`
        );

        console.log(`[Gemini API] Success with ${modelName} on attempt ${attempt}`);
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || err?.toString() || "Unknown error";
        console.warn(`[Gemini API] Model ${modelName} failed:`, errMsg);
        break;
      }
    }
  }

  // Enhanced error diagnosis for serverless Vercel execution
  const errorDetails = lastError?.message || lastError?.toString() || "Unknown error";
  let suggestedFix = `The request experienced a timeout or API error. If the Gemini API is processing slowly due to transient latency, please wait a moment and click 'Generate Complete Campaign' again to retry.`;
  
  const key = process.env.GEMINI_API_KEY || "";
  if (key && !key.startsWith("AIzaSy")) {
    suggestedFix += ` Note: Your GEMINI_API_KEY begins with '${key.substring(0, 3)}...' instead of the standard 'AIzaSy...'. If you are using a sandbox-restricted token, please swap it with a direct, personal API key generated from Google AI Studio (https://aistudio.google.com) to bypass local authorization failures.`;
  }

  throw new Error(`${suggestedFix} (Details: ${errorDetails})`);
}

// Campaign Generation API
app.post("/api/generate", async (req, res) => {
  const { topic, audience, tone } = req.body;

  if (!topic || !audience || !tone) {
    return res.status(400).json({ error: "Missing required fields: topic, audience, and tone." });
  }

  const key = (process.env.GEMINI_API_KEY || "").trim();
  if (!key) {
    return res.status(400).json({
      error: "Gemini API Key is missing.",
      details: "Please add GEMINI_API_KEY in the Vercel Dashboard Environment Variables, or in the Settings > Secrets panel of your AI Studio workspace."
    });
  }

  if (key.startsWith("AQ.")) {
    return res.status(400).json({
      error: "Invalid API Key format: AI Studio Session Token Detected.",
      details: `Your current key begins with "AQ.Ab8RN6...", which is a temporary internal Google AI Studio interface token, NOT a standard Gemini API key! Standard API keys start with "AIzaSy". Go to Google AI Studio (https://aistudio.google.com), click the 'Get API key' button, generate a real API key, and update the GEMINI_API_KEY variable in your Vercel Project Environment Variables.`
    });
  }

  if (!key.startsWith("AIzaSy")) {
    return res.status(400).json({
      error: "Invalid API Key format: Non-Standard Key Prefix Detected.",
      details: `Your current GEMINI_API_KEY begins with "${key.substring(0, Math.min(key.length, 5))}...", but standard Gemini API keys ALWAYS start with "AIzaSy". Please go to Google AI Studio (https://aistudio.google.com), click the 'Get API key' button, copy a genuine key, and set that as your GEMINI_API_KEY in your Vercel Dashboard.`
    });
  }

  try {
    const ai = getGeminiClient();
    const prompt = `You are a professional social campaign strategist and copywriter for NGOs like NayePankh Foundation.
Generate a comprehensive, high-impact awareness campaign with target-audience alignment and a strong, emotional core resonance.

Campaign Parameters:
- NGO Context: NayePankh Foundation (social upliftment, primary education, environmental greening, health care, child and women welfare).
- Cause Topic: ${topic}
- Target Audience: ${audience}
- Message Tone: ${tone}

CRITICAL FOR LATENCY: Keep all generated copy highly condensed, punchy, hit-exact, and brief to optimize token sizes and speed up responses. Long-winded text is strictly prohibited.

Please response strict JSON fulfilling this exact structure and formatting rules:
1. "slogan": One highly catchy, inspiring slogan for the campaign.
2. "socialMediaPost": An engaging social media post (around 60-80 words maximum) suitable for platforms like Instagram, Facebook, and LinkedIn, featuring relevant emotional anchors and clean spacing.
3. "posterHeadline": A punchy, brief headline for an awareness poster (e.g., 5-8 words).
4. "posterSubheadline": A supporting, clear message highlighting the cause or solution on the poster (under 15 words).
5. "posterCta": A strong, urgent Call To Action (CTA, under 6 words).
6. "awarenessMessage": A brief but deeply impactful awareness paragraph summarizing the vital problem or statistics related to the cause (under 50 words).
7. "hashtags": An array of exactly 5 relevant, campaign-optimized hashtags.
8. "posterImagePrompt": A professional, descriptive image prompt for AI generators (like Imagen) to build a beautiful visual poster matching this campaign (under 40 words).
9. "emailCampaign": An complete, condensed email newsletter draft (around 100-120 words maximum) with a subject line, proper greeting, introduction, 1-2 body paragraphs with impact stats, call to actions, and friendly professional closing.
10. "captionVariations": An array of exactly 3 interesting mini-caption variants:
    - One ultra-punchy caption under 60 characters.
    - One query/question-driven prompt to spark replies.
    - One story-telling hooks/paragraph.
11. "hindi": An adapted Hindi translation/transliteration block (using beautiful, readable Hindi keywords while keeping local community tone):
    - "slogan": Dynamic slogan in Hindi.
    - "socialMediaPost": Emotionally resonant social media post (60-80 words max) in Hindi script.
    - "posterHeadline": Bullet-proof poster headline in Hindi.
    - "posterSubheadline": Explanatory Hindi tagline (under 15 words).
    - "posterCta": Urging call-to-action in Hindi (under 6 words).
    - "awarenessMessage": High-impact brief problem statement in Hindi (under 50 words).`;

    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            slogan: { type: Type.STRING },
            socialMediaPost: { type: Type.STRING },
            posterHeadline: { type: Type.STRING },
            posterSubheadline: { type: Type.STRING },
            posterCta: { type: Type.STRING },
            awarenessMessage: { type: Type.STRING },
            hashtags: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            posterImagePrompt: { type: Type.STRING },
            emailCampaign: { type: Type.STRING },
            captionVariations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            hindi: {
              type: Type.OBJECT,
              properties: {
                slogan: { type: Type.STRING },
                socialMediaPost: { type: Type.STRING },
                posterHeadline: { type: Type.STRING },
                posterSubheadline: { type: Type.STRING },
                posterCta: { type: Type.STRING },
                 awarenessMessage: { type: Type.STRING },
              },
              required: ["slogan", "socialMediaPost", "posterHeadline", "posterSubheadline", "posterCta", "awarenessMessage"]
            }
          },
          required: [
            "slogan", "socialMediaPost", "posterHeadline", "posterSubheadline", "posterCta",
            "awarenessMessage", "hashtags", "posterImagePrompt", "emailCampaign", "captionVariations", "hindi"
          ]
        }
      }
    });

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        res.write(chunk.text);
      }
    }
    return res.end();

  } catch (error: any) {
    console.error("AI Generation Error:", error);
    if (res.headersSent) {
      if (!res.writableEnded) {
        res.write(JSON.stringify({ 
          error: "Streaming interrupted", 
          details: error.message || error.toString() 
        }));
        res.end();
      }
      return;
    }
    return res.status(500).json({
      error: "Campaign generation failed.",
      details: error.message || error.toString()
    });
  }
});

export default app;
