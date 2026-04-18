export interface ResumeFile {
  fileName: string;
  mimeType: string;
  dataUrl: string;
  updatedAt: string;
}

export interface ProfileContact {
  email: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
}

export interface ProfileExperience {
  id: string;
  company: string;
  title: string;
  startDate: string;
  endDate?: string;
  summary?: string;
}

export interface ProfileEducation {
  id: string;
  institution: string;
  degree: string;
  startDate?: string;
  endDate?: string;
}

export interface CandidateProfile {
  id: string;
  fullName: string;
  headline?: string;
  summary?: string;
  contact: ProfileContact;
  experiences: ProfileExperience[];
  education: ProfileEducation[];
  skills: string[];
  languages: string[];
  resume?: ResumeFile;
  customAnswers: Record<string, string>;
  updatedAt: string;
}

export function createCandidateProfile(
  overrides: Partial<CandidateProfile> = {},
): CandidateProfile {
  return {
    id: overrides.id ?? 'default',
    fullName: overrides.fullName ?? '',
    headline: overrides.headline,
    summary: overrides.summary,
    contact: {
      email: '',
      ...overrides.contact,
    },
    experiences: overrides.experiences ?? [],
    education: overrides.education ?? [],
    skills: overrides.skills ?? [],
    languages: overrides.languages ?? [],
    resume: overrides.resume,
    customAnswers: overrides.customAnswers ?? {},
    updatedAt: overrides.updatedAt ?? new Date(0).toISOString(),
  };
}
