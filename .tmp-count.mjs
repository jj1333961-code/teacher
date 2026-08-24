import { getDocument, GlobalWorkerOptions } from './public/vendor/pdfjs/pdf.min.mjs';
import { readFileSync } from 'fs';
GlobalWorkerOptions.workerSrc = './public/vendor/pdfjs/pdf.worker.min.mjs';
for (const f of ['.tmp-quran-check.pdf','public/quran/quran.pdf']) {
  try {
    const data = new Uint8Array(readFileSync(f));
    const doc = await getDocument({ data, cMapUrl:'./public/vendor/pdfjs/cmaps/', cMapPacked:true }).promise;
    console.log(f, '=> pages:', doc.numPages);
  } catch(e){ console.log(f, 'ERROR', e.message); }
}
