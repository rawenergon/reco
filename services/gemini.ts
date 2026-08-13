
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Employee } from "../types";
import { DEFAULT_CONFIG } from "../constants";

// Initialize with a safe fallback to allow UI to load before key is present
let ai: GoogleGenAI | null = null;

// Helper to ensure AI is initialized correctly with fallbacks
const getAI = () => {
    if (ai) return ai;
    
    // Fallback to default key if current is null
    const key = DEFAULT_CONFIG.GEMINI_API_KEY;
    if (key) {
        ai = new GoogleGenAI({ apiKey: key });
        console.log("Gemini AI Initialized with default key");
        return ai;
    }
    
    return null;
};

export const initGemini = (apiKey: string) => {
  try {
    if (!apiKey) {
        // Try fallback if no key provided
        return getAI() !== null;
    }
    ai = new GoogleGenAI({ apiKey });
    console.log("Gemini AI Initialized with provided key");
    return true;
  } catch (e) {
    console.error("Failed to init Gemini", e);
    return false;
  }
};

const RECOGNITION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    identified: { type: Type.BOOLEAN, description: "True ONLY if the face in the TARGET image matches a CANDIDATE face with high certainty." },
    employeeId: { type: Type.STRING, description: "The ID of the matching candidate. Return null if no match." },
    confidence: { type: Type.NUMBER, description: "Confidence score (0.0 to 1.0)." },
    reasoning: { type: Type.STRING, description: "Short explanation of the match or non-match." }
  },
  required: ["identified", "confidence"],
};

// Helper to fetch image from URL and convert to base64
const urlToBase64 = async (url: string): Promise<string> => {
    try {
        // Fix: Check if URL already has query params before appending cache buster
        const separator = url.includes('?') ? '&' : '?';
        const fetchUrl = `${url}${separator}t=${new Date().getTime()}`;
        
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
        
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                // Robust regex to strip any mime type prefix
                resolve(base64String.replace(/^data:image\/[a-z]+;base64,/, ""));
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error("Failed to load image from URL", url, e);
        return "";
    }
}

export const identifyFace = async (
  targetImageBase64: string, 
  candidates: Employee[]
): Promise<{ identified: boolean; employeeId: string | null; confidence: number; reasoning?: string }> => {
  
  const genAI = getAI();

  if (!genAI) {
    throw new Error("Gemini AI not initialized. Please check API Key configuration.");
  }

  if (candidates.length === 0) {
    return { identified: false, employeeId: null, confidence: 0, reasoning: "No candidates in database." };
  }

  if (!targetImageBase64) {
    throw new Error("No target image provided. Please try again.");
  }

  // Clean base64 strings
  const cleanBase64 = (str: string) => str.replace(/^data:image\/[a-z]+;base64,/, "");

  const targetPart = {
    inlineData: {
      mimeType: 'image/jpeg',
      data: cleanBase64(targetImageBase64)
    }
  };

  const parts: any[] = [];
  parts.push({ text: "Analyze the TARGET image below and compare it against the provided CANDIDATE DATABASE." });
  parts.push({ text: "--- TARGET IMAGE ---" });
  parts.push(targetPart);
  parts.push({ text: "--- CANDIDATE DATABASE ---" });

  // Limit candidates to avoid context window overflow
  const activeCandidates = candidates.slice(0, 30);

  // Load all candidate images in parallel (URLs are converted to base64 client-side)
  const loadedCandidates = await Promise.allSettled(
    activeCandidates.map(async (emp) => {
      if (emp.photo_base64) {
        return { id: emp.id, name: emp.name, data: cleanBase64(emp.photo_base64) };
      }
      if (emp.photo_url) {
        const data = await urlToBase64(emp.photo_url);
        return data ? { id: emp.id, name: emp.name, data } : null;
      }
      return null;
    })
  );

  let validCandidatesCount = 0;

  for (const result of loadedCandidates) {
    if (result.status === 'fulfilled' && result.value) {
      const candidate = result.value;
      parts.push({ text: `ID: ${candidate.id} | Name: ${candidate.name}` });
      parts.push({
        inlineData: { mimeType: 'image/jpeg', data: candidate.data }
      });
      validCandidatesCount++;
    } else {
      console.warn(`Skipping a candidate due to image load error`);
    }
  }

  if (validCandidatesCount === 0) {
      throw new Error("Unable to load any candidate images. Check database image URLs.");
  }

  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [{ role: 'user', parts: parts }],
      config: {
        systemInstruction: `
          You are a biometrics expert. 
          1. Analyze the TARGET image face.
          2. Compare strictly against CANDIDATE images.
          3. Return JSON with identified=true ONLY if there is a strong match.
          4. Be robust to lighting and minor angle changes, but strict on identity.
        `,
        responseMimeType: "application/json",
        responseSchema: RECOGNITION_SCHEMA,
        temperature: 0.0,
      }
    });

    // In @google/genai, `text` can be a getter property or a function depending on SDK version.
    const rawText = (response as any).text;
    const text = typeof rawText === 'function' ? rawText() : rawText;
    if (!text) throw new Error("No response text from Gemini");
    
    // Strip any markdown code fences the model might wrap the JSON in
    const cleaned = String(text).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned);
    if (typeof parsed !== 'object' || parsed === null) throw new Error("AI returned invalid JSON");
    return parsed;

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    const msg = error.message || error.toString();
    if (msg.includes("429")) throw new Error("API Quota Exceeded. Please try again in a minute.");
    if (msg.includes("403") || msg.includes("API key not valid")) throw new Error("Invalid Gemini API Key. Check configuration.");
    if (msg.includes("SAFETY") || msg.includes("blocked")) throw new Error("Image blocked by safety filters. Ensure clear lighting.");
    if (msg.includes("400")) throw new Error("Bad Request to AI. Image data might be corrupted.");
    
    throw new Error(`AI Error: ${msg.substring(0, 100)}`);
  }
};
