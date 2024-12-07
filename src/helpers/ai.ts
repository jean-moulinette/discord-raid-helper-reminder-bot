import axios from 'axios';
import { ChatCompletionRequest, ChatCompletionResponse } from './ai.types';
import { AZEROTH_NEWS_GENERATOR_SYSTEM_PROMPT, AZEROTH_NEWS_GENERATOR_USER_PROMPT, WOLRD_NEWS_GENERATOR_SYSTEM_PROMPT, WOLRD_NEWS_GENERATOR_USER_PROMPT } from './ai.consts';

async function getPerplexityCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY environment variable is not set');
  }

  try {
    const response = await axios.post<ChatCompletionResponse>(
      'https://api.perplexity.ai/chat/completions',
      request,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('API request failed:', error.response?.data || error.message);
    } else {
      console.error('An unexpected error occurred:', error);
    }
    throw error;
  }
}

export async function generateAzerothNews() {
  const request: ChatCompletionRequest = {
    model: 'llama-3.1-sonar-large-128k-online',
    messages: [
      {
        role: 'system',
        content: WOLRD_NEWS_GENERATOR_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: WOLRD_NEWS_GENERATOR_USER_PROMPT,
      }
    ],
    // temperature: 0.7,
    // top_p: 0.9,
    return_images: false,
    return_related_questions: false,

  };

  try {
    const response = await getPerplexityCompletion(request);
    const worldNews = response.choices[0].message.content;
    const newsSources = extractMatchingLinksWithSource(worldNews, response.citations);
    console.log('World news:', worldNews);
    console.log(response.citations);

    const transformToWowLoreRequest: ChatCompletionRequest = {
      model: 'llama-3.1-sonar-large-128k-online',
      messages: [
        {
          role: 'system',
          content: AZEROTH_NEWS_GENERATOR_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: AZEROTH_NEWS_GENERATOR_USER_PROMPT(worldNews),
        }
      ],
      // temperature: 0.7,
      // top_p: 0.9,
      return_images: false,
      return_related_questions: false,
    };

    const transformedResponse = await getPerplexityCompletion(transformToWowLoreRequest);
    const warcraftNews = transformedResponse.choices[0].message.content;

    

    return {
      news: warcraftNews,
      newsSources: generateSourcesText(newsSources),
    };

  } catch (e) {
    if (e instanceof Error) {
      console.error('Failed to generate Azeroth news:', e.message);
    }
    throw e;
  }
}

function extractMatchingLinksWithSource(text: string, links: string[]): { source: number; link: string }[] {
  const matchedSources = new Set<number>();

  // Rechercher tous les indices `[integer]` dans le texte
  text.replace(/\[(\d+)\]/g, (match, index) => {
      const sourceIndex = parseInt(index, 10); // Les sources sont basées sur des index 1-based
      if (sourceIndex > 0 && sourceIndex <= links.length) {
          matchedSources.add(sourceIndex); // Ajouter la source correspondante
      }
      return match;
  });

  // Extraire les liens correspondant aux sources trouvées
  return Array.from(matchedSources).map((source) => ({
      source,
      link: links[source - 1] // Conversion en index 0-based pour accéder aux liens
  }));
}

function generateSourcesText(sources: { source: number; link: string }[]): string {
  return sources.map(({ source, link }) => `[Source - ${source}](${link})`).join('\n');
}