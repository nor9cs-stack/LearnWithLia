export const APP_CONFIG = {
  name: "LearnWithLia",
  footerBrand: "Libraread Tutoring Program",
  upload: {
    maxBytes: 15 * 1024 * 1024,
    signedUrlTtlSeconds: 60,
    allowedExtensions: ["pdf", "docx", "doc"] as const,
  },
  unknownWord: {
    maxLength: 160,
    contextLength: 48,
  },
  attempts: {
    minTimeLimitMinutes: 1,
    maxTimeLimitMinutes: 8 * 60,
  },
} as const;
