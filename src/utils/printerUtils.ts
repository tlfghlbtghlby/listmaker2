import { Invoice, StoreSettings } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

/**
 * Formats plain text receipt for Bluetooth ESC/POS or clipboard/sharing
 */
export const formatInvoicePlainText = (invoice: Invoice, settings: StoreSettings): string => {
  const dateObj = new Date(invoice.date);
  const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const dayName = arabicDays[dateObj.getDay()];
  const dateStr = dateObj.toLocaleDateString('ar-IQ');
  const timeStr = dateObj.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
  const currency = settings.currency || 'د.ع';

  let text = '';
  text += `================================\n`;
  text += `       ${settings.storeName || 'قائمة مبيعات'}       \n`;
  if (settings.phone) text += `هاتف: ${settings.phone}\n`;
  if (settings.address) text += `العنوان: ${settings.address}\n`;
  text += `--------------------------------\n`;
  text += `رقم القائمة: ${invoice.invoiceNumber}\n`;
  text += `التاريخ: ${dayName} ${dateStr} ${timeStr}\n`;
  text += `النوع: ${invoice.type === 'credit' ? 'بيع آجل (دين)' : 'بيع مباشر (نقدي)'}\n`;
  text += `الزبون: ${invoice.customerName || 'زبون نقدي مباشر'}\n`;
  if (invoice.customerPhone) text += `هاتف الزبون: ${invoice.customerPhone}\n`;
  text += `================================\n`;
  text += `المادة                الكمية   المجموع\n`;
  text += `--------------------------------\n`;

  invoice.items.forEach((item, index) => {
    const isCarton = item.unitType === 'carton';
    const unitLabel = isCarton ? 'كرتون' : (item.unit || 'قطعة');
    const qtyStr = `${item.quantity} ${unitLabel}`;
    text += `${index + 1}. ${item.productName}\n`;
    text += `   ${qtyStr} × ${item.unitPrice.toLocaleString()} = ${item.total.toLocaleString()} ${currency}\n`;
  });

  text += `--------------------------------\n`;
  if (invoice.discount > 0) {
    text += `المجموع قبل الخصم: ${invoice.subtotal.toLocaleString()} ${currency}\n`;
    text += `الخصم: ${invoice.discount.toLocaleString()} ${currency}\n`;
  }
  text += `صافي القائمة: ${invoice.total.toLocaleString()} ${currency}\n`;
  
  if (invoice.previousDebt > 0) {
    text += `الديون السابقة: ${invoice.previousDebt.toLocaleString()} ${currency}\n`;
    text += `المجموع الكلي: ${(invoice.total + invoice.previousDebt).toLocaleString()} ${currency}\n`;
  }

  text += `الواصل (المسدد): ${invoice.paidAmount.toLocaleString()} ${currency}\n`;
  const remaining = Math.max(0, (invoice.total + (invoice.previousDebt || 0)) - invoice.paidAmount);
  text += `المتبقي في الذمة: ${remaining.toLocaleString()} ${currency}\n`;

  if (settings.invoiceFooterNote) {
    text += `--------------------------------\n`;
    text += `${settings.invoiceFooterNote}\n`;
  }
  text += `================================\n\n\n`;

  return text;
};

/**
 * Converts text into ESC/POS bytes for thermal printers
 */
export const createEscPosBuffer = (text: string): Uint8Array => {
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(text);
  
  // ESC/POS Commands
  const ESC = 0x1b;
  const GS = 0x1d;
  
  const init = [ESC, 0x40]; // Initialize printer
  const centerAlign = [ESC, 0x61, 0x01]; // Center align
  const lineFeed = [0x0a, 0x0a, 0x0a];
  const cutPaper = [GS, 0x56, 0x00]; // Full cut paper

  const finalLength = init.length + centerAlign.length + textBytes.length + lineFeed.length + cutPaper.length;
  const buffer = new Uint8Array(finalLength);
  
  let offset = 0;
  buffer.set(init, offset); offset += init.length;
  buffer.set(centerAlign, offset); offset += centerAlign.length;
  buffer.set(textBytes, offset); offset += textBytes.length;
  buffer.set(lineFeed, offset); offset += lineFeed.length;
  buffer.set(cutPaper, offset); offset += cutPaper.length;

  return buffer;
};

/**
 * Checks if direct Web Bluetooth API is supported and allowed by permissions policy
 */
export const isWebBluetoothAllowed = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  try {
    const doc = document as any;
    if (doc.featurePolicy && typeof doc.featurePolicy.allowsFeature === 'function') {
      if (!doc.featurePolicy.allowsFeature('bluetooth')) {
        return false;
      }
    }
    if (doc.permissionsPolicy && typeof doc.permissionsPolicy.allowsFeature === 'function') {
      if (!doc.permissionsPolicy.allowsFeature('bluetooth')) {
        return false;
      }
    }

    const isInIframe = window.self !== window.top;
    if (isInIframe) {
      return false;
    }
  } catch (e) {
    return false;
  }

  return Boolean((navigator as any).bluetooth && typeof (navigator as any).bluetooth.requestDevice === 'function');
};

/**
 * Direct Web Bluetooth Print (for Bluetooth Thermal Printers - اتصال لاسلكي بلوتوث)
 * Completely safe against permissions policy rejections and uncaught promises.
 */
export const printViaWebBluetooth = async (
  invoice: Invoice, 
  settings: StoreSettings
): Promise<{ success: boolean; message: string; isPermissionsPolicyBlocked?: boolean; isCancelled?: boolean }> => {
  if (!isWebBluetoothAllowed()) {
    return {
      success: false,
      isPermissionsPolicyBlocked: true,
      message: 'خاصية البلوتوث المباشرة مقيدة في هذه البيئة. يمكنك استخدام خيار "طباعة القائمة" لاختيار طابعة البلوتوث المقترنة بجهازك.'
    };
  }

  let device: any = null;

  try {
    // Bluetooth printer services standard UUIDs
    device = await (navigator as any).bluetooth.requestDevice({
      filters: [
        { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
        { services: ['e7810a71-73ae-499d-8c15-faa9aef0c3f2'] },
        { services: ['49535343-fe7d-4ae5-8fa9-9fafd205e455'] },
      ],
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        '0000ffe0-0000-1000-8000-00805f9b34fb'
      ],
      acceptAllDevices: false
    });
  } catch (err: any) {
    const errorStr = (err?.message || err?.toString() || '').toLowerCase();
    if (errorStr.includes('cancel') || errorStr.includes('abort') || errorStr.includes('user cancelled')) {
      return { success: false, isCancelled: true, message: 'تم إلغاء اختيار طابعة البلوتوث.' };
    }
    if (errorStr.includes('permissions policy') || errorStr.includes('disallowed') || errorStr.includes('securityerror')) {
      return {
        success: false,
        isPermissionsPolicyBlocked: true,
        message: 'خاصية البلوتوث المباشرة مقيدة في هذه البيئة. يمكنك استخدام خيار "طباعة القائمة" لاختيار طابعة البلوتوث المقترنة بالنظام.'
      };
    }

    // Attempt second safe try with acceptAllDevices
    try {
      device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455',
          '0000ffe0-0000-1000-8000-00805f9b34fb'
        ]
      });
    } catch (fallbackErr: any) {
      const fbStr = (fallbackErr?.message || fallbackErr?.toString() || '').toLowerCase();
      if (fbStr.includes('cancel') || fbStr.includes('abort')) {
        return { success: false, isCancelled: true, message: 'تم إلغاء اختيار طابعة البلوتوث.' };
      }
      return {
        success: false,
        isPermissionsPolicyBlocked: fbStr.includes('permissions policy') || fbStr.includes('disallowed'),
        message: fbStr.includes('permissions policy') 
          ? 'خاصية البلوتوث المباشرة مقيدة في هذه البيئة. يمكنك استخدام خيار "طباعة القائمة" لاختيار طابعة البلوتوث المقترنة بالنظام.'
          : fallbackErr?.message || 'تعذر الاتصال بطابعة البلوتوث.'
      };
    }
  }

  if (!device || !device.gatt) {
    return { success: false, isCancelled: true, message: 'لم يتم اختيار طابعة بلوتوث.' };
  }

  try {
    const server = await device.gatt.connect();
    
    // Find primary service and writable characteristic
    let targetCharacteristic: any = null;
    const services = await server.getPrimaryServices();

    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            targetCharacteristic = char;
            break;
          }
        }
      } catch (e) {}
      if (targetCharacteristic) break;
    }

    if (!targetCharacteristic) {
      return { success: false, message: 'تم الاتصال بالطابعة ولكن لم يتم العثور على منفذ الطباعة (Write Characteristic).' };
    }

    const plainText = formatInvoicePlainText(invoice, settings);
    const dataBuffer = createEscPosBuffer(plainText);

    // Send chunks (max 512 bytes per chunk for BLE transmission)
    const chunkSize = 100;
    for (let i = 0; i < dataBuffer.length; i += chunkSize) {
      const chunk = dataBuffer.slice(i, i + chunkSize);
      if (targetCharacteristic.writeValueWithResponse) {
        await targetCharacteristic.writeValueWithResponse(chunk);
      } else {
        await targetCharacteristic.writeValue(chunk);
      }
    }

    return { success: true, message: `تم إرسال القائمة بنجاح إلى طابعة البلوتوث (${device.name || 'طابعة لاسلكية'})` };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'حدث خطأ أثناء إرسال البيانات لطابعة البلوتوث.'
    };
  }
};

/**
 * Downloads invoice directly as a clean PDF file using jsPDF and html2canvas-pro.
 * 100% reliable across Desktop PC, Android, and tablets.
 * Accurately supports modern Tailwind CSS v4 colors (oklch) and Arabic fonts.
 */
export const downloadInvoicePDF = async (
  elementId: string, 
  filename: string, 
  layout: 'a4' | 'a5' | 'thermal' = 'thermal'
): Promise<boolean> => {
  const element = document.getElementById(elementId);
  if (!element) return false;

  // Determine standard off-screen capture width (in px at 96 DPI):
  // A4: 210mm (~794px)
  // A5: 148mm (~560px)
  // Thermal: 80mm (~302px)
  let targetWidthPx = 794;
  if (layout === 'a5') targetWidthPx = 560;
  if (layout === 'thermal') targetWidthPx = 302;

  // Create isolated offscreen container with exact fixed width so mobile screen width never clips content
  const cloneWrapper = document.createElement('div');
  cloneWrapper.style.position = 'fixed';
  cloneWrapper.style.left = '-9999px';
  cloneWrapper.style.top = '0';
  cloneWrapper.style.width = `${targetWidthPx}px`;
  cloneWrapper.style.zIndex = '-9999';
  cloneWrapper.style.background = '#ffffff';
  cloneWrapper.style.overflow = 'visible';
  cloneWrapper.setAttribute('dir', 'rtl');

  const clone = element.cloneNode(true) as HTMLElement;
  // Ensure the clone takes 100% of targetWidthPx and does not scroll or clip
  clone.style.width = `${targetWidthPx}px`;
  clone.style.maxWidth = `${targetWidthPx}px`;
  clone.style.minWidth = `${targetWidthPx}px`;
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';
  clone.style.border = 'none';

  // Make sure any inner scroll containers in the clone are set to overflow visible
  const scrollContainers = clone.querySelectorAll('.overflow-x-auto, .overflow-y-auto');
  scrollContainers.forEach((sc) => {
    (sc as HTMLElement).style.overflow = 'visible';
    (sc as HTMLElement).style.width = '100%';
  });

  cloneWrapper.appendChild(clone);
  document.body.appendChild(cloneWrapper);

  try {
    // Wait a brief tick for fonts/layout to settle
    await new Promise((r) => setTimeout(r, 60));

    // html2canvas-pro handles oklch colors and renders full Arabic text accurately
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: targetWidthPx,
      windowWidth: targetWidthPx,
    });

    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      return false;
    }

    const imgData = canvas.toDataURL('image/jpeg', 0.98);

    let pdf: jsPDF;
    if (layout === 'thermal') {
      const thermalWidthMm = 80;
      const thermalHeightMm = Math.max(80, (canvas.height * thermalWidthMm) / canvas.width);
      pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [thermalWidthMm, thermalHeightMm]
      });
      pdf.addImage(imgData, 'JPEG', 0, 0, thermalWidthMm, thermalHeightMm);
    } else if (layout === 'a5') {
      pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a5'
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = (canvas.height * pageWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
    } else {
      pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = (canvas.height * pageWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
    }

    pdf.save(`${filename}.pdf`);
    return true;
  } catch (err) {
    console.error('downloadInvoicePDF error:', err);
    return false;
  } finally {
    cloneWrapper.remove();
  }
};

/**
 * Dynamically applies exact paper dimensions and margins (@page rule) in the document head
 * so that when the browser Print / Print to PDF dialog opens, the margins and paper sizes
 * defined for A4, A5, or Thermal 80mm are accurately applied without clipping.
 */
export const applyPrintPageDimensions = (layout: 'a4' | 'a5' | 'thermal'): void => {
  if (typeof document === 'undefined') return;

  let styleEl = document.getElementById('invoice-print-paper-margins') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'invoice-print-paper-margins';
    document.head.appendChild(styleEl);
  }

  let pageRule = '';
  let invoiceSizing = '';

  if (layout === 'thermal') {
    pageRule = `
      @page {
        size: 80mm auto;
        margin: 0mm !important;
      }
    `;
    invoiceSizing = `
      html, body {
        width: 80mm !important;
        max-width: 80mm !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      #printable-invoice {
        width: 78mm !important;
        max-width: 78mm !important;
        margin: 0 auto !important;
        padding: 2mm 3mm !important;
        font-size: 11px !important;
        border: none !important;
        box-shadow: none !important;
      }
    `;
  } else if (layout === 'a5') {
    pageRule = `
      @page {
        size: A5 portrait;
        margin: 4mm 5mm !important;
      }
    `;
    invoiceSizing = `
      html, body {
        margin: 0 !important;
        padding: 0 !important;
      }
      #printable-invoice {
        width: 100% !important;
        max-width: 148mm !important;
        margin: 0 auto !important;
        padding: 4mm 5mm !important;
        font-size: 12px !important;
        box-shadow: none !important;
      }
    `;
  } else {
    // Standard A4
    pageRule = `
      @page {
        size: A4 portrait;
        margin: 6mm 8mm !important;
      }
    `;
    invoiceSizing = `
      html, body {
        margin: 0 !important;
        padding: 0 !important;
      }
      #printable-invoice {
        width: 100% !important;
        max-width: 210mm !important;
        margin: 0 auto !important;
        padding: 6mm 8mm !important;
        box-shadow: none !important;
      }
    `;
  }

  styleEl.innerHTML = `
    ${pageRule}
    @media print {
      ${pageRule}
      ${invoiceSizing}
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      tr, .print-keep-together {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      thead {
        display: table-header-group !important;
      }
      tfoot {
        display: table-footer-group !important;
      }
    }
  `;
};

/**
 * Removes the dynamic print paper dimensions style element from document head
 */
export const removePrintPageDimensions = (): void => {
  if (typeof document === 'undefined') return;
  const styleEl = document.getElementById('invoice-print-paper-margins');
  if (styleEl) styleEl.remove();
};

/**
 * Prints invoice via a dedicated isolated hidden iframe.
 * Never opens a separate window. Copies document styles so all fonts and borders are preserved.
 */
export const printInvoiceViaIframe = (
  elementIdOrHtml: string, 
  title: string, 
  layout: 'a4' | 'a5' | 'thermal' = 'thermal'
): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      let contentHtml = '';
      const existingEl = document.getElementById(elementIdOrHtml);
      if (existingEl) {
        contentHtml = existingEl.outerHTML;
      } else {
        contentHtml = elementIdOrHtml;
      }

      if (!contentHtml) {
        resolve(false);
        return;
      }

      // Collect all head stylesheets and inline styles from current page
      const styleNodes = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'));
      const headStylesHtml = styleNodes.map((s) => s.outerHTML).join('\n');

      const oldIframe = document.getElementById('pos-print-hidden-iframe');
      if (oldIframe) oldIframe.remove();

      const iframe = document.createElement('iframe');
      iframe.id = 'pos-print-hidden-iframe';
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';

      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) {
        resolve(false);
        return;
      }

      let pageSizeCss = '@page { size: A4 portrait; margin: 6mm 8mm; }';
      let bodyWidthCss = 'width: 100%; max-width: 210mm; margin: 0 auto; padding: 6mm 8mm;';
      if (layout === 'thermal') {
        pageSizeCss = '@page { size: 80mm auto; margin: 0mm; }';
        bodyWidthCss = 'width: 78mm; max-width: 78mm; margin: 0 auto; padding: 2mm 3mm; font-size: 11px;';
      } else if (layout === 'a5') {
        pageSizeCss = '@page { size: A5 portrait; margin: 4mm 5mm; }';
        bodyWidthCss = 'width: 100%; max-width: 148mm; margin: 0 auto; padding: 4mm 5mm; font-size: 12px;';
      }

      const fullHtml = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          ${headStylesHtml}
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
          <style>
            ${pageSizeCss}
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              font-family: 'Cairo', system-ui, sans-serif !important;
              background: #ffffff !important;
              color: #000000 !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            body {
              ${bodyWidthCss}
            }
            #printable-invoice {
              box-shadow: none !important;
              border: none !important;
              margin: 0 auto !important;
              padding: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
            }
            .no-print { display: none !important; }
            tr, .print-keep-together {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            thead { display: table-header-group !important; }
            tfoot { display: table-footer-group !important; }
          </style>
        </head>
        <body>
          ${contentHtml}
        </body>
        </html>
      `;

      iframeDoc.open();
      iframeDoc.write(fullHtml);
      iframeDoc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve(true);
        } catch (e) {
          console.warn("Iframe print invocation error:", e);
          resolve(false);
        }
      }, 300);
    } catch (err) {
      console.warn("printInvoiceViaIframe error:", err);
      resolve(false);
    }
  });
};

/**
 * Master Direct Print Function:
 * 1. Prepares exact @page dimensions and margins in document head.
 * 2. Invokes browser print (which natively supports "Print to PDF" with the exact margins and file title).
 * 3. Falls back to isolated hidden iframe if needed.
 */
export const printInvoiceDirectly = async (
  elementId: string, 
  title: string, 
  layout: 'a4' | 'a5' | 'thermal' = 'thermal'
): Promise<boolean> => {
  // Apply paper dimensions and margins in head
  applyPrintPageDimensions(layout);

  const oldTitle = document.title;
  document.title = title;

  try {
    window.print();
    return true;
  } catch (err) {
    console.warn("Native window.print failed, attempting iframe print fallback", err);
    return await printInvoiceViaIframe(elementId, title, layout);
  } finally {
    setTimeout(() => {
      document.title = oldTitle;
    }, 1200);
  }
};
