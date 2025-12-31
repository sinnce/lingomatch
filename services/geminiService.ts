import { GoogleGenAI, Type } from "@google/genai";
import { VocabularyPair, GameConfig } from '../types';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateVocabulary = async (config: GameConfig): Promise<VocabularyPair[]> => {
  const model = 'gemini-3-flash-preview';
  
  const prompt = `
    Generate 20 pairs of vocabulary words for learning ${config.language}.
    Difficulty level: ${config.difficulty}.
    Topic: ${config.topic}.
    
    Return a list of pairs where 'target' is the word in ${config.language} and 'native' is the English translation.
    Keep words short and concise (maximum 2-3 words per phrase).
    Ensure the pairs are distinct and not ambiguous.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              target: { type: Type.STRING },
              native: { type: Type.STRING }
            },
            required: ["target", "native"]
          }
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text) as VocabularyPair[];
      return data;
    }
    
    throw new Error("No data returned from Gemini");
  } catch (error) {
    console.error("Error generating vocabulary:", error);
    // Fallback data
    return [
      { target: "Hola", native: "Hello" },
      { target: "Gato", native: "Cat" },
      { target: "Perro", native: "Dog" },
      { target: "Agua", native: "Water" },
      { target: "Gracias", native: "Thanks" },
      { target: "Adios", native: "Goodbye" },
      { target: "Libro", native: "Book" },
      { target: "Casa", native: "House" },
      { target: "Coche", native: "Car" },
      { target: "Arbol", native: "Tree" }
    ];
  }
};