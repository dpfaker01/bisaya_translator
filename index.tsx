/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from '@google/genai';

interface CustomTranslation {
  english: string;
  bisaya: string;
}

const App = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [sourceText, setSourceText] = useState<string>('');
  const [translatedText, setTranslatedText] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [customTranslations, setCustomTranslations] = useState<CustomTranslation[]>([]);
  const [bulkTranslations, setBulkTranslations] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);


  // Load custom translations from localStorage on initial render
  useEffect(() => {
    try {
      const storedTranslations = localStorage.getItem('customTranslations');
      if (storedTranslations) {
        setCustomTranslations(JSON.parse(storedTranslations));
      }
    } catch (e) {
      console.error("Failed to parse custom translations from localStorage", e);
    }
  }, []);

  // Save custom translations to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('customTranslations', JSON.stringify(customTranslations));
  }, [customTranslations]);

  // =================================================================
  // FIX 1: HARDCODED API KEY
  // GitHub Pages cannot read .env files. We must place the key here.
  // Make sure you restricted this key to your website URL in Google Cloud.
  // =================================================================
  const API_KEY = "AIzaSyAnYgLFXjGQLI4SYsBNvVqVxI9YbpjhUEU";
  
  // Initialize the AI SDK
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    return {
      inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImageUrl(URL.createObjectURL(file));
      setSourceText('');
      setTranslatedText('');
      setError(null);
    }
  };

  const handleExtractText = async () => {
    if (!imageFile) {
      setError('Please upload an image first.');
      return;
    }

    setIsExtracting(true);
    setError(null);
    setSourceText('');
    setTranslatedText('');

    try {
      const imagePart = await fileToGenerativePart(imageFile);
      const response = await ai.models.generateContent({
        // FIX 2: Use a STABLE model version
        // 'gemini-2.5-flash' does not exist publicly.
        // 'gemini-1.5-flash' is the correct stable version.
        model: 'gemini-1.5-flash',
        contents: {
          parts: [
            { text: 'Extract all the English words from this image. If no text is found, return an empty response.' },
            imagePart
          ]
        },
      });
      // FIX 3: Add fallback for empty text
      setSourceText(response.text || "");
    } catch (err) {
      console.error("Extraction Error:", err);
      setError(
        err instanceof Error ? err.message : 'An unknown error occurred during text extraction.'
      );
    } finally {
      setIsExtracting(false);
    }
  };

  const handleTranslateText = async () => {
    if (!sourceText) {
      setError('There is no text to translate.');
      return;
    }

    setIsTranslating(true);
    setError(null);
    setTranslatedText('');

    try {
      let prompt = `Translate the following English text to Bisaya: "${sourceText}"`;

      if (customTranslations.length > 0) {
        const rules = customTranslations
          .map(t => `'${t.english.trim()}' must be translated as '${t.bisaya.trim()}'`)
          .join(', ');
        prompt = `Translate the following English text to Bisaya. You must follow these translation rules strictly: ${rules}. Do not deviate from these rules. The text to translate is: "${sourceText}"`;
      }
      
      const response = await ai.models.generateContent({
        // FIX 2: Use stable model version
        model: 'gemini-3.0-flash',
        contents: {
          parts: [{ text: prompt }]
        },
      });
      setTranslatedText(response.text || "");
    } catch (err)      {
      console.error("Translation Error:", err);
      setError(
        err instanceof Error ? err.message : 'An unknown error occurred during translation.'
      );
    } finally {
      setIsTranslating(false);
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkTranslations.trim()) return;

    setIsAddingCustom(true);
    setError(null);

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          english: { type: Type.STRING },
          bisaya: { type: Type.STRING },
        },
        required: ['english', 'bisaya'],
      },
    };

    const prompt = `Parse the following text and extract English to Bisaya translation pairs. The pairs can be separated by newlines, commas, or other delimiters, and the words themselves can be separated by ' - ', ':', or other common separators. Return the result as a JSON array of objects, where each object has "english" and "bisaya" keys. If no pairs are found, return an empty array. The text is: "${bulkTranslations}"`;

    try {
      const response = await ai.models.generateContent({
        // FIX 2: Use stable model version
        model: 'gemini-3.0-flash',
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      });
      
      const responseString = response.text || "[]";
      const parsedTranslations = JSON.parse(responseString);

      if (Array.isArray(parsedTranslations)) {
        // Basic validation of content
        const validTranslations = parsedTranslations.filter((t: any) => t.english && t.bisaya);
        setCustomTranslations(prev => [...prev, ...validTranslations]);
        setBulkTranslations('');
      } else {
        throw new Error("The model did not return a valid list of translations.");
      }

    } catch (err) {
      console.error("Bulk Add Error:", err);
      setError(
        err instanceof Error ? err.message : 'An unknown error occurred while adding custom translations.'
      );
    } finally {
      setIsAddingCustom(false);
    }
  };

  const handleDeleteTranslation = (index: number) => {
    setCustomTranslations(customTranslations.filter((_, i) => i !== index));
  };


  return (
    <div className="container">
      <h1>Image Translator</h1>

      <div className="section">
        <h2>Step 1: Get English Text</h2>
        <p className="description">
          Upload an image to extract text, or type/paste text directly in the box below.
        </p>
        <div className="file-uploader">
          <label htmlFor="image-upload" className="file-uploader-label">
            Upload an Image
          </label>
          <input
            id="image-upload"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
          />
        </div>
        {imageUrl && (
          <div className="image-preview">
            <img src={imageUrl} alt="Uploaded preview" />
          </div>
        )}
        <div className="controls">
          <button
            className="button"
            onClick={handleExtractText}
            disabled={!imageFile || isExtracting}
          >
            {isExtracting ? 'Reading...' : 'Read Text from Image'}
          </button>
        </div>
      </div>

      <div className="section">
        <h2>Step 2: Translate</h2>
        <div className="translation-box">
            <h3>English Text</h3>
            <div className="result-container" aria-live="polite">
                {isExtracting && <div className="spinner" role="status" aria-label="Extracting text"></div>}
                <textarea
                  className="text-box"
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder="Text from image will appear here, or you can paste your own text to translate."
                  aria-label="English text to translate"
                />
            </div>
        </div>

        <div className="controls">
            <button
              className="button"
              onClick={handleTranslateText}
              disabled={isTranslating || !sourceText}
            >
              {isTranslating ? 'Translating...' : 'Translate to Bisaya'}
            </button>
        </div>

        <div className="translation-box">
            <h3>Translated Bisaya Text</h3>
            <div className="result-container" aria-live="polite">
                {isTranslating && <div className="spinner" role="status" aria-label="Translating text"></div>}
                <textarea
                  className="text-box"
                  value={translatedText}
                  readOnly
                  placeholder="Translated text will appear here..."
                  aria-label="Translated Bisaya Text"
                />
            </div>
        </div>
      </div>
      
      <div className="section settings-section">
        <h2>Custom Translations</h2>
        <p className="description">
          Paste a list of translations below and the AI will add them to your rules.
          <br />
          For example: <code>church - simbahan, house: balay</code>
        </p>
        <div className="custom-translation-form">
          <textarea
            className="text-box"
            placeholder="Paste your translations here..."
            value={bulkTranslations}
            onChange={(e) => setBulkTranslations(e.target.value)}
            aria-label="Bulk add custom translations"
          />
          <div className="controls">
            <button
                className="button"
                onClick={handleBulkAdd}
                disabled={isAddingCustom || !bulkTranslations.trim()}
            >
                {isAddingCustom ? 'Adding...' : 'Add Translations'}
            </button>
          </div>
        </div>
        <div className="custom-translation-list">
          {customTranslations.map((item, index) => (
            <div key={index} className="custom-translation-item">
              <span><strong>{item.english}</strong> → {item.bisaya}</span>
              <button className="delete-button" onClick={() => handleDeleteTranslation(index)} aria-label={`Delete custom translation for ${item.english}`}>
                &times;
              </button>
            </div>
          ))}
        </div>
      </div>


      {error && <div className="error-message" role="alert">{error}</div>}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
