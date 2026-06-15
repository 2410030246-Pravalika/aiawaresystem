export interface CampaignHindi {
  slogan: string;
  socialMediaPost: string;
  posterHeadline: string;
  posterSubheadline: string;
  posterCta: string;
  awarenessMessage: string;
}

export interface CampaignData {
  topic: string;
  audience: string;
  tone: string;
  language?: 'english' | 'hindi';
  slogan: string;
  socialMediaPost: string;
  posterHeadline: string;
  posterSubheadline: string;
  posterCta: string;
  awarenessMessage: string;
  hashtags: string[];
  posterImagePrompt: string;
  emailCampaign: string;
  captionVariations: string[];
  hindi: CampaignHindi;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  topic: string;
  audience: string;
  tone: string;
  campaign: CampaignData;
}

export interface AnalyticsData {
  totalGenerated: number;
  topicCounts: { [key: string]: number };
  audienceCounts: { [key: string]: number };
}
