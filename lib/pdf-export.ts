import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function exportSummaryToPDF(
  summaryTitle: string,
  contentElement: HTMLElement
): Promise<void> {
  try {
    // Helper function to convert any color to RGB format that html2canvas supports
    const convertColorToRGB = (color: string): string => {
      if (!color || color === 'transparent' || color === 'none') {
        return 'transparent';
      }
      
      // If it's already rgb/rgba or hex, return as is
      if (color.startsWith('rgb') || color.startsWith('#')) {
        return color;
      }
      
      // For lab, lch, oklab, oklch, etc., use canvas to convert
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (!ctx) return 'rgb(0, 0, 0)';
        
        ctx.fillStyle = color;
        const computedColor = ctx.fillStyle; // This will be in rgb() or #hex format
        return computedColor;
      } catch (e) {
        console.warn('Failed to convert color:', color, e);
        return 'rgb(0, 0, 0)'; // Fallback to black
      }
    };

    // Create a temporary container for rendering
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '210mm'; // A4 width
    container.style.padding = '20mm';
    container.style.backgroundColor = 'white';
    container.style.fontFamily = 'Arial, sans-serif';
    document.body.appendChild(container);

    // Override CSS variables with calculated RGB values
    // This is crucial because html2canvas fails with modern color spaces like oklch/lab
    // defined in CSS variables, even if we inline styles on elements (due to pseudo-elements etc).
    const cssVariables = [
      '--background', '--foreground', 
      '--card', '--card-foreground', 
      '--popover', '--popover-foreground', 
      '--primary', '--primary-foreground', 
      '--secondary', '--secondary-foreground', 
      '--muted', '--muted-foreground', 
      '--accent', '--accent-foreground', 
      '--destructive', '--border', 
      '--input', '--ring', 
      '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5',
      '--sidebar', '--sidebar-foreground',
      '--sidebar-primary', '--sidebar-primary-foreground',
      '--sidebar-accent', '--sidebar-accent-foreground',
      '--sidebar-border', '--sidebar-ring'
    ];

    const computedBodyStyle = window.getComputedStyle(document.body);
    cssVariables.forEach(variable => {
      const value = computedBodyStyle.getPropertyValue(variable).trim();
      if (value) {
        // Convert the variable value (likely oklch) to RGB
        const rgbValue = convertColorToRGB(value);
        container.style.setProperty(variable, rgbValue);
      }
    });

    // Clone the content
    const clone = contentElement.cloneNode(true) as HTMLElement;
    
    // Clean up the clone - remove buttons, hover elements, etc.
    clone.querySelectorAll('button').forEach(el => el.remove());
    clone.querySelectorAll('[class*="opacity-0"]').forEach(el => el.remove());
    clone.querySelectorAll('[class*="group-hover"]').forEach(el => el.remove());
    
    // Aggressively normalize all elements to avoid unsupported color functions
    // Normalize colors to avoid unsupported color functions, but preserve classes/layout
    const normalizeElement = (element: HTMLElement) => {
      // Get computed styles
      const computedStyle = window.getComputedStyle(element);
      
      // Convert colors to RGB format
      const color = convertColorToRGB(computedStyle.color);
      const backgroundColor = convertColorToRGB(computedStyle.backgroundColor);
      const borderColor = convertColorToRGB(computedStyle.borderColor);
      
      // Apply computed colors as inline styles to override potential unsupported CSS color functions
      if (color && color !== 'transparent') element.style.color = color;
      if (backgroundColor && backgroundColor !== 'transparent') element.style.backgroundColor = backgroundColor;
      if (borderColor && borderColor !== 'transparent') element.style.borderColor = borderColor;
      
      // Recursively process children
      Array.from(element.children).forEach(child => {
        if (child instanceof HTMLElement) {
          normalizeElement(child);
        }
      });
    };
    
    normalizeElement(clone);
    
    // Add title
    const titleEl = document.createElement('h1');
    titleEl.textContent = summaryTitle;
    titleEl.style.fontSize = '24px';
    titleEl.style.fontWeight = 'bold';
    titleEl.style.marginBottom = '20px';
    titleEl.style.color = '#000';
    
    container.appendChild(titleEl);
    container.appendChild(clone);

    // Render to canvas
    const canvas = await html2canvas(container, {
      scale: 2, // Higher quality
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    // Remove temporary container
    document.body.removeChild(container);

    // Calculate dimensions
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    // Create PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Add first page
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Add additional pages if content is longer
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Save the PDF
    const fileName = `${summaryTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    pdf.save(fileName);
  } catch (error) {
    console.error('PDF export error:', error);
    throw new Error('Failed to export PDF');
  }
}
