import Papa from 'papaparse';
import JSZip from 'jszip';
import { VocabularyPair } from '../types';

// Helper to strip HTML tags from Anki fields
const stripHtml = (html: string): string => {
  if (!html) return "";
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  let text = tmp.textContent || tmp.innerText || "";
  // Remove Anki sound tags [sound:...]
  text = text.replace(/\[sound:.*?\]/g, '');
  return text.trim();
};

export const parseDeckFile = async (file: File): Promise<VocabularyPair[]> => {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'csv') {
    return parseCSV(file);
  } else if (extension === 'apkg') {
    return parseAnki(file);
  } else {
    throw new Error("Unsupported file format. Please use .csv or .apkg");
  }
};

const parseCSV = (file: File): Promise<VocabularyPair[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false, // We assume simple col1, col2 structure. Headers might confuse simple logic.
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const pairs: VocabularyPair[] = [];
          // Heuristic: Check if first row looks like a header
          let startIndex = 0;
          const firstRow = results.data[0] as string[];
          if (firstRow && (firstRow[0]?.toLowerCase().includes('target') || firstRow[0]?.toLowerCase().includes('word'))) {
             startIndex = 1;
          }

          for (let i = startIndex; i < results.data.length; i++) {
            const row = results.data[i] as string[];
            if (row.length >= 2) {
              // Assume Col 1 is Target (Foreign), Col 2 is Native (English)
              if (row[0] && row[1]) {
                pairs.push({
                  target: row[0].trim(),
                  native: row[1].trim()
                });
              }
            }
          }
          
          if (pairs.length < 5) {
             reject(new Error("CSV must contain at least 5 pairs."));
          } else {
             resolve(pairs);
          }
        } catch (e) {
          reject(new Error("Failed to parse CSV data."));
        }
      },
      error: (err) => reject(err)
    });
  });
};

const parseAnki = async (file: File): Promise<VocabularyPair[]> => {
  try {
    const zip = await JSZip.loadAsync(file);
    const colFile = zip.file('collection.anki2');
    
    if (!colFile) {
      throw new Error("Invalid Anki deck: collection.anki2 not found.");
    }

    const arrayBuffer = await colFile.async('uint8array');

    // Dynamic import for sql.js to avoid loading it when not needed
    // We use the WASM version from CDN
    // @ts-ignore
    const initSqlJs = (await import('https://esm.sh/sql.js@1.10.0')).default;
    const SQL = await initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`
    });

    const db = new SQL.Database(arrayBuffer);
    
    // Anki stores note content in the 'notes' table, 'flds' column
    // Fields are separated by 0x1f
    const res = db.exec("SELECT flds FROM notes");
    
    if (!res || res.length === 0) {
      throw new Error("No cards found in Anki deck.");
    }

    const pairs: VocabularyPair[] = [];
    const rows = res[0].values;

    for (const row of rows) {
      if (typeof row[0] === 'string') {
        const fields = row[0].split('\x1f');
        if (fields.length >= 2) {
          // Assume Field 1 is Front (Target), Field 2 is Back (Native)
          const target = stripHtml(fields[0]);
          const native = stripHtml(fields[1]);
          
          if (target && native) {
            pairs.push({ target, native });
          }
        }
      }
    }
    
    db.close();

    if (pairs.length < 5) {
       throw new Error("Anki deck must contain at least 5 valid cards.");
    }
    
    return pairs;

  } catch (err: any) {
    console.error("Anki Import Error:", err);
    throw new Error("Failed to parse Anki file. " + (err.message || ""));
  }
};