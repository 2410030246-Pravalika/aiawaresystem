import { useState, useEffect, FormEvent, MouseEvent } from "react";
import { 
  BookOpen, 
  TreePine, 
  Sparkles, 
  Heart, 
  Activity, 
  Tv, 
  Users, 
  GraduationCap, 
  Briefcase, 
  HeartHandshake, 
  Download, 
  Copy, 
  Check, 
  Sparkle, 
  RefreshCw, 
  Globe, 
  Mail, 
  Image as ImageIcon, 
  Calendar, 
  BarChart3, 
  ChevronRight, 
  Trash2, 
  FolderHeart,
  MessageSquare,
  Volume2,
  BookmarkCheck,
  Building2,
  FlameKindling,
  FileDown
} from "lucide-react";
import { TOPICS, AUDIENCES, TONES, NGO_FACTS } from "./data";
import { CampaignData, HistoryItem, AnalyticsData } from "./types";
import { jsPDF } from "jspdf";

export default function App() {
  // Input parameters state
  const [selectedTopic, setSelectedTopic] = useState<string>(TOPICS[0].id);
  const [selectedAudience, setSelectedAudience] = useState<string>(AUDIENCES[0].id);
  const [selectedTone, setSelectedTone] = useState<string>(TONES[0].id);
  
  // UI states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingFactIndex, setLoadingFactIndex] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [currentCampaign, setCurrentCampaign] = useState<CampaignData | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<'english' | 'hindi'>('english');
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  
  // Notification / Toast state
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  // History & Analytics states
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalGenerated: 0,
    topicCounts: {},
    audienceCounts: {}
  });

  // Cycle loading facts while generating
  useEffect(() => {
    let interval: any;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingFactIndex((prev) => (prev + 1) % NGO_FACTS.length);
      }, 4500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // Load history & analytics from LocalStorage on mount
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem("nayepankh_campaign_history");
      if (storedHistory) {
        const parsed = JSON.parse(storedHistory);
        setHistory(parsed);
      }

      const storedAnalytics = localStorage.getItem("nayepankh_campaign_analytics");
      if (storedAnalytics) {
        setAnalytics(JSON.parse(storedAnalytics));
      } else if (storedHistory) {
        // Rebuild basic metrics if history exists but analytics doesn't
        const parsed = JSON.parse(storedHistory) as HistoryItem[];
        rebuildAnalyticsFromHistory(parsed);
      }
    } catch (err) {
      console.error("Error reading LocalStorage: ", err);
    }
  }, []);

  // Helper to re-calculate stats
  const rebuildAnalyticsFromHistory = (items: HistoryItem[]) => {
    const tCounts: { [key: string]: number } = {};
    const aCounts: { [key: string]: number } = {};
    items.forEach(item => {
      tCounts[item.topic] = (tCounts[item.topic] || 0) + 1;
      aCounts[item.audience] = (aCounts[item.audience] || 0) + 1;
    });
    
    const newAnalytics = {
      totalGenerated: items.length,
      topicCounts: tCounts,
      audienceCounts: aCounts
    };
    setAnalytics(newAnalytics);
    localStorage.setItem("nayepankh_campaign_analytics", JSON.stringify(newAnalytics));
  };

  // Safe display notifications
  const triggerCopyFeedback = (sectionId: string) => {
    setCopiedSection(sectionId);
    setTimeout(() => {
      setCopiedSection(null);
    }, 2000);
  };

  const showBanner = (msg: string) => {
    setBannerMessage(msg);
    setTimeout(() => {
      setBannerMessage(null);
    }, 3500);
  };

  // Core API caller to server-side Gemini Proxy
  const handleGenerate = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError(null);
    setLoadingFactIndex(Math.floor(Math.random() * NGO_FACTS.length));

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: selectedTopic,
          audience: selectedAudience,
          tone: selectedTone
        })
      });

      if (!response.ok) {
        let errorMessage = "Failed to generate campaign";
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errData = await response.json();
            errorMessage = errData.error || errData.details || errorMessage;
          } else {
            const textData = await response.text();
            if (textData.length < 200 && textData.trim()) {
              errorMessage = textData.trim();
            } else {
              errorMessage = `Server error ${response.status}. This may be caused by a missing GEMINI_API_KEY environment variable in Vercel/hosting environment, or a Vercel serverless function timeout. Please ensure you have added GEMINI_API_KEY in your Vercel Environment Variables!`;
            }
          }
        } catch (parseErr) {
          errorMessage = `Server error ${response.status}.`;
        }
        throw new Error(errorMessage);
      }

      let campaignResult: CampaignData;
      const contentType = response.headers.get("content-type");

      if (contentType && contentType.includes("text/event-stream")) {
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Unable to initialize response stream reader.");
        }

        const decoder = new TextDecoder("utf-8");
        let accumulatedText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulatedText += decoder.decode(value, { stream: true });
        }

        try {
          let cleanedText = accumulatedText.trim();
          // Strip any potential markdown wrappers if the model generated them
          if (cleanedText.startsWith("```")) {
            cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, "");
            cleanedText = cleanedText.replace(/\s*```$/, "");
            cleanedText = cleanedText.trim();
          }

          const parsed = JSON.parse(cleanedText);
          if (parsed && (parsed.error || parsed.details)) {
            throw new Error(parsed.details || parsed.error);
          }
          campaignResult = parsed;
        } catch (parseError: any) {
          console.error("Failed to parse streamed campaign JSON output: ", parseError);
          const parsedMsg = parseError?.message || "";
          if (parsedMsg.includes("Streaming interrupted") || accumulatedText.includes("Streaming interrupted")) {
            throw new Error(`The campaign generation stream was interrupted. Please try again.`);
          }
          throw new Error(parseError?.message || "The campaign model response was incomplete or failed to build valid JSON format. Please try again.");
        }
      } else {
        const parsed = await response.json();
        if (parsed && (parsed.error || parsed.details)) {
          throw new Error(parsed.details || parsed.error);
        }
        campaignResult = parsed;
      }
      
      // Inject selected metadata
      campaignResult.topic = selectedTopic;
      campaignResult.audience = selectedAudience;
      campaignResult.tone = selectedTone;

      setCurrentCampaign(campaignResult);
      setActiveLanguage('english'); // Default to English after new receipt

      // Save to History List
      const newHistoryItem: HistoryItem = {
        id: "camp_" + Date.now(),
        timestamp: Date.now(),
        topic: selectedTopic,
        audience: selectedAudience,
        tone: selectedTone,
        campaign: campaignResult
      };

      const updatedHistory = [newHistoryItem, ...history.slice(0, 19)]; // limit to last 20 elements
      setHistory(updatedHistory);
      localStorage.setItem("nayepankh_campaign_history", JSON.stringify(updatedHistory));

      // Calculate new analytics live
      const newTopicCounts = { ...analytics.topicCounts };
      const newAudienceCounts = { ...analytics.audienceCounts };
      newTopicCounts[selectedTopic] = (newTopicCounts[selectedTopic] || 0) + 1;
      newAudienceCounts[selectedAudience] = (newAudienceCounts[selectedAudience] || 0) + 1;

      const newAnalytics: AnalyticsData = {
        totalGenerated: analytics.totalGenerated + 1,
        topicCounts: newTopicCounts,
        audienceCounts: newAudienceCounts
      };
      setAnalytics(newAnalytics);
      localStorage.setItem("nayepankh_campaign_analytics", JSON.stringify(newAnalytics));

      showBanner("✨ AI awareness campaign generated successfully!");

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during campaign generation.");
    } finally {
      setIsLoading(false);
    }
  };

  // Reload previous item from list
  const loadHistoryItem = (item: HistoryItem) => {
    setCurrentCampaign(item.campaign);
    setSelectedTopic(item.topic);
    setSelectedAudience(item.audience);
    setSelectedTone(item.tone);
    showBanner(`📂 Loaded historical campaign for "${item.topic}"`);
  };

  // Delete history item
  const deleteHistoryItem = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    const filtered = history.filter(item => item.id !== id);
    setHistory(filtered);
    localStorage.setItem("nayepankh_campaign_history", JSON.stringify(filtered));
    rebuildAnalyticsFromHistory(filtered);
    showBanner("🗑️ Campaign history record deleted");
  };

  // Clear all localStorage records
  const clearAllHistory = () => {
    setHistory([]);
    const freshAnalytics = { totalGenerated: 0, topicCounts: {}, audienceCounts: {} };
    setAnalytics(freshAnalytics);
    localStorage.removeItem("nayepankh_campaign_history");
    localStorage.removeItem("nayepankh_campaign_analytics");
    setCurrentCampaign(null);
    setShowClearConfirm(false);
    showBanner("✨ All history & analytics have been cleared.");
  };

  // Robust fallback copying mechanism for iframe and security sandbox wrappers
  const fallbackCopy = (text: string, label: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        triggerCopyFeedback(label);
      } else {
        console.error("Fallback execCommand copy failed");
      }
    } catch (err) {
      console.error("Fallback copying failure:", err);
    }
    document.body.removeChild(textArea);
  };

  // Helper copy content action supporting browser and fallback mechanisms
  const handleCopyText = (textToCopy: string, label: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy)
          .then(() => triggerCopyFeedback(label))
          .catch((err) => {
            console.warn("Clipboard API write failed, attempting fallback:", err);
            fallbackCopy(textToCopy, label);
          });
      } else {
        fallbackCopy(textToCopy, label);
      }
    } catch (e) {
      console.warn("Clipboard API wrapper exception, using fallback Copy:", e);
      fallbackCopy(textToCopy, label);
    }
  };

  // Copy whole campaign text representation leveraging robust copy handlers
  const handleCopyAll = () => {
    if (!currentCampaign) return;
    
    const plainText = `
CAMPAIGN OVERVIEW: ${currentCampaign.topic} Campaign
-----------------------------------------------------------
NGO Sponsor: NayePankh Foundation
Target Audience: ${currentCampaign.audience}
Content Tone: ${currentCampaign.tone}

1. CAMPAIGN SLOGAN:
   ${activeLanguage === 'english' ? currentCampaign.slogan : currentCampaign.hindi.slogan}

2. POSTER HEADLINE:
   ${activeLanguage === 'english' ? currentCampaign.posterHeadline : currentCampaign.hindi.posterHeadline}

3. POSTER SUBHEADLINE:
   ${activeLanguage === 'english' ? currentCampaign.posterSubheadline : currentCampaign.hindi.posterSubheadline}

4. POSTER CALL TO ACTION (CTA):
   ${activeLanguage === 'english' ? currentCampaign.posterCta : currentCampaign.hindi.posterCta}

5. IMPACT AWARENESS MESSAGE:
   ${activeLanguage === 'english' ? currentCampaign.awarenessMessage : currentCampaign.hindi.awarenessMessage}

6. SOCIAL MEDIA POST:
   ${activeLanguage === 'english' ? currentCampaign.socialMediaPost : currentCampaign.hindi.socialMediaPost}

7. HASHTAGS:
   ${currentCampaign.hashtags.join(" ")}

8. EMAIL NEWSLETTER DRAFT:
   ${currentCampaign.emailCampaign}

9. POSTER IMAGE PROMPT (IMAGEN):
   ${currentCampaign.posterImagePrompt}
`;
    handleCopyText(plainText.trim(), "all-assets");
    showBanner("📋 Copied full campaign clipboard dossier!");
  };

  // Action: Export as simple text file
  const handleDownloadTxt = () => {
    if (!currentCampaign) return;
    
    const dataOutput = `===================================================
AWARENESS CAMPAIGN DOSSIER — NAYEPANKH FOUNDATION
===================================================
Subject Topic   : ${currentCampaign.topic}
Target Audience : ${currentCampaign.audience}
Campaign Tone   : ${currentCampaign.tone}
Language        : ${activeLanguage.toUpperCase()}
Generated on    : ${new Date().toLocaleDateString()}

---------------------------------------------------
1. LOGLINE & SLOGAN
---------------------------------------------------
Slogan : "${activeLanguage === 'english' ? currentCampaign.slogan : currentCampaign.hindi.slogan}"

---------------------------------------------------
2. PRINT/POSTER GRAPHICS COPY
---------------------------------------------------
Primary Headline    : ${activeLanguage === 'english' ? currentCampaign.posterHeadline : currentCampaign.hindi.posterHeadline}
Supporting Subtext  : ${activeLanguage === 'english' ? currentCampaign.posterSubheadline : currentCampaign.hindi.posterSubheadline}
Call To Action (CTA): ${activeLanguage === 'english' ? currentCampaign.posterCta : currentCampaign.hindi.posterCta}

---------------------------------------------------
3. KEY IMPACT RESONANCE STATEMENT
---------------------------------------------------
"${activeLanguage === 'english' ? currentCampaign.awarenessMessage : currentCampaign.hindi.awarenessMessage}"

---------------------------------------------------
4. ENGAGING SOCIAL POST DRAFT
---------------------------------------------------
${activeLanguage === 'english' ? currentCampaign.socialMediaPost : currentCampaign.hindi.socialMediaPost}

Hashtags:
${currentCampaign.hashtags.join(" ")}

---------------------------------------------------
5. MINI-CAPTION SOCIAL VARIATIONS
---------------------------------------------------
${currentCampaign.captionVariations.map((c, i) => `[Variant #${i+1}] ${c}`).join("\n\n")}

---------------------------------------------------
6. EMAIL NEWSLETTER SUITE
---------------------------------------------------
${currentCampaign.emailCampaign}

---------------------------------------------------
7. DESCRIPTION FOR IMAGE GENERATION
---------------------------------------------------
Prompt for Imagen/Midjourney:
"${currentCampaign.posterImagePrompt}"

===================================================
Generated with AI Awareness Campaign Generator
`;

    const blob = new Blob([dataOutput], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Campaign_${currentCampaign.topic.replace(/\s+/g, '_')}_${activeLanguage}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showBanner("💾 Campaign exported as TXT file successfully!");
  };

  // Action: File Download as beautifully structured PDF using jsPDF
  const handleDownloadPdf = () => {
    if (!currentCampaign) return;

    try {
      const doc = new jsPDF();
      
      // Title
      doc.setFillColor(13, 148, 136); // Teal primary header bar
      doc.rect(0, 0, 210, 40, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("NAYEPANKH FOUNDATION", 15, 18);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text("AI-POWERED CAMPAIGN BLUEPRINT", 15, 26);
      doc.text(`DATE: ${new Date().toLocaleDateString()} | TONE: ${currentCampaign.tone.toUpperCase()}`, 15, 32);

      // Metadata Cards block
      doc.setTextColor(50, 50, 50);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("CORE CAMPAIGN SCOPE", 15, 52);
      doc.line(15, 54, 195, 54);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Cause Topic: ${currentCampaign.topic}`, 15, 61);
      doc.text(`Target Audience: ${currentCampaign.audience}`, 15, 67);
      doc.text(`Output Translation View: ${activeLanguage.toUpperCase()}`, 15, 73);

      // Section 1: Catchy Slogan
      doc.setFont("helvetica", "bold");
      doc.text("1. OUTREACH SLOGAN", 15, 83);
      doc.line(15, 85, 195, 85);

      const sloganValue = activeLanguage === 'english' ? currentCampaign.slogan : currentCampaign.hindi.slogan;
      doc.setFont("helvetica", "oblique");
      const sloganLines = doc.splitTextToSize(`"${sloganValue}"`, 175);
      doc.text(sloganLines, 15, 92);

      // Section 2: Poster Elements
      let currentY = 92 + (sloganLines.length * 5) + 8;
      doc.setFont("helvetica", "bold");
      doc.text("2. PRINT MEDIA / POSTER GRAPHICS", 15, currentY);
      doc.line(15, currentY + 2, 195, currentY + 2);
      currentY += 9;

      doc.setFont("helvetica", "bold");
      doc.text("Primary Headline: ", 15, currentY);
      doc.setFont("helvetica", "normal");
      const headlineStr = activeLanguage === 'english' ? currentCampaign.posterHeadline : currentCampaign.hindi.posterHeadline;
      doc.text(headlineStr, 50, currentY);
      currentY += 6;

      doc.setFont("helvetica", "bold");
      doc.text("Supporting Subhead: ", 15, currentY);
      doc.setFont("helvetica", "normal");
      const subheadStr = activeLanguage === 'english' ? currentCampaign.posterSubheadline : currentCampaign.hindi.posterSubheadline;
      const subheadLines = doc.splitTextToSize(subheadStr, 140);
      doc.text(subheadLines, 54, currentY);
      currentY += (subheadLines.length * 5) + 1;

      doc.setFont("helvetica", "bold");
      doc.text("Call To Action (CTA): ", 15, currentY);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(13, 148, 136); // Teal emphasis
      const ctaStr = activeLanguage === 'english' ? currentCampaign.posterCta : currentCampaign.hindi.posterCta;
      doc.text(ctaStr, 54, currentY);
      doc.setTextColor(50, 50, 50);
      currentY += 12;

      // Section 3: Impact Statement
      doc.setFont("helvetica", "bold");
      doc.text("3. KEY IMPACT RESOUNDING PARAGRAPH", 15, currentY);
      doc.line(15, currentY + 2, 195, currentY + 2);
      currentY += 9;

      doc.setFont("helvetica", "normal");
      const impactValue = activeLanguage === 'english' ? currentCampaign.awarenessMessage : currentCampaign.hindi.awarenessMessage;
      const impactLines = doc.splitTextToSize(impactValue, 175);
      doc.text(impactLines, 15, currentY);
      currentY += (impactLines.length * 5) + 12;

      // Add a page for the rest of documents to look beautiful
      doc.addPage();
      
      // Page 2 header
      doc.setFillColor(15, 23, 42); // slate deep color bar
      doc.rect(0, 0, 210, 15, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("AWARENESS CAMPAIGN DOSSIER — SOCIAL AND EMAIL SERVICES", 15, 10);

      doc.setTextColor(50, 50, 50);
      currentY = 28;

      // Section 4: Social media post
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("4. DIGITAL / SOCIAL MEDIA PUBLISHING MODEL", 15, currentY);
      doc.line(15, currentY + 2, 195, currentY + 2);
      currentY += 9;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const postValue = activeLanguage === 'english' ? currentCampaign.socialMediaPost : currentCampaign.hindi.socialMediaPost;
      const postLines = doc.splitTextToSize(postValue, 175);
      doc.text(postLines, 15, currentY);
      currentY += (postLines.length * 5) + 6;

      // Hashtags container box
      doc.setFillColor(244, 244, 245);
      doc.rect(14, currentY, 182, 16, "F");
      doc.setDrawColor(228, 228, 231);
      doc.rect(14, currentY, 182, 16, "S");
      doc.setFont("helvetica", "bold");
      doc.text("Campaign Hashtags:", 18, currentY + 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const tagLines = doc.splitTextToSize(currentCampaign.hashtags.join(" "), 170);
      doc.text(tagLines, 18, currentY + 11);
      
      currentY += 26;
      doc.setFontSize(10);

      // Section 5: Email Draft
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("5. EMAIL CAMPAIGN & ADVANCED ENGAGEMENT NEWSLETTER", 15, currentY);
      doc.line(15, currentY + 2, 195, currentY + 2);
      currentY += 9;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      const emailLines = doc.splitTextToSize(currentCampaign.emailCampaign, 180);
      doc.text(emailLines, 15, currentY);
      currentY += (emailLines.length * 5) + 12;

      // Add one more page for prompt details if required, or put it on the bottom
      if (currentY > 260) {
        doc.addPage();
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 210, 15, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("AWARENESS CAMPAIGN DOSSIER — ADVANCED PROMPTS AND SUGGESTIONS", 15, 10);
        doc.setTextColor(50, 50, 50);
        currentY = 28;
      }

      // Section 6: AI Poster Image prompt
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("6. AI GRAPHIC DESIGN PROMPT", 15, currentY);
      doc.line(15, currentY + 2, 195, currentY + 2);
      currentY += 9;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      const promptLines = doc.splitTextToSize(`Use this professional prompt in secure graphic generation assets (e.g., Google Imagen 3): "${currentCampaign.posterImagePrompt}"`, 175);
      doc.text(promptLines, 15, currentY);
      currentY += (promptLines.length * 5) + 10;

      // Footer brand mark
      doc.setFont("helvetica", "oblique");
      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);
      doc.text("Designed for NayePankh Foundation. Generated utilizing state-of-the-art Google Gemini 3.5 AI.", 15, 285);

      doc.save(`NayePankh_Campaign_${selectedTopic.replace(/\s+/g, "_")}.pdf`);
      showBanner("💾 Campaign exported as custom PDF successfully!");
    } catch (pdfErr) {
      console.error("PDF generation failed: ", pdfErr);
      showBanner("❌ PDF generation failed. Downloading text template fallback.");
      handleDownloadTxt();
    }
  };

  // Helper analytics calculations
  const totalCampaignsRun = analytics.totalGenerated;
  
  const getMostDemandedTopic = () => {
    const entries = Object.entries(analytics.topicCounts);
    if (entries.length === 0) return "None Yet";
    entries.sort((a, b) => (b[1] as number) - (a[1] as number));
    return entries[0][0];
  };

  const getMostDemandedAudience = () => {
    const entries = Object.entries(analytics.audienceCounts);
    if (entries.length === 0) return "None Yet";
    entries.sort((a, b) => (b[1] as number) - (a[1] as number));
    return entries[0][0];
  };

  const getTopicCount = (topicId: string) => {
    return analytics.topicCounts[topicId] || 0;
  };

  return (
    <div id="frosted_canvas_root" className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-100 font-sans text-slate-800 flex flex-col md:flex-row">
      
      {/* LEFT SIDEBAR: History & Global Analytics */}
      <aside id="sidebar" className="w-full md:w-80 shrink-0 border-b md:border-b-0 md:border-r border-white/30 bg-white/30 backdrop-blur-xl flex flex-col p-6 shadow-sm overflow-y-auto max-h-screen md:sticky md:top-0">
        
        {/* NGO Brand & App Title */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-teal-600 rounded-xl text-white shadow-md shadow-teal-600/20 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-teal-950 leading-none">NayePankh</h1>
            <p className="text-[10px] uppercase font-bold text-teal-700 tracking-wider mt-0.5">Campaign AI Suite</p>
          </div>
        </div>

        {/* Global Actionable Banner Notifications */}
        {bannerMessage && (
          <div className="mb-6 p-3 bg-teal-800/10 border border-teal-700/20 text-teal-900 rounded-xl text-xs animate-fadeIn font-medium">
            {bannerMessage}
          </div>
        )}

        {/* Sidebar Nav section */}
        <div className="space-y-7 flex-1">
          
          {/* Recent Campaigns Section */}
          <section>
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                <BookmarkCheck className="w-3.5 h-3.5 text-teal-700" /> Recent Builds
              </h2>
              {history.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {showClearConfirm ? (
                    <div className="flex items-center gap-1 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 shadow-xs">
                      <span className="text-[9px] text-red-800 font-black">Confirm?</span>
                      <button 
                        onClick={clearAllHistory}
                        className="text-[9px] text-white bg-red-600 hover:bg-red-700 font-bold px-1.5 py-0.5 rounded"
                      >
                        Yes
                      </button>
                      <button 
                        onClick={() => setShowClearConfirm(false)}
                        className="text-[9px] text-slate-700 bg-slate-200 hover:bg-slate-300 font-bold px-1 rounded"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setShowClearConfirm(true)}
                      className="text-[10px] text-red-600 hover:text-red-700 hover:underline font-bold bg-white/50 px-2 py-0.5 rounded border border-red-200/50"
                      title="Clear all memory logs"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              )}
            </div>

            {history.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center bg-white/10">
                <p className="text-xs text-slate-500 italic">No previous campaign models generated.</p>
                <button 
                  onClick={() => {
                    setSelectedTopic("Education");
                    setSelectedAudience("Parents");
                    setSelectedTone("Inspirational");
                    handleGenerate();
                  }}
                  className="mt-2.5 text-[10px] font-bold text-teal-700 hover:text-teal-800 underline block mx-auto"
                >
                  Generate Quick Prototype
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {history.map((item) => {
                  const relativeTime = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const isCurrent = currentCampaign && currentCampaign.topic === item.topic && currentCampaign.audience === item.audience;
                  
                  return (
                    <div 
                      key={item.id}
                      onClick={() => loadHistoryItem(item)}
                      className={`group p-3 rounded-xl border transition-all cursor-pointer flex justify-between items-start text-left ${
                        isCurrent 
                          ? "bg-teal-600/10 border-teal-600/30 shadow-sm"
                          : "bg-white/50 border-white/40 hover:bg-white/70 shadow-xs"
                      }`}
                    >
                      <div className="flex-1 min-w-0 mr-2">
                        <p className={`text-xs font-semibold truncate ${isCurrent ? "text-teal-950 font-bold" : "text-slate-800"}`}>
                          {item.topic}
                        </p>
                        <p className="text-[9px] text-slate-500 mt-0.5">
                          {relativeTime} • {item.audience} • <span className="italic">{item.tone}</span>
                        </p>
                      </div>
                      <button 
                        onClick={(e) => deleteHistoryItem(item.id, e)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded-md hover:bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete log"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Foundation Analytics Indicators */}
          <section id="analytics_pinnacle" className="p-4 rounded-2xl bg-white/20 border border-white/50 shadow-xs">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-600 mb-3 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-teal-700" /> Platform Insights
            </h2>
            
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              <div className="p-2.5 bg-gradient-to-br from-teal-600/5 to-teal-500/10 rounded-xl border border-teal-600/10">
                <p className="text-[9px] font-bold text-teal-800 uppercase tracking-wide">Runs</p>
                <p className="text-xl font-bold text-teal-950 mt-0.5">{totalCampaignsRun}</p>
              </div>
              <div className="p-2.5 bg-gradient-to-br from-emerald-600/5 to-emerald-500/10 rounded-xl border border-emerald-600/10">
                <p className="text-[9px] font-bold text-emerald-800 uppercase tracking-wide font-serif font-semibold">Scope</p>
                <p className="text-[11px] font-bold text-emerald-950 mt-0.5 leading-tight break-words" title={getMostDemandedTopic()}>
                  {getMostDemandedTopic()}
                </p>
              </div>
            </div>

            <div className="py-2.5 px-3 bg-white/40 rounded-xl border border-white/30 text-[10px] text-slate-600">
              <div className="flex items-start">
                <span className="w-24 shrink-0 text-slate-500 font-semibold">Top Audience:</span>
                <span className="font-bold text-slate-800 break-words leading-tight">{getMostDemandedAudience()}</span>
              </div>
            </div>
          </section>

          {/* Social Proof static support box */}
          <div className="p-4 bg-teal-950 rounded-2xl text-white relative overflow-hidden shadow-md">
            <div className="absolute -right-6 -bottom-6 w-16 h-16 bg-teal-800/20 rounded-full blur-xl" />
            <div className="flex items-start gap-1.5">
              <FlameKindling className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest">Foundation Goal</p>
                <p className="text-[11px] leading-relaxed mt-1 text-slate-100">
                  Empower 10,000+ citizens via proactive localized awareness campaigns.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Footer badge */}
        <div className="mt-8 pt-4 border-t border-white/20 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-teal-700 text-white font-extrabold flex items-center justify-center text-xs shadow-xs">
            NP
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800 truncate">NayePankh Foundation</p>
            <p className="text-[10px] text-teal-700 font-medium">Campaign Coordinator</p>
          </div>
        </div>
      </aside>

      {/* RIGHT MAIN AREA: Configuration & Live Content Sandbox */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col space-y-6 overflow-x-hidden">
        
        {/* Welcome Banner / Overview intro */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-teal-900/10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Awareness Campaign Content Generator
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Harness advanced generative intelligence to blueprint high-impact societal change with professional-grade media copywriting.
            </p>
          </div>
          
          <div className="flex items-center gap-2 bg-white/50 p-1.5 rounded-xl border border-white/80 self-start md:self-auto shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase px-2">Global Live Preview</span>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>

        {/* INPUT FORM SECTION */}
        <div id="selection_dashboard" className="p-4 sm:p-6 bg-white/50 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm">
          <form onSubmit={handleGenerate} className="space-y-6">
            
            {/* Options grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Option 1: Social Cause */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-teal-950 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-teal-600" /> Selective Social Cause
                </label>
                <div className="relative">
                  <select 
                    value={selectedTopic}
                    onChange={(e) => setSelectedTopic(e.target.value)}
                    className="w-full bg-white/80 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 shadow-xs focus:ring-2 focus:ring-teal-500 focus:outline-none focus:border-transparent transition-all"
                  >
                    {TOPICS.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        📚 {topic.name} ({getTopicCount(topic.id)} generated)
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[10px] text-slate-500 italic">
                  {TOPICS.find((t) => t.id === selectedTopic)?.description}
                </p>
              </div>

              {/* Option 2: Target Audience */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-teal-950 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-teal-600" /> Target Demographic
                </label>
                <select 
                  value={selectedAudience}
                  onChange={(e) => setSelectedAudience(e.target.value)}
                  className="w-full bg-white/80 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 shadow-xs focus:ring-2 focus:ring-teal-500 focus:outline-none focus:border-transparent transition-all"
                >
                  {AUDIENCES.map((aud) => (
                    <option key={aud.id} value={aud.id}>
                      🎯 {aud.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 italic">
                  {AUDIENCES.find((a) => a.id === selectedAudience)?.description}
                </p>
              </div>

              {/* Option 3: Tone Preset Selector */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-teal-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" /> Content Resonance Tone
                </label>
                <select 
                  value={selectedTone}
                  onChange={(e) => setSelectedTone(e.target.value)}
                  className="w-full bg-white/80 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 shadow-xs focus:ring-2 focus:ring-teal-500 focus:outline-none focus:border-transparent transition-all"
                >
                  {TONES.map((t) => (
                    <option key={t.id} value={t.id}>
                      🎭 {t.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 italic">
                  {TONES.find((t) => t.id === selectedTone)?.description}
                </p>
              </div>

            </div>

            {/* CTA action row */}
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-dashed border-slate-200">
              <div className="text-[11px] text-slate-500 text-center sm:text-left">
                NayePankh Campaign AI validates appropriate language and automatically constructs secondary drafts on submission.
              </div>
              <button 
                type="submit"
                disabled={isLoading}
                className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm tracking-wide shadow-lg flex items-center justify-center gap-2 transition-all ${
                  isLoading 
                    ? "bg-slate-400 text-white cursor-not-allowed" 
                    : "bg-teal-600 hover:bg-teal-700 text-white active:scale-95 shadow-teal-600/25 cursor-pointer"
                }`}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Writing Copy Blueprints...</span>
                  </>
                ) : (
                  <>
                    <Sparkle className="w-4 h-4" />
                    <span>Generate Complete Campaign</span>
                  </>
                )}
              </button>
            </div>
            
          </form>
        </div>

        {/* LOADING SCREEN CONTAINER */}
        {isLoading && (
          <div className="p-8 sm:p-12 bg-white/40 border border-white/60 rounded-3xl backdrop-blur-md shadow-lg flex flex-col items-center justify-center text-center space-y-6">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-teal-600/20 border-t-teal-600 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkle className="w-6 h-6 text-teal-600 animate-pulse" />
              </div>
            </div>
            
            <div className="max-w-lg space-y-3">
              <h3 className="text-base font-bold text-teal-950 uppercase tracking-widest">
                Consulting NayePankh Brand Guidelines...
              </h3>
              <p className="text-xs text-slate-500">
                Determining socio-demographic metrics for <strong className="text-teal-950 font-semibold">"{selectedAudience}"</strong> regarding <strong className="text-teal-950 font-semibold">"{selectedTopic}"</strong>.
              </p>
              
              {/* Fun / Impact facts cycling */}
              <div className="pt-6 border-t border-slate-200/60 max-w-md mx-auto">
                <span className="text-[9px] font-bold bg-teal-50 text-teal-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Did You Know? ({NGO_FACTS[loadingFactIndex].category})
                </span>
                <p className="text-xs text-slate-600 mt-2 italic leading-relaxed transition-all duration-500">
                  "{NGO_FACTS[loadingFactIndex].text}"
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {error && (
          <div className="p-6 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3.5">
            <div className="p-1.5 bg-red-100 rounded-lg text-red-700 shrink-0">
              ⚠️
            </div>
            <div>
              <h3 className="text-sm font-bold text-red-800">Campaign Blueprint Generation Failed</h3>
              <p className="text-xs text-red-600 mt-1 leading-relaxed">
                {error}
              </p>
              <div className="mt-4 flex gap-3">
                <button 
                  onClick={() => handleGenerate()}
                  className="px-3 py-1.5 bg-red-800 hover:bg-red-900 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Retry Request
                </button>
                <button 
                  onClick={() => setError(null)}
                  className="px-3 py-1.5 bg-white border border-red-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium"
                >
                  Clear Error Banner
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GENERATED CAMPAIGN DOSSIER PRESENTATION */}
        {currentCampaign ? (
          <div className={`space-y-6 ${isLoading ? "opacity-30 pointer-events-none transition-opacity" : ""}`}>
            
            {/* Top Bar for Output Actions */}
            <div id="output_header" className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-white/60 backdrop-blur-md rounded-2xl border border-white/80 gap-4 shadow-xs">
              
              {/* Left Details: Current specs */}
              <div>
                <span className="text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200/50 px-2 py-0.5 rounded-full uppercase tracking-widest">
                  Live Dossier
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  {currentCampaign.topic} — {currentCampaign.tone}
                </h3>
              </div>

              {/* Action Suite & Lang Switcher */}
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                
                {/* Dual-language selector toggle */}
                <div className="flex bg-slate-200/70 p-1 rounded-xl border border-slate-300/40 mr-1.5">
                  <button 
                    onClick={() => {
                      setActiveLanguage('english');
                      showBanner("🇺🇸 Display translation switched back to English");
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                      activeLanguage === 'english'
                        ? "bg-teal-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>English</span>
                  </button>
                  <button 
                    onClick={() => {
                      setActiveLanguage('hindi');
                      showBanner("🇮🇳 Display translation adapted into Hindi scripts successfully!");
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                      activeLanguage === 'hindi'
                        ? "bg-teal-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>हिन्दी (Hindi)</span>
                  </button>
                </div>

                {/* Regenerate Trigger */}
                <button 
                  onClick={() => handleGenerate()}
                  className="bg-white/80 hover:bg-slate-100 text-slate-700 border border-slate-300 p-2.5 sm:px-3 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5"
                  title="Regenerate campaign with same conditions"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-teal-600" />
                  <span className="hidden md:inline">Regenerate</span>
                </button>

                {/* TXT Copy/Download Output Actions */}
                <button 
                  onClick={handleDownloadTxt}
                  className="bg-white/80 hover:bg-slate-100 text-slate-700 border border-slate-300 p-2.5 sm:px-3 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5"
                  title="Export output as a Plain Text document"
                >
                  <Download className="w-3.5 h-3.5 text-teal-600" />
                  <span className="hidden md:inline">Download TXT</span>
                </button>

                {/* PDF Output Actions */}
                <button 
                  onClick={handleDownloadPdf}
                  className="bg-slate-900 hover:bg-slate-800 text-white p-2.5 sm:px-4 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
                  title="Generate high-fidelity PDF dossier and save locally"
                >
                  <FileDown className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download PDF Dossier</span>
                </button>

              </div>
            </div>

            {/* HIGH-IMPACT DOSSIER GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* PRIMARY COLUMN 1: Slogan & Print/Poster Headline Details */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Slogan & Poster Headline Hero Board */}
                <div id="hero_slogan_card" className="bg-white/60 backdrop-blur-md rounded-3xl border border-white/80 p-6 sm:p-8 flex flex-col justify-between shadow-xs relative overflow-hidden">
                  
                  {/* Glowing background hint */}
                  <div className="absolute right-0 top-0 w-32 h-32 bg-teal-200/10 rounded-full blur-2xl" />
                  
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <span className="text-[10px] font-bold text-teal-800 bg-teal-100/70 border border-teal-200 px-2 py-0.5 rounded-md uppercase tracking-widest">
                        Campaign Brand Slogan & Poster Copy
                      </span>
                    </div>
                  </div>

                  {/* Slogan Output display */}
                  <div className="space-y-4 mb-8">
                    <div>
                      <p className="text-[10px] font-extrabold text-teal-800 uppercase tracking-widest">
                        Catchy Slogan
                      </p>
                      <h2 className="text-2xl sm:text-3xl font-serif font-black text-slate-900 leading-tight mt-1">
                        {activeLanguage === 'english' ? currentCampaign.slogan : currentCampaign.hindi.slogan}
                      </h2>
                    </div>

                    <div className="pt-4 border-t border-slate-200/55 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Poster Headline
                        </p>
                        <p className="font-bold text-slate-800 text-sm sm:text-base mt-0.5">
                          {activeLanguage === 'english' ? currentCampaign.posterHeadline : currentCampaign.hindi.posterHeadline}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Poster Supporting Subhead
                        </p>
                        <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                          {activeLanguage === 'english' ? currentCampaign.posterSubheadline : currentCampaign.hindi.posterSubheadline}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Poster Bottom Highlight Action bar */}
                  <div className="pt-4 border-t border-slate-200/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Poster Urgent CTA (Call To Action)</p>
                      <p className="text-xs font-bold text-teal-700">
                        {activeLanguage === 'english' ? currentCampaign.posterCta : currentCampaign.hindi.posterCta}
                      </p>
                    </div>
                    <button 
                      onClick={handleCopyAll}
                      className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold text-center transition-colors shadow-xs"
                    >
                      {copiedSection === 'all-assets' ? "✓ Dossier Copied" : "Copy Complete Campaign Text"}
                    </button>
                  </div>

                </div>

                {/* Email Campaign Draft Container */}
                <div id="email_campaign_card" className="bg-white/50 backdrop-blur-md rounded-3xl border border-white/80 p-6 flex flex-col shadow-xs">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-bold text-teal-800 bg-teal-100/70 border border-teal-200 px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-teal-700" /> Dynamic Email Outreach Suite
                    </span>
                    <button 
                      onClick={() => handleCopyText(currentCampaign.emailCampaign, 'email-box')}
                      className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-all flex items-center gap-1 text-[11px] font-semibold border border-slate-200"
                    >
                      {copiedSection === 'email-box' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSection === 'email-box' ? 'Copied' : 'Copy Email'}</span>
                    </button>
                  </div>

                  <div className="p-4 bg-white/70 rounded-2xl border border-slate-200/50 max-h-96 overflow-y-auto">
                    <pre className="text-xs text-slate-700 font-sans whitespace-pre-wrap leading-relaxed">
                      {currentCampaign.emailCampaign}
                    </pre>
                  </div>
                  
                  <p className="text-[10px] text-slate-500 mt-2.5">
                    *Statistically backed to build rapport with registered <strong>{selectedAudience}</strong> using a <strong>{selectedTone}</strong> style. Customize details like coordinates before deploying.
                  </p>
                </div>

                {/* ADVANCED AI POSTER PROMPT CARD */}
                <div id="poster_ai_prompt_card" className="p-6 bg-gradient-to-br from-teal-950 to-slate-900 text-white rounded-3xl shadow-xl flex flex-col sm:flex-row gap-5 items-start">
                  <div className="p-3 bg-white/10 rounded-2xl text-teal-300 flex items-center justify-center shrink-0">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-950/80 border border-emerald-800/30 px-2 py-0.5 rounded">
                      Poster Image Generation Prompt (AI Imagery)
                    </span>
                    <h4 className="text-sm font-bold tracking-tight text-white">
                      Descriptive Scenario for Imagen 3 / Midjourney
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed italic">
                      "{currentCampaign.posterImagePrompt}"
                    </p>
                    <div className="pt-2 flex items-center gap-2">
                      <button 
                        onClick={() => handleCopyText(currentCampaign.posterImagePrompt, 'poster-prompt')}
                        className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white transition-all flex items-center gap-1 border border-white/10"
                      >
                        {copiedSection === 'poster-prompt' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedSection === 'poster-prompt' ? 'Prompt Copied' : 'Copy Graphic Prompt'}</span>
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              {/* SECONDARY COLUMN 2: Social media blocks, awareness message highlights and mini caption structures */}
              <div className="space-y-6">
                
                {/* SOCIAL MEDIA DRAFT BLOCK */}
                <div className="bg-white/60 backdrop-blur-md rounded-3xl border border-white/80 p-5 flex flex-col shadow-xs">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200/50">
                    <span className="text-[10px] font-black bg-indigo-50 border border-indigo-200 text-indigo-800 px-2.5 py-1 rounded-md uppercase tracking-wider">
                      Social Media Post
                    </span>
                    <button 
                      onClick={() => handleCopyText(
                        `${activeLanguage === 'english' ? currentCampaign.socialMediaPost : currentCampaign.hindi.socialMediaPost}\n\n${currentCampaign.hashtags.join(" ")}`, 
                        'social-box'
                      )}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                      title="Copy social copy script"
                    >
                      {copiedSection === 'social-box' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="space-y-4">
                    <p className="text-xs sm:text-sm leading-relaxed text-slate-700 font-medium">
                      {activeLanguage === 'english' ? currentCampaign.socialMediaPost : currentCampaign.hindi.socialMediaPost}
                    </p>

                    {/* Integrated hashtag box styling */}
                    <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-100/65">
                      <p className="text-[10px] font-extrabold text-emerald-900 mb-1.5 uppercase tracking-wider">
                        Suggested Social Hashtags ({currentCampaign.hashtags.length})
                      </p>
                      <p className="text-xs text-emerald-700 tracking-wide leading-relaxed font-mono">
                        {currentCampaign.hashtags.join(" ")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* EMOTIONAL CORE AWARENESS BOX (ALWAYS HIGH QUALITY BRIGHT DEEP BACKDROP) */}
                <div className="bg-teal-900 rounded-3xl p-6 text-white flex flex-col justify-between shadow-md relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-24 h-24 bg-white/5 rounded-full blur-xl" />
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                        Emotional Resonance Core
                      </p>
                    </div>

                    <p className="text-sm font-semibold tracking-wide leading-relaxed font-serif">
                      "{activeLanguage === 'english' ? currentCampaign.awarenessMessage : currentCampaign.hindi.awarenessMessage}"
                    </p>
                  </div>

                  <div className="pt-6 mt-6 border-t border-white/10 flex justify-between items-center">
                    <span className="text-[9px] text-teal-200">NayePankh Campaign Core</span>
                    <button 
                      onClick={() => handleCopyText(
                        activeLanguage === 'english' ? currentCampaign.awarenessMessage : currentCampaign.hindi.awarenessMessage, 
                        'impact-box'
                      )}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-bold text-white transition-colors border border-white/10"
                    >
                      {copiedSection === 'impact-box' ? "✓ Message Copied" : "Copy Message"}
                    </button>
                  </div>
                </div>

                {/* SOCIAL MINI CAPTION VARIATIONS */}
                <div className="bg-white/60 backdrop-blur-md rounded-3xl border border-white/80 p-5 flex flex-col shadow-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3.5 block">
                    ⚡ Micro-Caption Social Variations
                  </span>

                  <div className="space-y-4">
                    <div>
                      <span className="text-[9px] font-bold text-teal-800 uppercase block mb-1">
                        1. Bold / Ultra Punchy (&lt;60 characters)
                      </span>
                      <p className="text-xs text-slate-700 italic bg-white/40 p-2.5 rounded-lg border border-slate-200/50">
                        "{currentCampaign.captionVariations[0] || 'Empower the society now!'}"
                      </p>
                    </div>

                    <div>
                      <span className="text-[9px] font-bold text-indigo-800 uppercase block mb-1">
                        2. Conversational / Reply Igniter
                      </span>
                      <p className="text-xs text-slate-700 italic bg-white/40 p-2.5 rounded-lg border border-slate-200/50">
                        "{currentCampaign.captionVariations[1] || 'What is your take on education?'}"
                      </p>
                    </div>

                    <div>
                      <span className="text-[9px] font-bold text-slate-800 uppercase block mb-1">
                        3. Storytelling Hook
                      </span>
                      <p className="text-xs text-slate-700 italic bg-white/40 p-2.5 rounded-lg border border-slate-200/50">
                        "{currentCampaign.captionVariations[2] || 'A small step went a long way...'}"
                      </p>
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </div>
        ) : (
          /* EMPTY STATE - REVEALED FIRST VISIT */
          <div id="welcome_empty_state" className="flex flex-col items-center justify-center p-8 sm:p-12 bg-white/30 backdrop-blur-md border border-white/60 rounded-3xl text-center space-y-6">
            <div className="w-16 h-16 bg-gradient-to-tr from-teal-500 to-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-md">
              <Sparkle className="w-8 h-8 animate-spin-slow text-teal-100" />
            </div>
            
            <div className="max-w-md space-y-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                No Campaign Active
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Select your parameters (topic, audience, and tone) on the control board above and click <strong>"Generate"</strong> to receive an instantly tailored multi-channel outreach dossier.
              </p>
            </div>

            <div className="pt-4 border-t border-dashed border-slate-300 w-full max-w-sm">
              <p className="text-[11px] text-slate-500">
                ⭐ Built in direct support of the <strong className="text-teal-980">NayePankh Foundation</strong> to amplify visibility and volunteer onboarding.
              </p>
            </div>
          </div>
        )}

        {/* STATUS BAR FOOTER */}
        <footer className="pt-8 pb-4 flex flex-col sm:flex-row justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest gap-2">
          <div>
            <span>© {new Date().getFullYear()} NayePankh Foundation</span>
          </div>
          <div className="flex gap-4">
            <a href="https://nayepankh.org" target="_blank" rel="noreferrer" className="hover:text-teal-600 transition-colors">
              NayePankh Website
            </a>
            <span>•</span>
            <span className="text-slate-500 cursor-default">Dossier Engine</span>
          </div>
        </footer>

      </main>

    </div>
  );
}
