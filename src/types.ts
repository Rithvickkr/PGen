export type Level = 'beginner' | 'intermediate' | 'advanced';

export type AnswerValue = string | string[];
export type Answers = Record<string, AnswerValue>;

export interface Option {
  value: string;
  label: string;
  hint?: string;
}

/**
 * text / textarea — free text
 * single          — pill buttons, one choice (click again to clear)
 * cards           — large option cards with hints, one choice
 * multi           — toggle chips, many choices (optionally custom entries)
 * list            — an editable list of free-text items
 */
export type FieldType = 'text' | 'textarea' | 'single' | 'cards' | 'multi' | 'list';

export interface Question {
  id: string;
  type: FieldType;
  label: string;
  help?: string;
  placeholder?: string;
  options?: Option[];
  /** Minimum prompt level at which this question is asked. Defaults to beginner. */
  level?: Level;
  showIf?: (answers: Answers) => boolean;
  /** For multi: let people add their own chips. */
  allowCustom?: boolean;
}

export interface Step {
  id: string;
  title: string;
  /** Shorter label for the sidebar. */
  navTitle?: string;
  subtitle: string;
  level?: Level;
  showIf?: (answers: Answers) => boolean;
  questions: Question[];
}
