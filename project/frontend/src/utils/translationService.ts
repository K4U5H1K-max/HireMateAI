import { API_ENDPOINTS } from '../config/api';

export interface TranslationResponse {
  success: boolean;
  original_text: string;
  translated_text: string;
  source_language: string;
  target_language: string;
  message: string;
}

/**
 * Translate text from English to a target language
 */
export const translateText = async (
  text: string,
  targetLanguage: string
): Promise<string> => {
  // Skip translation if English
  if (targetLanguage === 'en-US' || targetLanguage === 'en-GB') {
    return text;
  }

  try {
    const response = await fetch(API_ENDPOINTS.translate, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        target_language: targetLanguage,
      }),
    });

    if (!response.ok) {
      console.error('Translation failed:', response.statusText);
      return text; // Fallback to original text
    }

    const data: TranslationResponse = await response.json();
    return data.translated_text || text;
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Fallback to original text
  }
};

/**
 * Translate text from a target language back to English
 */
export const translateToEnglish = async (
  text: string,
  sourceLanguage: string
): Promise<string> => {
  // Skip translation if English
  if (sourceLanguage === 'en-US' || sourceLanguage === 'en-GB') {
    return text;
  }

  try {
    const response = await fetch(API_ENDPOINTS.translateToEnglish, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        target_language: sourceLanguage,
      }),
    });

    if (!response.ok) {
      console.error('Translation failed:', response.statusText);
      return text; // Fallback to original text
    }

    const data: TranslationResponse = await response.json();
    return data.translated_text || text;
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Fallback to original text
  }
};

/**
 * Translate multiple questions efficiently
 */
export const translateQuestions = async (
  questions: string[],
  targetLanguage: string
): Promise<string[]> => {
  if (targetLanguage === 'en-US' || targetLanguage === 'en-GB') {
    return questions;
  }

  try {
    const translations = await Promise.all(
      questions.map((q) => translateText(q, targetLanguage))
    );
    return translations;
  } catch (error) {
    console.error('Batch translation error:', error);
    return questions;
  }
};
