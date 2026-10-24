/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where the enquiry form POSTs (a form service URL). Empty = open the visitor's email app instead. */
  readonly VITE_FORM_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
