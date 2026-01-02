
import { GoogleGenAI } from "@google/genai";
import { MODEL_SHOT_PROMPT } from "../constants";

const getBase64Parts = (base64Image: string) => {
  const match = base64Image.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid image format.");
  }
  return { mimeType: match[1], data: match[2] };
};

export const generateModelFit = async (
  base64Image: string,
  config: { 
    modelType: string, 
    modelRace: string,
    pose: string, 
    background: string, 
    aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
    customInstructions?: string
  },
  hasPersonalKey: boolean
): Promise<string> => {
  // Initialize AI with the latest API key from process.env
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const { mimeType, data } = getBase64Parts(base64Image);
  const prompt = MODEL_SHOT_PROMPT(config);
  
  // Dynamically select model: Gemini 3 Pro for personal keys, Flash for default
  const modelName = hasPersonalKey ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
  
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { inlineData: { data, mimeType } },
          { text: prompt },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: config.aspectRatio,
          // Only Gemini 3 Pro supports explicit imageSize configuration
          ...(hasPersonalKey ? { imageSize: "1K" } : {})
        }
      }
    });

    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      const imagePart = candidate.content.parts.find(p => p.inlineData);
      if (imagePart?.inlineData?.data) {
        return `data:image/png;base64,${imagePart.inlineData.data}`;
      }
    }
    
    throw new Error("Generation completed but no image was returned.");
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message?.includes('RESOURCE_EXHAUSTED')) {
      throw new Error("The service is currently busy. Please try again in a moment or use a Personal Key.");
    }
    throw new Error(error.message || "Generation failed.");
  }
};

export const editGeneratedImage = async (
  base64Image: string,
  editPrompt: string,
  hasPersonalKey: boolean
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const { mimeType, data } = getBase64Parts(base64Image);
  const modelName = hasPersonalKey ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';

  const instruction = `
    Edit this photoshoot: "${editPrompt}".
    Maintain the model's pose and the specific textures of the Zimbabalooba fabric.
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { inlineData: { data, mimeType } },
          { text: instruction },
        ],
      },
      config: {
        ...(hasPersonalKey ? { imageConfig: { imageSize: "1K" } } : {})
      }
    });

    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      const imagePart = candidate.content.parts.find(p => p.inlineData);
      if (imagePart?.inlineData?.data) {
        return `data:image/png;base64,${imagePart.inlineData.data}`;
      }
    }

    throw new Error("Editing completed but no image was returned.");
  } catch (error: any) {
    throw new Error(error.message || "Editing failed.");
  }
};
