import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

export async function exportSummaryToPDF(
  summaryTitle: string,
  contentElement: HTMLElement,
  onProgress?: (progress: number, status: string) => void
): Promise<void> {
  try {
    onProgress?.(10, 'Preparing content...');

    // Create a temporary container for rendering
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '210mm'; // A4 width
    container.style.padding = '20mm';
    container.style.backgroundColor = 'white';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.color = 'black';
    // Ensure the container has a white background and is opaque
    container.style.background = '#ffffff';
    
    document.body.appendChild(container);

    onProgress?.(20, 'Cloning content...');

    // Clone the content
    const clone = contentElement.cloneNode(true) as HTMLElement;
    
    // Clean up the clone - remove buttons, hover elements, etc.
    clone.querySelectorAll('button').forEach(el => el.remove());
    clone.querySelectorAll('[class*="opacity-0"]').forEach(el => el.remove());
    clone.querySelectorAll('[class*="group-hover"]').forEach(el => el.remove());
    
    // Add title
    const titleEl = document.createElement('h1');
    titleEl.textContent = summaryTitle;
    titleEl.style.fontSize = '24px';
    titleEl.style.fontWeight = 'bold';
    titleEl.style.marginBottom = '20px';
    titleEl.style.color = '#000';
    
    container.appendChild(titleEl);
    container.appendChild(clone);

    onProgress?.(50, 'Generating image...');

    // Give the browser a moment to render the cloned content
    await new Promise(resolve => setTimeout(resolve, 100));

    // Helper to manually embed images to handle errors gracefully
    const embedImages = async (element: HTMLElement) => {
      // 1. Handle <img> tags
      const images = element.querySelectorAll('img');
      const imgPromises = Array.from(images).map(async (img) => {
        const src = img.src;
        if (!src || src.startsWith('data:')) return;

        try {
          const response = await fetch(src, { mode: 'cors' });
          if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
          const blob = await response.blob();
          return new Promise<void>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              img.src = reader.result as string;
              resolve();
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.warn('Failed to embed image:', src, error);
          img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
          img.style.border = '1px dashed red';
        }
      });

      // 2. Handle background-images
      const allElements = element.querySelectorAll('*');
      const bgPromises = Array.from(allElements).map(async (el) => {
        if (!(el instanceof HTMLElement)) return;
        const style = window.getComputedStyle(el);
        const bgImage = style.backgroundImage;
        
        if (bgImage && bgImage !== 'none' && bgImage.startsWith('url(')) {
           // Extract URL
           const urlMatch = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
           if (urlMatch && urlMatch[1]) {
             const src = urlMatch[1];
             if (src.startsWith('data:')) return;
             
             try {
                const response = await fetch(src, { mode: 'cors' });
                if (!response.ok) throw new Error(`Failed to fetch bg image: ${response.statusText}`);
                const blob = await response.blob();
                await new Promise<void>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    el.style.backgroundImage = `url('${reader.result}')`;
                    resolve();
                  };
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                });
             } catch (e) {
               console.warn('Failed to embed background image:', src, e);
               el.style.backgroundImage = 'none';
             }
           }
        }
      });
      
      await Promise.all([...imgPromises, ...bgPromises]);
    };

    onProgress?.(30, 'Embedding images...');
    
    // Manually embed images to avoid html-to-image failing on single network errors
    await embedImages(clone);

    // Aggressively sanitize the clone to remove potential crash causes
    clone.querySelectorAll('script, iframe, video, audio, object, embed, link[rel="stylesheet"]').forEach(el => el.remove());

    onProgress?.(50, 'Generating image...');

    // Give the browser a moment to render the cloned content
    await new Promise(resolve => setTimeout(resolve, 100));

    // Generate PNG using html-to-image
    const dataUrl = await toPng(container, {
      quality: 0.95,
      backgroundColor: '#ffffff',
      pixelRatio: 1, 
      skipFonts: true,
      cacheBust: true,
      fetchRequestInit: {
        mode: 'no-cors', // Prevent CORS crashes for any remaining resources
      },
      filter: (node) => {
        const tagName = (node instanceof Element) ? node.tagName : '';
        return tagName !== 'VIDEO' && tagName !== 'IFRAME' && tagName !== 'SCRIPT';
      }
    });

    onProgress?.(80, 'Generating PDF...');

    // Remove temporary container
    document.body.removeChild(container);

    // Create PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    
    // Load image to get dimensions
    const img = new Image();
    img.src = dataUrl;
    await new Promise((resolve, reject) => { 
      img.onload = resolve; 
      img.onerror = (e) => reject(new Error('Failed to load generated image for PDF'));
    });

    const imgHeight = (img.height * imgWidth) / img.width;
    let heightLeft = imgHeight;
    let position = 0;

    // Add first page
    pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Add additional pages if content is longer
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    onProgress?.(90, 'Saving file...');

    // Save the PDF
    const fileName = `${summaryTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    pdf.save(fileName);
    
    onProgress?.(100, 'Done!');
  } catch (error) {
    console.error('PDF export error:', error);
    // Log full details for debugging empty objects (common with DOMExceptions or Events)
    if (typeof error === 'object' && error !== null) {
        console.error('PDF export error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
    throw new Error('Failed to export PDF');
  }
}
