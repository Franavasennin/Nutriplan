/**
 * Lee un archivo PDF y lo convierte a base64.
 * No necesita pdf.js — Mistral acepta PDFs directamente.
 *
 * Validaciones de seguridad:
 * - Solo acepta MIME type application/pdf
 * - Solo acepta extensión .pdf
 * - Límite de tamaño: 15 MB
 */

const PDF_MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

export const readPDFAsBase64 = (file: File): Promise<string> => {
  // ── Validar MIME type ────────────────────────────────────────────────────────
  if (file.type !== 'application/pdf') {
    return Promise.reject(
      new Error('Solo se aceptan archivos PDF. El archivo seleccionado no es un PDF válido.')
    );
  }

  // ── Validar extensión ────────────────────────────────────────────────────────
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return Promise.reject(
      new Error('El archivo debe tener extensión .pdf.')
    );
  }

  // ── Validar tamaño (15 MB máx) ────────────────────────────────────────────────
  if (file.size > PDF_MAX_SIZE_BYTES) {
    return Promise.reject(
      new Error('El PDF es demasiado grande. El tamaño máximo permitido es 15 MB.')
    );
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => {
      const dataUrl = reader.result as string;
      // Quita el prefijo "data:application/pdf;base64," y devuelve solo el base64
      resolve(dataUrl.split(',')[1]);
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo PDF.'));
    reader.readAsDataURL(file);
  });
};
