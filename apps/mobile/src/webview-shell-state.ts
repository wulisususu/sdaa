type NativeLoadErrorInput = {
  hasLoadedMainDocument: boolean;
  failedUrl: string;
  mainDocumentUrl: string;
};

function canonicalDocumentUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

export function shouldShowNativeLoadError({
  hasLoadedMainDocument,
  failedUrl,
  mainDocumentUrl
}: NativeLoadErrorInput): boolean {
  if (hasLoadedMainDocument) {
    return false;
  }

  const failedDocument = canonicalDocumentUrl(failedUrl);
  const mainDocument = canonicalDocumentUrl(mainDocumentUrl);

  return failedDocument !== null && mainDocument !== null && failedDocument === mainDocument;
}
