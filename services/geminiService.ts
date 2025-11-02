
// Gemini 2.0 Flash API Service
// Using Google's Generative Language API directly via fetch

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

export const getExampleSentence = async (word: string): Promise<string> => {
  if (!GEMINI_API_KEY) {
    return "API Key not configured. Please set VITE_GEMINI_API_KEY environment variable.";
  }

  try {
    const prompt = `Create a simple, clear, and engaging example sentence for a 15-year-old learning English, using the word or phrase "${word}". The sentence should be easy to understand and relevant to a teenager's life. Provide ONLY the sentence, without any additional explanation.`;

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 100,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data: GeminiResponse = await response.json();

    if (data.candidates && data.candidates.length > 0) {
      const text = data.candidates[0].content.parts[0].text;
      return text.trim();
    }

    return "Sorry, I couldn't think of an example sentence right now.";
  } catch (error) {
    console.error("Error generating example sentence:", error);
    return "Sorry, I couldn't think of an example sentence right now.";
  }
};

// Additional function for more advanced AI features
export const getDetailedExplanation = async (word: string): Promise<string> => {
  if (!GEMINI_API_KEY) {
    return "API Key not configured.";
  }

  try {
    const prompt = `Explain the word "${word}" for a 15-year-old English learner. Include:
1. Simple definition
2. Common usage context
3. One example sentence
Keep it friendly and easy to understand.`;

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 200,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data: GeminiResponse = await response.json();

    if (data.candidates && data.candidates.length > 0) {
      return data.candidates[0].content.parts[0].text.trim();
    }

    return "Sorry, I couldn't generate an explanation right now.";
  } catch (error) {
    console.error("Error generating explanation:", error);
    return "Sorry, I couldn't generate an explanation right now.";
  }
};
