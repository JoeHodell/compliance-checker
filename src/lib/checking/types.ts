export type FlagCandidate = {
  ruleId: string | null;
  flagSource: "CLIENT_RULE" | "GRAMMAR";
  category:
    | "BANNED_WORD"
    | "REQUIRED_PHRASING"
    | "TONE_VOICE"
    | "STRUCTURAL_FORMATTING"
    | "NAMING_CONVENTION"
    | "POV_VOICE_RESTRICTION"
    | "GRAMMAR_MECHANICAL"
    | "OTHER";
  severity: "HARD" | "STYLE";
  location: { paragraphIndex: number; startOffset: number; endOffset: number };
  matchedText: string;
  message: string;
};
